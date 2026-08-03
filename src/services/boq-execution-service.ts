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
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { ensureActionPermission } from '@/lib/permissions/engine';

export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تسجيل إنجاز ميداني مع الموارد (حالة executed)
   * يتم توليد تكلفة WIP تقديرية فورية
   */
  async recordExecution(
    transactionId: string,
    boqId: string,
    itemId: string,
    quantity: number,
    resources: { labor: any[], equipment: any[] },
    userId: string,
    userName: string
  ) {
    const executionRef = doc(collection(this.db, paths.executions(this.companyId)));
    
    const executionData: BOQItemExecutionEntry = {
      id: executionRef.id,
      companyId: this.companyId,
      boqId,
      boqItemId: itemId,
      transactionId,
      quantity,
      status: 'executed',
      laborDetails: resources.labor || [],
      equipmentUsed: resources.equipment || [],
      recordedBy: userId,
      recordedByName: userName,
      createdAt: serverTimestamp()
    } as any;

    const batch = writeBatch(this.db);
    batch.set(executionRef, executionData);
    
    // تحديث الإجمالي المنفذ في البند للمتابعة الفنية
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    batch.update(itemRef, {
      executedQuantity: increment(quantity),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
    return executionRef.id;
  }

  /**
   * الاعتماد المالي (Verification) - تحويل المنفذ إلى معتمد للصرف
   */
  async verifyExecution(
    executionId: string, 
    verifiedQty: number, 
    status: 'verified' | 'partiallyVerified' | 'rejected',
    userId: string,
    reason?: string
  ) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const execRef = doc(this.db, paths.executions(this.companyId), executionId);
    const execSnap = await getDoc(execRef);
    if (!execSnap.exists()) return;
    const execData = execSnap.data() as BOQItemExecutionEntry;

    const batch = writeBatch(this.db);
    
    // 1. تحديث سجل الزيارة
    batch.update(execRef, {
      status,
      verifiedQuantity: verifiedQty,
      rejectionReason: reason || '',
      verifiedBy: userId,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. ترحيل الكمية المعتمدة فقط إلى البند (Verified Quantity)
    if (status !== 'rejected') {
      const itemRef = doc(this.db, paths.boqItems(this.companyId, execData.boqId), execData.boqItemId);
      batch.update(itemRef, {
        verifiedQuantity: increment(verifiedQty),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
  }

  async getTechnicalStageProgress(transactionId: string, technicalStageId: string) {
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', transactionId)));
    if (boqsSnap.empty) return { progressPercent: 0, canComplete: true };

    const boqId = boqsSnap.docs[0].id;
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const linkedItems = itemsSnap.docs
      .map(d => d.data() as BOQItem)
      .filter(i => (i.technicalStageIds?.includes(technicalStageId) || i.technicalStageId === technicalStageId));

    if (linkedItems.length === 0) return { progressPercent: 100, canComplete: true };

    let totalPlanned = 0, totalExecuted = 0;
    linkedItems.forEach(i => {
      totalPlanned += (i.contractQty || i.plannedQuantity || 0);
      totalExecuted += (i.executedQuantity || 0);
    });

    return {
      progressPercent: totalPlanned > 0 ? Math.round((totalExecuted / totalPlanned) * 100) : 0,
      canComplete: totalExecuted >= totalPlanned
    };
  }
}
