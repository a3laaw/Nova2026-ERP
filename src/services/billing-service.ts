'use client';

import { 
  Firestore, 
  collection, 
  getDocs, 
  getDoc,
  query, 
  where, 
  serverTimestamp,
  writeBatch,
  increment,
  limit,
  doc,
  setDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Contract } from '@/types/documents';
import { ContractMilestone, MilestoneTiming } from '@/types/templates';
import { nextSequential } from '@/lib/counters';

/**
 * محرك الفوترة السيادي المطور (Sovereign Billing Engine V4).
 * تم تحديثه ليدعم حساب المحتجزات (Retention) بنسبة 5% آلياً وبدقة مطلقة للمالك والباطن.
 */
export class BillingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إطلاق مطالبة مالية للمالك مع احتساب المحتجزات (Owner Billing with Retention)
   */
  async triggerMilestoneBilling(
    transactionId: string, 
    technicalStageId: string, 
    timing: MilestoneTiming,
    userId: string,
    userName: string
  ) {
    if (!this.db || !this.companyId || !transactionId || !technicalStageId) return null;

    const contractsSnap = await getDocs(query(
      collection(this.db, paths.contracts(this.companyId)), 
      where('transactionId', '==', transactionId),
      where('status', 'in', ['approved', 'active', 'signed', 'paid']),
      limit(1)
    ));

    if (contractsSnap.empty) return null;
    
    const contractDoc = contractsSnap.docs[0];
    const contract = { id: contractDoc.id, ...contractDoc.data() } as Contract;

    const targetMilestones = (contract.milestones || []).filter(m => 
      String(m.technicalStageId) === String(technicalStageId) && m.timing === timing
    );

    if (targetMilestones.length === 0) return null;

    const existingIpcsSnap = await getDocs(query(
      collection(this.db, paths.ipcs(this.companyId)),
      where('transactionId', '==', transactionId),
      where('contractId', '==', contract.id)
    ));

    const alreadyBilledMilestones = new Set(
      existingIpcsSnap.docs.flatMap(d => d.data().milestonesTriggered || [])
    );

    const newMilestones = targetMilestones.filter(m => !alreadyBilledMilestones.has(m.name));
    if (newMilestones.length === 0) return null;

    const batch = writeBatch(this.db);
    const ipcRef = doc(collection(this.db, paths.ipcs(this.companyId)));
    const ipcNumber = await nextSequential(this.db, this.companyId, `ipc_owner_${transactionId}`, 'IPC-', 4);

    const totalGrossAmount = newMilestones.reduce((acc, m) => {
       const mAmt = m.amount || (contract.totalAmount * (m.percentage || 0)) / 100;
       return acc + (Number(mAmt) || 0);
    }, 0);

    // تطبيق قاعدة المحتجزات السيادية للمالك (Default 5% from Contract)
    const retentionRate = (contract as any).retentionRate ?? 5; 
    const retentionAmount = Math.round((totalGrossAmount * (retentionRate / 100)) * 1000) / 1000;
    const netPayable = totalGrossAmount - retentionAmount;

    const timingLabel = timing === 'at' ? 'بدء' : timing === 'during' ? 'أثناء تنفيذ' : 'إتمام';
    
    const ipcData: any = {
      id: ipcRef.id,
      ipcNumber: ipcNumber,
      transactionId,
      contractId: contract.id,
      clientId: contract.clientId,
      clientName: contract.clientName,
      status: 'draft',
      name: `مطالبة مالية (${timingLabel}) - ${newMilestones.map(m => m.name).join(' & ')}`,
      grossAmount: totalGrossAmount,
      retentionAmount: retentionAmount,
      retentionRate: retentionRate,
      netPayable: netPayable,
      milestonesTriggered: newMilestones.map(m => m.name),
      companyId: this.companyId,
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(ipcRef, ipcData);

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'billing_triggered',
      content: `[أتمتة مالية] تم إصدار مطالبة (IPC) رقم ${ipcNumber}. القيمة الإجمالية: ${totalGrossAmount.toLocaleString()} د.ك، المحتجزات (${retentionRate}%): ${retentionAmount.toLocaleString()} د.ك، الصافي: ${netPayable.toLocaleString()} د.ك.`,
      userId,
      userName: 'NovaFlow Finance Engine',
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return ipcRef.id;
  }

  /**
   * توليد مطالبة لمقاول باطن مع احتساب المحتجزات (SIP with SubCon Retention)
   */
  async generateSubcontractorIPC(
    transactionId: string,
    subcontractorId: string,
    subcontractorName: string,
    amount: number,
    description: string,
    userId: string
  ) {
    const ipcRef = doc(collection(this.db, paths.subIpcs(this.companyId)));
    const ipcNumber = await nextSequential(this.db, this.companyId, `ipc_sub_${subcontractorId}`, 'S-IPC-', 4);
    
    const transSnap = await getDoc(doc(this.db, paths.transactions(this.companyId), transactionId));
    const transData = transSnap.data();

    // البحث عن عقد مقاول الباطن لمعرفة نسبة المحتجزات الخاصة به المعتمدة
    const subContractsSnap = await getDocs(query(
      collection(this.db, paths.subconContracts(this.companyId)),
      where('transactionId', '==', transactionId),
      where('subcontractorId', '==', subcontractorId),
      limit(1)
    ));
    
    const subContract = subContractsSnap.empty ? null : subContractsSnap.docs[0].data();
    
    // فرض نسبة 5% إذا لم تكن معرفة في عقد الباطن (الرقابة السيادية)
    const subRetentionRate = subContract?.retentionRate ?? 5;
    const retentionAmount = Math.round((amount * (subRetentionRate / 100)) * 1000) / 1000;
    const netPayable = amount - retentionAmount;

    const subIpcData: any = {
      id: ipcRef.id,
      ipcNumber: ipcNumber,
      subcontractorId,
      subcontractorName,
      transactionId,
      transactionNumber: transData?.transactionNumber || '',
      clientId: transData?.clientId || '',
      clientName: transData?.clientName || '',
      status: 'draft',
      grossAmount: amount,
      retentionAmount: retentionAmount,
      retentionRate: subRetentionRate,
      deductions: 0,
      netPayable: netPayable,
      notes: description,
      companyId: this.companyId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(ipcRef, subIpcData);
    return ipcRef.id;
  }
}
