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
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, Contract, InterimPaymentCertificate } from '@/types/documents';
import { nextSequential } from '@/lib/counters';
import { MilestoneTiming } from '@/types/templates';

/**
 * محرك الفوترة والمستخلصات السيادي المطور (Sovereign Billing Engine V2).
 * يدعم التوليد التلقائي بناءً على مراحل المسار الفني وشروط الدفع.
 */
export class BillingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إطلاق مطالبة مالية بناءً على حدث في المسار الفني (تلقائي)
   */
  async triggerMilestoneBilling(
    transactionId: string, 
    technicalStageId: string, 
    timing: MilestoneTiming,
    userId: string,
    userName: string
  ) {
    // 1. جلب العقد المعتمد
    const contractsSnap = await getDocs(query(
      collection(this.db, paths.contracts(this.companyId)), 
      where('transactionId', '==', transactionId),
      where('status', 'in', ['approved', 'active', 'signed', 'paid']),
      limit(1)
    ));

    if (contractsSnap.empty) return null;
    const contract = { id: contractsSnap.docs[0].id, ...contractsSnap.docs[0].data() } as Contract;

    // 2. البحث عن الدفعات المرتبطة بهذه المرحلة وهذا التوقيت
    const targetMilestones = contract.milestones.filter(m => 
      m.technicalStageId === technicalStageId && m.timing === timing
    );

    if (targetMilestones.length === 0) return null;

    const batch = writeBatch(this.db);
    const ipcRef = doc(collection(this.db, paths.ipcs(this.companyId)));
    const ipcNumber = await nextSequential(this.db, this.companyId, `ipc_${contract.id}`, '', 0, 1);

    const totalAmount = targetMilestones.reduce((acc, m) => {
       const mAmt = m.amount || (contract.totalAmount * (m.percentage || 0)) / 100;
       return acc + mAmt;
    }, 0);

    const ipcData: any = {
      id: ipcRef.id,
      ipcNumber: Number(ipcNumber),
      transactionId,
      contractId: contract.id,
      clientId: contract.clientId,
      clientName: contract.clientName,
      status: 'draft',
      name: `مستخلص آلي - ${targetMilestones.map(m => m.name).join(' & ')}`,
      grossAmount: totalAmount,
      netPayable: totalAmount, // تبسيط للمسودة
      milestonesTriggered: targetMilestones.map(m => m.name),
      companyId: this.companyId,
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(ipcRef, ipcData);

    // توثيق في التايملاين
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'billing_triggered',
      content: `[أتمتة مالية] تم توليد مستخلص آلي بقيمة ${totalAmount.toLocaleString()} KWD بناءً على شرط الدفع (${timing}) للمرحلة المذكورة.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return ipcRef.id;
  }

  /**
   * توليد مستخلص بناءً على الكميات الميدانية (للمقاولات)
   */
  async generateQuantityIPC(transactionId: string, userId: string, userName: string) {
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', transactionId)));
    if (boqsSnap.empty) throw new Error('NO_ACTIVE_BOQ');
    const boqId = boqsSnap.docs[0].id;
    
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    // الكميات الجاهزة للفوترة (المنفذ > المفوتر)
    const billableItems = allItems.filter(i => (i.executedQuantity || 0) > (i.billedQuantity || 0));
    if (billableItems.length === 0) throw new Error('NO_NEW_PROGRESS');

    const ipcRef = doc(collection(this.db, paths.ipcs(this.companyId)));
    const ipcNumber = await nextSequential(this.db, this.companyId, `ipc_q_${transactionId}`, '', 0, 1);

    let gross = 0;
    const lines = billableItems.map(item => {
      const current = (item.executedQuantity || 0) - (item.billedQuantity || 0);
      const amt = current * (item.estimatedRate || 0);
      gross += amt;
      return {
        boqItemId: item.id,
        description: item.referenceTitle,
        previousQty: item.billedQuantity || 0,
        currentQty: current,
        totalQty: item.executedQuantity,
        rate: item.estimatedRate,
        amount: amt
      };
    });

    const ipcData = {
      id: ipcRef.id,
      ipcNumber: Number(ipcNumber),
      transactionId,
      status: 'draft',
      type: 'quantity_based',
      lineItems: lines,
      grossAmount: gross,
      netPayable: gross,
      companyId: this.companyId,
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp()
    };

    await setDoc(ipcRef, ipcData);
    return ipcRef.id;
  }
}
