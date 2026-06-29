
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
import { BOQItem, BOQ, BOQItemExecutionEntry } from '@/types/documents';
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
 * تدعم مفهوم "التجميع التراكمي" (Bucket Execution).
 */
export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تسجيل إنجاز مرحلي متخصص (Execution Bucketing)
   * هذا التحديث يضمن تحديث إجمالي البند في المقايسة فوراً بعد تسجيل أي كمية في أي مرحلة.
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

    if (quantity <= 0) {
      throw new Error('INVALID_QUANTITY: الكمية يجب أن تكون أكبر من صفر.');
    }

    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    const itemSnap = await getDoc(itemRef);
    
    if (!itemSnap.exists()) throw new Error('ITEM_NOT_FOUND: البند غير موجود.');
    const itemData = itemSnap.data() as BOQItem;

    // 1. إضافة سجل التنفيذ التفصيلي للمجموعة الفرعية
    const executionsRef = collection(this.db, paths.boqItemExecutions(this.companyId, boqId, itemId));
    const executionData: BOQItemExecutionEntry = {
      companyId: this.companyId,
      boqId,
      boqItemId: itemId,
      technicalStageId,
      quantity,
      notes: notes || '',
      recordedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(executionsRef, executionData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: executionsRef.path, operation: 'create', requestResourceData: executionData
      }));
      throw err;
    });

    // 2. تحديث الرصيد التراكمي في البند الرئيسي (The Bucket Update)
    const allExecutionsSnap = await getDocs(executionsRef);
    const newTotalExecuted = allExecutionsSnap.docs.reduce((sum, d) => sum + (d.data().quantity || 0), 0);

    // تحديث البند الأصلي بالمجموع الجديد
    await updateDoc(itemRef, {
      executedQuantity: newTotalExecuted,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    // 3. توثيق الحدث في سجل المعاملة
    if (itemData.transactionId) {
      const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId));
      await addDoc(timelineRef, {
        transactionId: itemData.transactionId,
        type: 'numeric_update',
        content: `إنجاز ميداني: ${itemData.referenceTitle} -> تسجيل ${quantity} وحدة (الإجمالي المنفذ: ${newTotalExecuted}).`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true, newTotalExecuted };
  }

  /**
   * جلب تقرير تقدم المرحلة الفنية
   * تم تحسينه للتمييز بين المراحل الكمية (Linked) والمراحل الإجرائية (0 links)
   */
  async getTechnicalStageProgress(transactionId: string, technicalStageId: string): Promise<StageProgressResult> {
    const boqsRef = collection(this.db, paths.boqs(this.companyId));
    const boqQuery = query(boqsRef, where('transactionId', '==', transactionId));
    const boqSnap = await getDocs(boqQuery);
    
    // إذا لم تكن هناك مقايسة مرتبطة بعد، نعتبر كافة المراحل إجرائية حتى إنشاء المقايسة
    if (boqSnap.empty) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    const boqId = boqSnap.docs[0].id;
    const itemsRef = collection(this.db, paths.boqItems(this.companyId, boqId));
    const itemsSnap = await getDocs(itemsRef);
    
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    // البحث عن البنود المرتبطة بهذه المرحلة تحديداً
    const linkedItems = allItems.filter(i => 
      (i.technicalStageIds && i.technicalStageIds.includes(technicalStageId)) || 
      (i.technicalStageId === technicalStageId)
    );

    // المنطق الجديد: إذا لم يكن هناك بنود مرتبطة، فهي مرحلة إجرائية تكتمل بمجرد التأكيد
    if (linkedItems.length === 0) {
      return { 
        linkedItemsCount: 0, 
        totalPlanned: 0, 
        totalExecuted: 0, 
        progressPercent: 100, 
        canComplete: true // مسموح بالإغلاق لأنها مجرد خطوة فنية
      };
    }

    let totalPlanned = 0;
    let totalExecutedForThisStage = 0;

    for (const item of linkedItems) {
      totalPlanned += (item.plannedQuantity || 0);
      
      const executionsRef = collection(this.db, paths.boqItemExecutions(this.companyId, boqId, item.id!));
      const qExec = query(executionsRef, where('technicalStageId', '==', technicalStageId));
      const execSnap = await getDocs(qExec);

      totalExecutedForThisStage += execSnap.docs.reduce((acc, d) => acc + (d.data().quantity || 0), 0);
    }

    const progress = totalPlanned > 0 ? (totalExecutedForThisStage / totalPlanned) * 100 : 0;
    
    return {
      linkedItemsCount: linkedItems.length,
      totalPlanned,
      totalExecuted: totalExecutedForThisStage,
      progressPercent: Math.round(progress * 100) / 100,
      // المراحل الكمية تتطلب إنجازاً ملموساً (أكبر من صفر) للسماح بالإغلاق
      canComplete: totalExecutedForThisStage > 0 
    };
  }
}
