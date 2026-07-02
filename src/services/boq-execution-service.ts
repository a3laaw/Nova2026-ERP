
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

  /**
   * Helper to get normalized technical stage IDs for a BOQ item.
   */
  private getAllowedTechnicalStageIds(item: BOQItem): string[] {
    if (item.technicalStageIds && item.technicalStageIds.length > 0) {
      return item.technicalStageIds;
    }
    return item.technicalStageId ? [item.technicalStageId] : [];
  }

  async recordBOQItemExecution(
    boqId: string,
    itemId: string,
    technicalStageId: string,
    quantity: number,
    userId: string,
    userName: string,
    notes?: string,
    stageInstanceId?: string,
    isForced: boolean = false
  ) {
    ensureActionPermission(this.permissions, 'projects:edit');

    if (quantity < 0) {
      throw new Error('INVALID_QUANTITY: الكمية لا يمكن أن تكون سالبة.');
    }

    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    const itemSnap = await getDoc(itemRef);
    
    if (!itemSnap.exists()) throw new Error('ITEM_NOT_FOUND: البند غير موجود.');
    const itemData = itemSnap.data() as BOQItem;

    // Check if the stage is allowed for this item
    const allowedStages = this.getAllowedTechnicalStageIds(itemData);
    const isStageAllowed = allowedStages.includes(technicalStageId);

    if (!isStageAllowed) {
      throw new Error('هذه المرحلة غير مرتبطة بهذا البند');
    }

    // 1. Calculate remaining before saving (for smart comment logic)
    const executionsRef = collection(this.db, paths.executions(this.companyId));
    const qPrev = query(executionsRef, where('boqItemId', '==', itemId), where('isArchived', '==', false));
    const snapPrev = await getDocs(qPrev);
    const totalExecutedSoFar = snapPrev.docs.reduce((s, d) => s + (d.data().quantity || 0), 0);
    const remainingBeforeThis = (itemData.plannedQuantity || 0) - totalExecutedSoFar;

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
      isForcedOverExecution: isForced,
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
      
      // Smart Comment Logic: Detect if this record exceeds remaining quantity
      let timelineContent = quantity === 0 
        ? `تأكيد فني: ${itemData.referenceTitle}`
        : `تسجيل إنجاز: ${itemData.referenceTitle} (${quantity} وحدة)`;

      if (quantity > remainingBeforeThis && quantity > 0) {
        timelineContent = `🛑 تنبيه تجاوز: تم تسجيل كمية (${quantity}) للبند [${itemData.referenceTitle}] بما يتجاوز المخطط المتبقي (${remainingBeforeThis.toFixed(2)}) بناءً على إقرار وموافقة المسؤول: ${userName}`;
      }

      await addDoc(timelineRef, {
        transactionId: itemData.transactionId,
        stageId: stageInstanceId || '', 
        technicalStageId: technicalStageId,
        type: 'numeric_update',
        content: timelineContent,
        notes: notes || '', 
        quantity,
        boqItemId: itemId,
        userId,
        userName,
        isArchived: false,
        isOverExecution: quantity > remainingBeforeThis,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    return { success: true };
  }

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
          isReset, 
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
    
    // Strict Guard: Exclude items that are effectively deleted (plannedQuantity === 0)
    const linkedItems = allItems.filter(i => 
      this.getAllowedTechnicalStageIds(i).includes(technicalStageId) && 
      (i.plannedQuantity || 0) > 0
    );

    if (linkedItems.length === 0) {
      return { linkedItemsCount: 0, totalPlanned: 0, totalExecuted: 0, progressPercent: 100, canComplete: true };
    }

    let totalPlanned = 0;
    let totalExecutedForThisStage = 0;

    const executionsRef = collection(this.db, paths.executions(this.companyId));

    for (const item of linkedItems) {
      const itemPlanned = item.plannedQuantity || 0;
      totalPlanned += itemPlanned;
      
      const qExec = query(
        executionsRef, 
        where('boqItemId', '==', item.id!),
        where('technicalStageId', '==', technicalStageId)
      );
      const execSnap = await getDocs(qExec);

      let itemExecSumFromLogs = 0;
      execSnap.docs.forEach(d => {
         const data = d.data();
         if (data.isArchived !== true) {
            itemExecSumFromLogs += (data.quantity || 0);
         }
      });

      // Handling legacy items or items without execution logs but with totals
      if (itemExecSumFromLogs === 0 && (!item.technicalStageIds || item.technicalStageIds.length === 0)) {
         if ((item.executedQuantity || 0) > 0) {
           itemExecSumFromLogs = item.executedQuantity || 0;
         }
      }

      totalExecutedForThisStage += itemExecSumFromLogs;
    }

    const progress = totalPlanned > 0 ? (totalExecutedForThisStage / totalPlanned) * 100 : 0;
    const isFullyCompleted = totalPlanned > 0 ? (totalExecutedForThisStage >= totalPlanned) : true;
    
    return {
      linkedItemsCount: linkedItems.length,
      totalPlanned,
      totalExecuted: totalExecutedForThisStage,
      progressPercent: Math.min(100, Math.round(progress * 100) / 100),
      canComplete: isFullyCompleted,
      reason: !isFullyCompleted 
        ? "لا يمكن إغلاق المرحلة قبل اكتمال 100% من البنود المرتبطة بها (المرحلة ما زالت تحتوي على كميات غير منفذة)." 
        : undefined
    };
  }
}
