'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  serverTimestamp,
  writeBatch,
  increment,
  limit,
  setDoc,
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, Contract, InterimPaymentCertificate } from '@/types/documents';
import { SubIPC } from '@/types/procurement';
import { nextSequential } from '@/lib/counters';
import { MilestoneTiming } from '@/types/templates';

/**
 * محرك الفوترة السيادي المطور (Sovereign Billing Engine V3).
 * يدعم مستخلصات المالك (Owner) ومستخلصات مقاولي الباطن (Sub-IPCs).
 */
export class BillingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إطلاق مطالبة مالية للمالك بناءً على شرط دفع (Milestone Trigger)
   */
  async triggerMilestoneBilling(
    transactionId: string, 
    technicalStageId: string, 
    timing: MilestoneTiming,
    userId: string,
    userName: string
  ) {
    const contractsSnap = await getDocs(query(
      collection(this.db, paths.contracts(this.companyId)), 
      where('transactionId', '==', transactionId),
      where('status', 'in', ['approved', 'active', 'signed', 'paid']),
      limit(1)
    ));

    if (contractsSnap.empty) return null;
    const contract = { id: contractsSnap.docs[0].id, ...contractsSnap.docs[0].data() } as Contract;

    const targetMilestones = contract.milestones.filter(m => 
      m.technicalStageId === technicalStageId && m.timing === timing
    );

    if (targetMilestones.length === 0) return null;

    const batch = writeBatch(this.db);
    const ipcRef = doc(collection(this.db, paths.ipcs(this.companyId)));
    const ipcNumber = await nextSequential(this.db, this.companyId, `ipc_owner_${transactionId}`, 'IPC-', 4);

    const totalAmount = targetMilestones.reduce((acc, m) => {
       const mAmt = m.amount || (contract.totalAmount * (m.percentage || 0)) / 100;
       return acc + mAmt;
    }, 0);

    const ipcData = {
      id: ipcRef.id,
      ipcNumber: ipcNumber,
      transactionId,
      contractId: contract.id,
      clientId: contract.clientId,
      clientName: contract.clientName,
      status: 'draft',
      name: `مستخلص (${timing}) - ${targetMilestones.map(m => m.name).join(' & ')}`,
      grossAmount: totalAmount,
      netPayable: totalAmount,
      milestonesTriggered: targetMilestones.map(m => m.name),
      companyId: this.companyId,
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp()
    };

    batch.set(ipcRef, ipcData);
    await batch.commit();
    return ipcRef.id;
  }

  /**
   * توليد مسودة مستخلص لمقاول باطن بناءً على إنجاز مرحلة أو بنود مقايسة
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

    const subIpcData: Partial<SubIPC> = {
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
      createdAt: serverTimestamp()
    };

    await setDoc(ipcRef, subIpcData);
    return ipcRef.id;
  }
}