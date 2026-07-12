
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  serverTimestamp, 
  query,
  orderBy,
  writeBatch,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQVariation, BOQVariationItem, BOQVariationStatus, BOQItem, BOQ } from '@/types/documents';
import { StageInstance } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions/engine';

export class VariationService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async createVariation(
    boqId: string, 
    transactionId: string,
    boqNumber: string,
    data: { title: string; reason: string },
    items: Partial<BOQVariationItem>[],
    userId: string
  ): Promise<string> {
    ensureActionPermission(this.permissions, 'projects:edit');

    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const boqSnap = await getDoc(boqRef);
    const boqData = boqSnap.exists() ? boqSnap.data() as BOQ : null;

    const batch = writeBatch(this.db);
    const variationRef = doc(collection(this.db, paths.boqVariations(this.companyId, boqId)));
    const voId = variationRef.id;

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

    const variationData: BOQVariation = {
      id: voId,
      boqId,
      transactionId,
      boqNumber,
      title: data.title,
      reason: data.reason,
      status: 'draft',
      totalAmount,
      companyId: this.companyId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      activityTypeId: boqData?.activityTypeId,
      serviceId: boqData?.serviceId,
      subServiceId: boqData?.subServiceId
    };

    batch.set(variationRef, variationData);

    const itemsPath = paths.boqVariationItems(this.companyId, boqId, voId);
    items.forEach((item) => {
      const itemRef = doc(collection(this.db, itemsPath));
      batch.set(itemRef, {
        ...item,
        id: itemRef.id,
        variationId: voId,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    });

    try {
      await batch.commit();
      return voId;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: variationRef.path, operation: 'create', requestResourceData: variationData
      }));
      throw err;
    }
  }

  /**
   * REFACTORED: Decomposed into smaller logic units (Martin Fowler: Extract Method)
   */
  async approveVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    const voSnap = await getDoc(voRef);

    if (!voSnap.exists() || voSnap.data().status !== 'draft') {
      throw new Error('VO_NOT_READY');
    }
    
    const voData = voSnap.data() as BOQVariation;
    const voItemsSnap = await getDocs(collection(this.db, paths.boqVariationItems(this.companyId, boqId, voId)));
    const batch = writeBatch(this.db);
    
    // 1. Resolve current state for field mapping
    const stagesSnap = await getDocs(query(collection(this.db, paths.transactionStages(this.companyId, transactionId)), orderBy('order', 'asc')));
    let currentStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageInstance));
    const stagesToReopen = new Set<string>();

    // 2. Process items
    for (const itemDoc of voItemsSnap.docs) {
      const vItem = itemDoc.data() as BOQVariationItem;
      await this.processVariationItem(vItem, voData, transactionId, boqId, batch, currentStages, stagesToReopen);
    }

    // 3. Finalize
    if (stagesToReopen.size > 0) {
      this.reopenRelatedStages(currentStages, stagesToReopen, batch, transactionId);
    }

    batch.update(voRef, { status: 'approved', approvedBy: userId, approvedAt: serverTimestamp() });
    batch.update(doc(this.db, paths.boqs(this.companyId), boqId), { updatedAt: serverTimestamp() });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم اعتماد الأمر التغييري: ${voData.title}. تم تحديث الميزانية وتفعيل مراحل التنفيذ الموازية إن وجدت.`,
      userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  private async processVariationItem(
    vItem: BOQVariationItem, 
    voData: BOQVariation, 
    transactionId: string, 
    boqId: string, 
    batch: any, 
    currentStages: StageInstance[],
    stagesToReopen: Set<string>
  ) {
    let targetTechnicalStageId = vItem.technicalStageId || '';

    // Handle New Item Stage Injection
    if (vItem.type === 'new_item' && vItem.stageMode === 'new_local_stage') {
      targetTechnicalStageId = await this.injectManualStage(vItem, voData, transactionId, batch, currentStages);
    }

    // Handle BOQ Item Sync
    if (vItem.type !== 'new_item' && vItem.sourceBoqItemId) {
      await this.syncExistingItem(vItem, boqId, batch, stagesToReopen);
    } 
    else if (vItem.type === 'new_item') {
      await this.injectNewItemIntoBOQ(vItem, boqId, voData.id, targetTechnicalStageId, batch, stagesToReopen);
    }
  }

  private async injectManualStage(vItem: BOQVariationItem, voData: BOQVariation, transactionId: string, batch: any, currentStages: StageInstance[]) {
    const afterStage = currentStages.find(s => s.id === vItem.insertAfterStageId);
    const insertAtOrder = (afterStage?.order !== undefined) ? afterStage.order + 1 : currentStages.length;
    
    const newStageRef = doc(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
    const techId = `manual_${newStageRef.id}`;
    
    batch.set(newStageRef, {
      id: newStageRef.id,
      transactionId,
      technicalStageId: techId,
      code: vItem.localStageCode || `VO_INJ_${Math.floor(Math.random()*1000)}`,
      name: vItem.localStageName || vItem.description,
      status: 'pending',
      isTemporary: true,
      isComplementary: !!vItem.isComplementary,
      order: insertAtOrder,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // Update existing orders
    currentStages.forEach(s => {
      if (s.order >= insertAtOrder) {
        s.order += 1;
        batch.update(doc(this.db, paths.transactionStages(this.companyId, transactionId), s.id!), { order: s.order });
      }
    });

    return techId;
  }

  private async syncExistingItem(vItem: BOQVariationItem, boqId: string, batch: any, stagesToReopen: Set<string>) {
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), vItem.sourceBoqItemId!);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) return;
    const current = snap.data() as BOQItem;
    
    const newPlanned = Math.max(0, (current.plannedQuantity || 0) + (vItem.quantityDelta || 0));
    batch.update(itemRef, { 
      plannedQuantity: newPlanned,
      estimatedRate: Number(vItem.rate) || current.estimatedRate,
      updatedAt: serverTimestamp() 
    });

    if (newPlanned > (current.executedQuantity || 0)) {
      stagesToReopen.add(vItem.technicalStageId || current.technicalStageId || '');
    }
  }

  private async injectNewItemIntoBOQ(vItem: BOQVariationItem, boqId: string, voId: string, techId: string, batch: any, stagesToReopen: Set<string>) {
    const newRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
    batch.set(newRef, {
      id: newRef.id,
      boqId,
      referenceCode: 'VO-' + voId.slice(-4),
      referenceTitle: vItem.localStageName || vItem.description,
      plannedQuantity: Math.abs(Number(vItem.quantityDelta) || 0),
      executedQuantity: 0,
      estimatedRate: Number(vItem.rate) || 0,
      technicalStageId: techId,
      technicalStageIds: [techId],
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
    stagesToReopen.add(techId);
  }

  private reopenRelatedStages(stages: StageInstance[], technicalIds: Set<string>, batch: any, transactionId: string) {
    stages.forEach(s => {
      if (technicalIds.has(s.technicalStageId) && s.status === 'completed') {
        batch.update(doc(this.db, paths.transactionStages(this.companyId, transactionId), s.id!), { 
          status: 'in-progress', 
          completedAt: null, 
          completedBy: null 
        });
      }
    });
  }

  async rejectVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    await updateDoc(voRef, { status: 'cancelled', rejectedBy: userId, rejectedAt: serverTimestamp() });
  }
}
