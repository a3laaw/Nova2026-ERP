'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, BOQ } from '@/types/documents';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

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
 */
export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تحديث الكمية المنفذة لبند مقايسة فعلي
   */
  async updateBOQItemExecutedQuantity(
    boqId: string, 
    itemId: string, 
    executedQuantity: number, 
    userId: string,
    userName: string
  ) {
    ensureActionPermission(this.permissions, 'projects:edit');

    if (executedQuantity < 0) {
      throw new Error('VALUE_NEGATIVE: لا يمكن إدخال كمية منفذة بالسالب.');
    }

    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    const itemSnap = await getDocs(query(collection(this.db, paths.boqItems(this.companyId, boqId)), where('id', '==', itemId)));
    
    if (itemSnap.empty) throw new Error('ITEM_NOT_FOUND');
    const itemData = itemSnap.docs[0].data() as BOQItem;

    const isOver = executedQuantity > itemData.plannedQuantity;
    
    const updateData = {
      executedQuantity,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    await updateDoc(itemRef, updateData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: itemRef.path, operation: 'update', requestResourceData: updateData
      }));
      throw err;
    });

    // تسجيل الحدث في سجل المعاملة (Audit)
    if (itemData.transactionId) {
      const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId));
      await addDoc(timelineRef, {
        transactionId: itemData.transactionId,
        type: 'numeric_update',
        content: `تحديث إنجاز البنود: ${itemData.description} -> تم تنفيذ ${executedQuantity} ${itemData.unit} ${isOver ? '(تجاوز للكمية المخططة)' : ''}`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true, isOverExecuted: isOver };
  }

  /**
   * حساب تقدم بند واحد
   */
  getBOQItemProgress(item: BOQItem): ItemProgressResult {
    const planned = item.plannedQuantity || 0;
    const executed = item.executedQuantity || 0;
    const progress = planned > 0 ? (executed / planned) * 100 : 0;
    
    return {
      plannedQuantity: planned,
      executedQuantity: executed,
      progressPercent: Math.round(progress * 100) / 100,
      remainingQuantity: Math.max(0, planned - executed),
      isOverExecuted: executed > planned
    };
  }

  /**
   * جلب ملخص تقدم المقايسة بالكامل
   */
  async getBOQProgressSummary(boqId: string) {
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const items = itemsSnap.docs.map(d => d.data() as BOQItem);

    const totalPlanned = items.reduce((sum, i) => sum + (i.plannedQuantity || 0), 0);
    const totalExecuted = items.reduce((sum, i) => sum + (i.executedQuantity || 0), 0);
    const overallProgress = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

    return {
      totalPlanned,
      totalExecuted,
      overallProgressPercent: Math.round(overallProgress * 100) / 100,
      itemsCount: items.length,
      completedItemsCount: items.filter(i => i.executedQuantity >= i.plannedQuantity).length
    };
  }

  /**
   * جلب تقدم الإنجاز لمرحلة فنية محددة داخل معاملة
   * تستخدم للتحقق قبل إغلاق المرحلة
   */
  async getTechnicalStageProgress(transactionId: string, technicalStageId: string): Promise<StageProgressResult> {
    // 1. البحث عن المقايسة المرتبطة بالمعاملة
    const boqsRef = collection(this.db, paths.boqs(this.companyId));
    const boqQuery = query(boqsRef, where('transactionId', '==', transactionId));
    const boqSnap = await getDocs(boqQuery);
    
    if (boqSnap.empty) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    const boqId = boqSnap.docs[0].id;

    // 2. جلب البنود المرتبطة بهذه المرحلة
    const itemsRef = collection(this.db, paths.boqItems(this.companyId, boqId));
    const itemsQuery = query(itemsRef, where('technicalStageId', '==', technicalStageId));
    const itemsSnap = await getDocs(itemsQuery);

    if (itemsSnap.empty) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    const items = itemsSnap.docs.map(d => d.data() as BOQItem);
    const totalPlanned = items.reduce((sum, i) => sum + (i.plannedQuantity || 0), 0);
    const totalExecuted = items.reduce((sum, i) => sum + (i.executedQuantity || 0), 0);
    const progress = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

    // قاعدة العمل: لا يمكن إغلاق المرحلة إذا كانت هناك بنود مرتبطة ولم يتم البدء في تنفيذها (0%)
    const canComplete = totalExecuted > 0;

    return {
      linkedItemsCount: items.length,
      totalPlanned,
      totalExecuted,
      progressPercent: Math.round(progress * 100) / 100,
      canComplete,
      reason: canComplete ? undefined : "يجب تسجيل إنجاز فعلي في بند واحد على الأقل من بنود المقايسة المرتبطة بهذه المرحلة قبل إغلاقها."
    };
  }
}
