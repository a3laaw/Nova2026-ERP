
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
import { BOQItem, BOQItemExecutionEntry, LaborDetail, EquipmentUsed } from '@/types/documents';
import { ensureActionPermission } from '@/lib/permissions/engine';

export interface StageProgressResult {
  progressPercent: number;
  canComplete: boolean;
  reason?: string;
  linkedItemsCount: number;
}

export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تسجيل إنجاز ميداني متكامل مع الموارد والتكاليف (Cost Snapping)
   */
  async recordBOQItemExecution(
    boqId: string,
    itemId: string,
    technicalStageId: string,
    quantity: number,
    userId: string,
    userName: string,
    notes: string,
    stageInstanceId: string,
    force: boolean = false,
    appointmentId?: string,
    resources?: { laborDetails: any[], equipmentUsed: any[] }
  ) {
    const executionRef = doc(collection(this.db, paths.executions(this.companyId)));
    
    // حساب تكاليف العمالة والمعدات وقت التسجيل (Snapshot)
    let processedLabor: LaborDetail[] = [];
    let processedEquip: EquipmentUsed[] = [];

    if (resources) {
       processedLabor = resources.laborDetails.map(l => ({
          ...l,
          totalCost: (Number(l.count) || 0) * (Number(l.hours) || 8) * (Number(l.hourlyCostRef) || 0)
       }));
       processedEquip = resources.equipmentUsed.map(e => ({
          ...e,
          totalCost: (Number(e.hoursUsed) || 0) * (Number(e.hourlyRateRef) || 0)
       }));
    }

    const executionData: any = {
      id: executionRef.id,
      companyId: this.companyId,
      boqId,
      boqItemId: itemId,
      transactionId: '', // ستُملأ لاحقاً
      appointmentId: appointmentId || null,
      stageInstanceId: stageInstanceId,
      technicalStageId,
      quantity: Number(quantity) || 0,
      status: 'executed',
      notes,
      laborDetails: processedLabor,
      equipmentUsed: processedEquip,
      recordedBy: userId,
      recordedByName: userName,
      createdAt: serverTimestamp(),
      isArchived: false
    };

    const batch = writeBatch(this.db);
    
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error("BOQ Item missing");
    const itemData = itemSnap.data() as BOQItem;

    executionData.transactionId = itemData.transactionId;
    executionData.clientId = itemData.clientId || (itemData as any).clientId || ''; // لضمان الظهور في الـ Dossier
    executionData.unitSymbol = itemData.unitSymbol || '';

    batch.set(executionRef, executionData);
    
    batch.update(itemRef, {
      executedQuantity: increment(Number(quantity) || 0),
      updatedAt: serverTimestamp()
    });

    // توثيق في التايملاين
    if (itemData.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, itemData.transactionId)));
      batch.set(timelineRef, {
        transactionId: itemData.transactionId,
        stageId: stageInstanceId,
        technicalStageId,
        appointmentId: appointmentId || null,
        type: 'numeric_update',
        content: `[إنجاز متكامل] تم تسجيل تنفيذ ${quantity} ${itemData.unitSymbol || ''} مع توثيق الموارد المستخدمة.`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();
    return executionRef.id;
  }

  async verifyExecutionForBilling(executionId: string, userId: string, userName: string) {
    const execRef = doc(this.db, paths.executions(this.companyId), executionId);
    const snap = await getDoc(execRef);
    if (!snap.exists()) return;
    const data = snap.data() as any;

    const batch = writeBatch(this.db);
    batch.update(execRef, {
      status: 'verified',
      verifiedQuantity: data.quantity,
      verifiedBy: userId,
      verifiedByName: userName,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const itemRef = doc(this.db, paths.boqItems(this.companyId, data.boqId), data.boqItemId);
    batch.update(itemRef, {
      verifiedQuantity: increment(data.quantity),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  async getTechnicalStageProgress(transactionId: string, technicalStageId: string): Promise<StageProgressResult> {
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', transactionId)));
    if (boqsSnap.empty) return { progressPercent: 0, canComplete: true, linkedItemsCount: 0 };

    const boqId = boqsSnap.docs[0].id;
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const linkedItems = itemsSnap.docs
      .map(d => d.data() as BOQItem)
      .filter(i => (i.technicalStageIds?.includes(technicalStageId) || i.technicalStageId === technicalStageId));

    if (linkedItems.length === 0) return { progressPercent: 100, canComplete: true, linkedItemsCount: 0 };

    let totalPlanned = 0, totalExecuted = 0;
    linkedItems.forEach(i => {
      totalPlanned += (i.plannedQuantity || 0);
      totalExecuted += (i.executedQuantity || 0);
    });

    return {
      progressPercent: totalPlanned > 0 ? Math.round((totalExecuted / totalPlanned) * 100) : 0,
      canComplete: totalExecuted >= totalPlanned,
      linkedItemsCount: linkedItems.length
    };
  }

  async archiveStageExecutions(transactionId: string, technicalStageId: string, isArchived: boolean) {
    const q = query(
      collection(this.db, paths.executions(this.companyId)),
      where('transactionId', '==', transactionId),
      where('technicalStageId', '==', technicalStageId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(this.db);
    snap.docs.forEach(d => {
       batch.update(d.ref, { isArchived, updatedAt: serverTimestamp() });
    });
    return batch.commit();
  }
}
