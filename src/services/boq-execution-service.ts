
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
  updateDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, BOQItemExecutionEntry, LaborDetail, EquipmentUsed } from '@/types/documents';
import { ensureActionPermission } from '@/lib/permissions/engine';

export interface StageProgressResult {
  linkedItemsCount: number;
  totalPlanned: number;
  totalExecuted: number;
  progressPercent: number;
  canComplete: boolean;
}

/**
 * خدمة تنفيذ المقايسة الميدانية.
 * تربط بين تسجيل الإنجاز (المهندس) والاعتماد الفني (المشرف).
 */
export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تسجيل إنجاز ميداني مع استهلاك الموارد (عمالة ومعدات)
   */
  async recordBOQItemExecution(
    boqId: string,
    itemId: string,
    technicalStageId: string,
    quantity: number,
    userId: string,
    userName: string,
    notes?: string,
    stageInstanceId?: string,
    isForced: boolean = false,
    appointmentId?: string,
    resources?: {
       laborDetails?: LaborDetail[];
       equipmentUsed?: EquipmentUsed[];
    }
  ) {
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error('ITEM_NOT_FOUND');
    const itemData = itemSnap.data() as BOQItem;

    const executionRef = doc(collection(this.db, paths.executions(this.companyId)));
    const executionData: BOQItemExecutionEntry = {
      id: executionRef.id,
      companyId: this.companyId,
      boqId,
      boqItemId: itemId,
      transactionId: itemData.transactionId || '',
      appointmentId: appointmentId || null,
      technicalStageId,
      quantity,
      notes: notes || '',
      laborDetails: resources?.laborDetails || [],
      equipmentUsed: resources?.equipmentUsed || [],
      recordedBy: userId,
      recordedByName: userName,
      isArchived: false,
      isVerified: false, 
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const batch = writeBatch(this.db);
    batch.set(executionRef, executionData);
    
    // تحديث إجمالي المنفذ في البند (للمتابعة الفنية)
    batch.update(itemRef, {
      executedQuantity: increment(quantity),
      updatedAt: serverTimestamp()
    });

    // إضافة حدث للتايم لاين
    if (itemData.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId)));
      batch.set(timelineRef, {
        transactionId: itemData.transactionId,
        type: 'numeric_update',
        content: `[إنجاز ميداني] تم تسجيل ${quantity} ${itemData.unitSymbol || ''} لبند: ${itemData.referenceTitle}`,
        userId, userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();
    return executionRef.id;
  }

  /**
   * اعتماد الإنجاز الميداني للصرف المالي (Field-to-Finance Verification)
   */
  async verifyExecutionForBilling(executionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const execRef = doc(this.db, paths.executions(this.companyId), executionId);
    const execSnap = await getDoc(execRef);
    if (!execSnap.exists()) return;
    const execData = execSnap.data() as BOQItemExecutionEntry;

    const batch = writeBatch(this.db);
    
    // 1. تحديث سجل الزيارة كمعتمد
    batch.update(execRef, {
      isVerified: true,
      verifiedAt: serverTimestamp(),
      verifiedBy: userId,
      updatedAt: serverTimestamp()
    });

    // 2. ترحيل الكمية المعتمدة إلى بند المقايسة (Verified Quantity)
    const itemRef = doc(this.db, paths.boqItems(this.companyId, execData.boqId), execData.boqItemId);
    batch.update(itemRef, {
      verifiedQuantity: increment(execData.quantity),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  async getTechnicalStageProgress(transactionId: string, technicalStageId: string): Promise<StageProgressResult> {
    const boqsRef = collection(this.db, paths.boqs(this.companyId));
    const boqQuery = query(boqsRef, where('transactionId', '==', transactionId));
    const boqSnap = await getDocs(boqQuery);
    
    if (boqSnap.empty) return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };

    const boqId = boqSnap.docs[0].id;
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    const linkedItems = allItems.filter(i => (i.technicalStageIds?.includes(technicalStageId) || i.technicalStageId === technicalStageId) && (i.plannedQuantity || 0) > 0);

    if (linkedItems.length === 0) return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };

    let totalPlanned = 0;
    let totalExecuted = 0;
    linkedItems.forEach(item => {
      totalPlanned += (item.plannedQuantity || 0);
      totalExecuted += (item.executedQuantity || 0);
    });

    return {
      linkedItemsCount: linkedItems.length,
      totalPlanned,
      totalExecuted,
      progressPercent: Math.min(100, Math.round((totalExecuted / totalPlanned) * 100)),
      canComplete: totalExecuted >= totalPlanned
    };
  }
}
