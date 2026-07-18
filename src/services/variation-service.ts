
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
import { BOQVariation, BOQVariationItem, BOQItem, BOQ } from '@/types/documents';
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
   * اعتماد الأمر التغييري: حقن البنود والمراحل في المسار الفني والميزانية
   */
  async approveVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    const voSnap = await getDoc(voRef);

    if (!voSnap.exists() || voSnap.data().status !== 'draft') {
      throw new Error('VO_NOT_READY: الطلب ليس في حالة مسودة أو تم اعتماده مسبقاً.');
    }
    
    const voData = voSnap.data() as BOQVariation;
    const voItemsSnap = await getDocs(collection(this.db, paths.boqVariationItems(this.companyId, boqId, voId)));
    const batch = writeBatch(this.db);
    
    // جلب المراحل الحالية للترتيب والحقن
    const stagesSnap = await getDocs(query(collection(this.db, paths.transactionStages(this.companyId, transactionId)), orderBy('order', 'asc')));
    const currentStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageInstance));
    
    // تجميع المراحل التي تحتاج لإعادة فتح (Reopen) إذا أضيفت كميات جديدة لمرحلة مكتملة
    const stagesToReopen = new Set<string>();

    for (const itemDoc of voItemsSnap.docs) {
      const vItem = itemDoc.data() as BOQVariationItem;
      let techId = vItem.technicalStageId || '';

      // 1. حقن مرحلة محلية جديدة إذا طلب ذلك
      if (vItem.type === 'new_item' && vItem.stageMode === 'new_local_stage') {
        techId = await this.injectNewManualStage(batch, transactionId, vItem, currentStages);
      }

      // 2. تحديث بنود المقايسة
      if (vItem.type === 'new_item') {
        this.applyNewItemToBOQ(batch, boqId, transactionId, voId, vItem, techId);
        stagesToReopen.add(techId);
      } else if (vItem.sourceBoqItemId) {
        await this.applyQuantityChangeToBOQ(batch, boqId, vItem, stagesToReopen);
      }
    }

    // 3. إعادة فتح المراحل المكتملة المتأثرة بالتغيير
    this.reopenRequiredStages(batch, transactionId, currentStages, stagesToReopen);

    // 4. تحديث حالة الطلب
    batch.update(voRef, { status: 'approved', approvedBy: userId, approvedAt: serverTimestamp() });
    
    // 5. توثيق الاعتماد في التايم لاين
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم اعتماد الأمر التغييري: ${voData.title}. تم تحديث الميزانية وتفعيل مسارات التنفيذ المطلوبة.`,
      userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  private async injectNewManualStage(batch: any, transactionId: string, vItem: BOQVariationItem, currentStages: StageInstance[]): Promise<string> {
    const afterStage = currentStages.find(s => s.id === vItem.insertAfterStageId);
    const order = (afterStage?.order !== undefined) ? afterStage.order + 1 : currentStages.length;
    
    const stageRef = doc(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
    const techId = `manual_${stageRef.id}`;
    
    batch.set(stageRef, {
      id: stageRef.id,
      transactionId,
      technicalStageId: techId,
      code: vItem.localStageCode || `VO_INJ_${Math.floor(Math.random()*1000)}`,
      name: vItem.localStageName || vItem.description,
      status: 'pending',
      isTemporary: true,
      isComplementary: !!vItem.isComplementary,
      order: order,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // إزاحة المراحل التالية
    currentStages.forEach(s => {
      if (s.order >= order) {
        batch.update(doc(this.db, paths.transactionStages(this.companyId, transactionId), s.id!), { order: s.order + 1 });
      }
    });

    return techId;
  }

  private applyNewItemToBOQ(batch: any, boqId: string, transactionId: string, voId: string, vItem: BOQVariationItem, techId: string) {
    const itemRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
    batch.set(itemRef, {
      id: itemRef.id,
      boqId,
      transactionId,
      referenceCode: 'VO-' + voId.slice(-4),
      referenceTitle: vItem.description,
      plannedQuantity: Math.abs(Number(vItem.quantityDelta) || 0),
      executedQuantity: 0,
      estimatedRate: Number(vItem.rate) || 0,
      technicalStageId: techId,
      technicalStageIds: [techId],
      parentId: vItem.targetSectionId || null,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  private async applyQuantityChangeToBOQ(batch: any, boqId: string, vItem: BOQVariationItem, stagesToReopen: Set<string>) {
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), vItem.sourceBoqItemId!);
    const snap = await getDoc(itemRef);
    if (snap.exists()) {
      const current = snap.data() as BOQItem;
      const newPlanned = Math.max(0, (current.plannedQuantity || 0) + (Number(vItem.quantityDelta) || 0));
      batch.update(itemRef, { 
        plannedQuantity: newPlanned,
        estimatedRate: Number(vItem.rate) || current.estimatedRate,
        updatedAt: serverTimestamp() 
      });
      // إذا كانت الكمية الجديدة أكبر من المنفذ، نحتاج لفتح المرحلة مجدداً للعمل
      if (newPlanned > (current.executedQuantity || 0)) {
        stagesToReopen.add(vItem.technicalStageId || current.technicalStageId || '');
      }
    }
  }

  private reopenRequiredStages(batch: any, transactionId: string, currentStages: StageInstance[], stagesToReopen: Set<string>) {
    if (stagesToReopen.size > 0) {
      currentStages.forEach(s => {
        if (stagesToReopen.has(s.technicalStageId) && s.status === 'completed') {
          batch.update(doc(this.db, paths.transactionStages(this.companyId, transactionId), s.id!), { 
            status: 'in-progress', 
            completedAt: null, 
            completedBy: null 
          });
        }
      });
    }
  }

  async rejectVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    await updateDoc(voRef, { status: 'cancelled', rejectedBy: userId, rejectedAt: serverTimestamp() });
  }
}
