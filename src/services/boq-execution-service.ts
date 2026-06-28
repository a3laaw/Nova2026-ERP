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
   * تسجيل إنجاز مرحلي متخصص (Execution Bucketing)
   * يقوم بتوزيع الإنجاز على مراحل فنية محددة وإعادة حساب الإجمالي
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

    // التحقق من صحة المرحلة (دعم متعدد أو مفرد للتوافق)
    const allowedStages = itemData.technicalStageIds && itemData.technicalStageIds.length > 0 
      ? itemData.technicalStageIds 
      : (itemData.technicalStageId ? [itemData.technicalStageId] : []);

    if (!allowedStages.includes(technicalStageId)) {
      throw new Error('STAGE_NOT_LINKED: هذه المرحلة غير مرتبطة بهذا البند الفني في القاموس المرجعي.');
    }

    // 1. إضافة سجل التنفيذ التفصيلي
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

    // 2. إعادة حساب الإجمالي الحقيقي من كافة سجلات التنفيذ (Single Source of Truth)
    const allExecutionsSnap = await getDocs(executionsRef);
    const newTotal = allExecutionsSnap.docs.reduce((sum, d) => sum + (d.data().quantity || 0), 0);

    // 3. تحديث البند الرئيسي بالكمية التراكمية الجديدة
    await updateDoc(itemRef, {
      executedQuantity: newTotal,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: itemRef.path, operation: 'update'
        }));
        throw err;
    });

    // 4. تسجيل الحدث في سجل المعاملة (Timeline)
    if (itemData.transactionId) {
      const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId));
      await addDoc(timelineRef, {
        transactionId: itemData.transactionId,
        type: 'numeric_update',
        content: `تسجيل إنجاز مرحلي: ${itemData.referenceTitle} -> تم إضافة ${quantity} وحدة (${newTotal} إجمالي) في المرحلة الفنية المحددة.`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true, newTotal };
  }

  /**
   * تحديث الكمية المنفذة لبند مقايسة فعلي (Legacy Method - Manual Override)
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
    
    // جلب البيانات الحالية للتحقق والتسجيل
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error('ITEM_NOT_FOUND');
    const itemData = itemSnap.data() as BOQItem;

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
        content: `تحديث يدوي للإنجاز: ${itemData.referenceTitle} -> تم ضبط الإجمالي إلى ${executedQuantity} ${itemData.unitSymbol || ''} ${isOver ? '(تجاوز للكمية المخططة)' : ''}`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true, isOverExecuted: isOver };
  }

  /**
   * حساب تقدم بند واحد (Runtime Helper)
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
   * تم تحديث المنطق ليدعم الربط المتعدد وسجلات التنفيذ المرحلية
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

    // 2. جلب كافة البنود وتحليل الارتباط برمجياً (لضمان دقة الـ Multiple Stages)
    const itemsRef = collection(this.db, paths.boqItems(this.companyId, boqId));
    const itemsSnap = await getDocs(itemsRef);
    
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    // تصفية البنود المرتبطة بهذه المرحلة (دعم المصفوفة technicalStageIds والحقل المفرد)
    const linkedItems = allItems.filter(i => 
      (i.technicalStageIds && i.technicalStageIds.includes(technicalStageId)) || 
      (i.technicalStageId === technicalStageId)
    );

    if (linkedItems.length === 0) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    let totalPlanned = 0;
    let totalExecuted = 0;

    // 3. حساب الإنجاز التراكمي للمرحلة المختارة فقط عبر كافة البنود المرتبطة
    const executionPromises = linkedItems.map(async (item) => {
      totalPlanned += (item.plannedQuantity || 0);

      // جلب سجلات التنفيذ لهذه المرحلة تحديداً تحت هذا البند
      const executionsRef = collection(this.db, paths.boqItemExecutions(this.companyId, boqId, item.id));
      const qExec = query(executionsRef, where('technicalStageId', '==', technicalStageId));
      const execSnap = await getDocs(qExec);

      if (!execSnap.empty) {
        // نجمع فقط السجلات الخاصة بهذه المرحلة (Execution Bucketing)
        const stageSum = execSnap.docs.reduce((acc, d) => acc + (d.data().quantity || 0), 0);
        totalExecuted += stageSum;
      } else {
        // نظام التعويض للبنود القديمة (Fallback): إذا لا يوجد مصفوفة مراحل، نعتمد الإجمالي
        const isOldItem = !item.technicalStageIds || item.technicalStageIds.length === 0;
        if (isOldItem && item.technicalStageId === technicalStageId) {
          totalExecuted += (item.executedQuantity || 0);
        }
      }
    });

    await Promise.all(executionPromises);

    const progress = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;
    const canComplete = totalExecuted > 0;

    return {
      linkedItemsCount: linkedItems.length,
      totalPlanned,
      totalExecuted,
      progressPercent: Math.round(progress * 100) / 100,
      canComplete,
      reason: canComplete ? undefined : "يجب تسجيل إنجاز مادي في بند واحد على الأقل من بنود المقايسة المرتبطة بهذه المرحلة قبل إغلاقها."
    };
  }
}
