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
 * محرك الفوترة السيادي المطور (Sovereign Billing Engine V3).
 * تم تحديثه ليدعم "الارتباط المظلي"؛ حيث تطلق الكميات الميدانية المطالبات المالية آلياً.
 */
export class BillingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إطلاق مطالبة مالية بناءً على شرط دفع (Milestone Trigger)
   * يطبق القواعد: AT (عند)، DURING (أثناء)، AFTER (بعد)
   */
  async triggerMilestoneBilling(
    transactionId: string, 
    technicalStageId: string, 
    timing: MilestoneTiming,
    userId: string,
    userName: string
  ) {
    if (!this.db || !this.companyId || !transactionId || !technicalStageId) return null;

    console.log(`[Billing Engine] Checking triggers for Trans: ${transactionId}, Stage: ${technicalStageId}, Timing: ${timing}`);

    // 1. البحث عن عقد معتمد لهذه المعاملة
    const contractsSnap = await getDocs(query(
      collection(this.db, paths.contracts(this.companyId)), 
      where('transactionId', '==', transactionId),
      where('status', 'in', ['approved', 'active', 'signed', 'paid']),
      limit(1)
    ));

    if (contractsSnap.empty) {
      console.log(`[Billing Engine] No approved contract found for transaction ${transactionId}`);
      return null;
    }
    
    const contractDoc = contractsSnap.docs[0];
    const contract = { id: contractDoc.id, ...contractDoc.data() } as Contract;

    // 2. البحث عن الدفعات المطابقة للمرحلة المظلية (Umbrella Stage)
    // العقد الآن يراقب نفس الـ technicalStageId القادم من الميدان
    const targetMilestones = (contract.milestones || []).filter(m => 
      String(m.technicalStageId) === String(technicalStageId) && m.timing === timing
    );

    if (targetMilestones.length === 0) return null;

    // 3. حماية من تكرار المطالبة لنفس الدفعة (Idempotency Guard)
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

    const totalAmount = newMilestones.reduce((acc, m) => {
       const mAmt = m.amount || (contract.totalAmount * (m.percentage || 0)) / 100;
       return acc + (Number(mAmt) || 0);
    }, 0);

    const timingLabel = timing === 'at' ? 'بدء' : timing === 'during' ? 'أثناء تنفيذ' : 'إتمام';
    
    const ipcData: any = {
      id: ipcRef.id,
      ipcNumber: ipcNumber,
      transactionId,
      contractId: contract.id,
      clientId: contract.clientId,
      clientName: contract.clientName,
      status: 'draft',
      name: `مطالبة مالية آليّة (${timingLabel}) - ${newMilestones.map(m => m.name).join(' & ')}`,
      grossAmount: totalAmount,
      netPayable: totalAmount,
      milestonesTriggered: newMilestones.map(m => m.name),
      companyId: this.companyId,
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(ipcRef, ipcData);

    // توثيق الحدث في تايملاين المعاملة للربط المزدوج
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'billing_triggered',
      content: `[أتمتة مالية سيادية] تم توليد مسودة مطالبة (IPC) رقم ${ipcNumber} بقيمة ${totalAmount.toLocaleString()} د.ك بناءً على إنجاز ميداني موثق في مرحلة "${timingLabel}".`,
      userId,
      userName: 'NovaFlow Finance Engine',
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return ipcRef.id;
  }

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

    const subIpcData: any = {
      id: ipcRef.id,
      ipcNumber: ipcNumber,
      subcontractorId,
      subcontractorName,
      transactionId,
      transactionNumber: transData?.transactionNumber || '',
      status: 'draft',
      grossAmount: amount,
      deductions: 0,
      netPayable: amount,
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