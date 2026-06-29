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
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions/engine';

export interface ItemProgressResult {
  plannedQuantity: number;
  executedQuantity: number;
  progressPercent: number;
  remainingQuantity: number;
  isOverExecuted: boolean;
}

export interface StageProgressResult {
  linkedItemsCount: number;
  totalPlanned: number;
  totalExecuted: number;
  progressPercent: number;
  canComplete: boolean;
  reason?: string;
}

/**
 * خدمة الربط التنفيذي وتتبع الإنجاز للمقايسات (BOQ Progress Tracking Service).
 * تم تحويلها لاستخدام الهيكل المسطح لضمان ظهور السجلات في شريط المحادثة الموحد.
 */
export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تسجيل إنجاز مرحلي متخصص في المجموعة المسطحة
   */
  async recordBOQItemExecution(
    boqId: string,
    itemId: string,
    technicalStageId: string,
    quantity: number,
    userId: string,
    userName: string,
    notes?: string
  ) {
    ensureActionPermission(this.permissions, 'projects:edit');

    if (quantity < 0) {
      throw new Error('INVALID_QUANTITY: الكمية لا يمكن أن تكون سالبة.');
    }

    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    const itemSnap = await getDoc(itemRef);
    
    if (!itemSnap.exists()) throw new Error('ITEM_NOT_FOUND: البند غير موجود.');
    const itemData = itemSnap.data() as BOQItem;

    // 1. إضافة سجل التنفيذ في المجموعة المسطحة للشركة (لضمان الظهور في الـ Stream)
    const executionsRef = collection(this.db, paths.executions(this.companyId));
    const executionData: any = {
      companyId: this.companyId,
      boqId,
      boqItemId: itemId,
      transactionId: itemData.transactionId || '',
      technicalStageId,
      quantity,
      notes: notes || '',
      recordedBy: userId,
      recordedByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(executionsRef, executionData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: executionsRef.path, operation: 'create', requestResourceData: executionData
      }));
      throw err;
    });

    // 2. تحديث الرصيد التراكمي في البند الرئيسي للمقايسة
    const qCount = query(executionsRef, where('boqItemId', '==', itemId));
    const allExecutionsSnap = await getDocs(qCount);
    const newTotalExecuted = allExecutionsSnap.docs.reduce((sum, d) => sum + (d.data().quantity || 0), 0);

    await updateDoc(itemRef, {
      executedQuantity: newTotalExecuted,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    // 3. توثيق الحدث في سجل المعاملة العام
    if (itemData.transactionId) {
      const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId));
      await addDoc(timelineRef, {
        transactionId: itemData.transactionId,
        type: 'numeric_update',
        content: quantity === 0 
          ? `تأكيد فني: ${itemData.referenceTitle}`
          : `تسجيل إنجاز: ${itemData.referenceTitle} (${quantity} وحدة)`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true, newTotalExecuted };
  }

  /**
   * جلب تقرير تقدم المرحلة الفنية من المجموعة المسطحة
   */
  async getTechnicalStageProgress(transactionId: string, technicalStageId: string): Promise<StageProgressResult> {
    const boqsRef = collection(this.db, paths.boqs(this.companyId));
    const boqQuery = query(boqsRef, where('transactionId', '==', transactionId));
    const boqSnap = await getDocs(boqQuery);
    
    if (boqSnap.empty) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    const boqId = boqSnap.docs[0].id;
    const itemsRef = collection(this.db, paths.boqItems(this.companyId, boqId));
    const itemsSnap = await getDocs(itemsRef);
    
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    const linkedItems = allItems.filter(i => 
      (i.technicalStageIds && i.technicalStageIds.includes(technicalStageId)) || 
      (i.technicalStageId === technicalStageId)
    );

    if (linkedItems.length === 0) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    let totalPlanned = 0;
    let totalExecutedForThisStage = 0;
    let totalLogsCount = 0;

    const executionsRef = collection(this.db, paths.executions(this.companyId));

    for (const item of linkedItems) {
      totalPlanned += (item.plannedQuantity || 0);
      
      const qExec = query(
        executionsRef, 
        where('boqItemId', '==', item.id!),
        where('technicalStageId', '==', technicalStageId)
      );
      const execSnap = await getDocs(qExec);

      totalLogsCount += execSnap.size;
      totalExecutedForThisStage += execSnap.docs.reduce((acc, d) => acc + (d.data().quantity || 0), 0);
    }

    const progress = totalPlanned > 0 ? (totalExecutedForThisStage / totalPlanned) * 100 : 0;
    
    return {
      linkedItemsCount: linkedItems.length,
      totalPlanned,
      totalExecuted: totalExecutedForThisStage,
      progressPercent: Math.round(progress * 100) / 100,
      canComplete: totalLogsCount > 0,
      reason: totalLogsCount === 0 ? "يجب تسجيل الإنجاز المادي أو التأكيد الفني المكمل أولاً." : undefined
    };
  }
}
