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
  addDoc,
  writeBatch
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

export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

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

    // --- التحقق الأمني من ارتباط البند بالمرحلة الفنية ---
    const allowedStages = itemData.technicalStageIds || [];
    
    // إذا كان هناك مصفوفة مراحل، يجب أن تحتوي المرحلة المرسلة
    // إذا لم تكن موجودة (بيانات قديمة)، نستخدم الحقل المنفرد كـ fallback
    const isStageAllowed = allowedStages.length > 0 
      ? allowedStages.includes(technicalStageId)
      : itemData.technicalStageId === technicalStageId;

    if (!isStageAllowed) {
      throw new Error('هذه المرحلة غير مرتبطة بهذا البند');
    }

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
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(executionsRef, executionData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: executionsRef.path, operation: 'create', requestResourceData: executionData
      }));
      throw err;
    });

    await this.recalculateItemQuantity(boqId, itemId);

    if (itemData.transactionId) {
      const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId));
      await addDoc(timelineRef, {
        transactionId: itemData.transactionId,
        stageId: technicalStageId, // ربط الحدث بالمرحلة للأرشفة لاحقاً
        type: 'numeric_update',
        content: quantity === 0 
          ? `تأكيد فني: ${itemData.referenceTitle}`
          : `تسجيل إنجاز: ${itemData.referenceTitle} (${quantity} وحدة)`,
        userId,
        userName,
        isArchived: false,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true };
  }

  /**
   * أرشفة السجلات (تستخدم دائماً عند التراجع لضمان النزاهة)
   */
  async archiveStageExecutions(transactionId: string, technicalStageId: string, isReset: boolean = false) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const executionsRef = collection(this.db, paths.executions(this.companyId));
    const q = query(
      executionsRef, 
      where('transactionId', '==', transactionId),
      where('technicalStageId', '==', technicalStageId)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(this.db);
    const affectedItemIds = new Set<string>();
    const boqIds = new Set<string>();

    snap.docs.forEach(d => {
      const data = d.data();
      if (data.isArchived !== true) {
        batch.update(d.ref, { 
          isArchived: true, 
          isReset, // علامة توضح أن هذا الأرشيف ناتج عن عملية "تصفير"
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        affectedItemIds.add(data.boqItemId);
        boqIds.add(data.boqId);
      }
    });

    await batch.commit();

    for (const boqId of Array.from(boqIds)) {
      for (const itemId of Array.from(affectedItemIds)) {
        await this.recalculateItemQuantity(boqId, itemId);
      }
    }
  }

  private async recalculateItemQuantity(boqId: string, itemId: string) {
    const executionsRef = collection(this.db, paths.executions(this.companyId));
    const q = query(executionsRef, where('boqItemId', '==', itemId));
    const snap = await getDocs(q);
    
    const newTotal = snap.docs.reduce((sum, d) => {
       const data = d.data();
       return data.isArchived === true ? sum : sum + (data.quantity || 0);
    }, 0);

    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    await updateDoc(itemRef, {
      executedQuantity: newTotal,
      updatedAt: serverTimestamp()
    });
  }

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
    let totalActiveLogsCount = 0;

    const executionsRef = collection(this.db, paths.executions(this.companyId));

    for (const item of linkedItems) {
      totalPlanned += (item.plannedQuantity || 0);
      
      const qExec = query(
        executionsRef, 
        where('boqItemId', '==', item.id!),
        where('technicalStageId', '==', technicalStageId)
      );
      const execSnap = await getDocs(qExec);

      execSnap.docs.forEach(d => {
         const data = d.data();
         if (data.isArchived !== true) {
            totalActiveLogsCount++;
            totalExecutedForThisStage += (data.quantity || 0);
         }
      });
    }

    const progress = totalPlanned > 0 ? (totalExecutedForThisStage / totalPlanned) * 100 : 0;
    
    return {
      linkedItemsCount: linkedItems.length,
      totalPlanned,
      totalExecuted: totalExecutedForThisStage,
      progressPercent: Math.round(progress * 100) / 100,
      canComplete: totalActiveLogsCount > 0,
      reason: totalActiveLogsCount === 0 ? "يجب تسجيل الإنجاز المادي أو التأكيد الفني المكمل أولاً." : undefined
    };
  }
}