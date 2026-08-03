
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
  increment
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, BOQItemExecutionEntry, InterimPaymentCertificate, IPCItem } from '@/types/documents';
import { nextSequential } from '@/lib/counters';
import { AccountingIntegrationService } from './accounting-integration-service';

/**
 * محرك الفوترة والمستخلصات السيادي (Sovereign Billing Engine).
 * يقوم بتجميع الكميات المعتمدة ميدانياً وتحويلها لمطالبات مالية.
 */
export class BillingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء مستخلص جديد بناءً على الكميات المعتمدة غير المفوترة
   */
  async generateIPC(transactionId: string, userId: string, userName: string) {
    // 1. جلب المقايسة النشطة
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', transactionId)));
    if (boqsSnap.empty) throw new Error('NO_ACTIVE_BOQ');
    const boq = { id: boqsSnap.docs[0].id, ...boqsSnap.docs[0].data() } as any;

    // 2. جلب بنود المقايسة التي تحتوي على كميات معتمدة لم تدرج في مستخلصات
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boq.id)));
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    const billableItems = allItems.filter(i => (i.verifiedQuantity || 0) > (i.billedQuantity || 0));
    if (billableItems.length === 0) throw new Error('NO_UNBILLED_QUANTITIES');

    const batch = writeBatch(this.db);
    const ipcRef = doc(collection(this.db, paths.contracts(this.companyId).replace('contracts', 'ipcs'))); // استخدام مسار موازٍ
    const ipcNumber = await nextSequential(this.db, this.companyId, 'ipc', 'IPC-', 3);

    let totalCurrent = 0;

    const ipcItems: any[] = billableItems.map(item => {
      const currentQty = (item.verifiedQuantity || 0) - (item.billedQuantity || 0);
      const amount = currentQty * (item.estimatedRate || 0);
      totalCurrent += amount;

      return {
        boqItemId: item.id,
        description: item.referenceTitle,
        unit: item.unitSymbol || '',
        rate: item.estimatedRate || 0,
        plannedQty: item.plannedQuantity,
        previousQty: item.billedQuantity || 0,
        currentQty: currentQty,
        totalToDateQty: item.verifiedQuantity || 0,
        totalAmount: amount
      };
    });

    const ipcData: Partial<InterimPaymentCertificate> = {
      id: ipcRef.id,
      ipcNumber,
      transactionId,
      clientId: boq.clientId,
      clientName: boq.clientName,
      status: 'draft',
      totalCurrentClaim: totalCurrent,
      retentionAmount: totalCurrent * 0.1, // محتجز 10% تلقائي
      netPayable: totalCurrent * 0.9,
      companyId: this.companyId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(ipcRef, ipcData);

    // تحديث حقل billedQuantity في البنود لضمان عدم تكرار الفوترة
    billableItems.forEach(item => {
      const itemRef = doc(this.db, paths.boqItems(this.companyId, boq.id), item.id);
      const currentVerified = item.verifiedQuantity || 0;
      batch.update(itemRef, { billedQuantity: currentVerified });
    });

    await batch.commit();
    return ipcRef.id;
  }
}
