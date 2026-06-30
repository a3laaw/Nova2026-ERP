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
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة الأوامر التغييرية (Variation Order Service).
 * مسؤولة عن إدارة التعديلات في الحالات الأربع: زيادة، نقص، بند جديد، حذف بند.
 */
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

    // جلب بيانات المقايسة للحصول على سياق المسار الفني
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const boqSnap = await getDoc(boqRef);
    const boqData = boqSnap.exists() ? boqSnap.data() as BOQ : null;

    const batch = writeBatch(this.db);
    const variationRef = doc(collection(this.db, paths.boqVariations(this.companyId, boqId)));
    const voId = variationRef.id;

    const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);

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
   * اعتماد الأمر التغييري وتعديل الواقع الميداني (The Sovereign Engine)
   */
  async approveVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    const voItemsSnap = await getDocs(collection(this.db, paths.boqVariationItems(this.companyId, boqId, voId)));
    const voSnap = await getDoc(voRef);

    if (!voSnap.exists() || voSnap.data().status !== 'draft') {
      throw new Error('VO_NOT_READY: هذا الأمر التغييري غير جاهز للاعتماد أو تم اعتماده مسبقاً.');
    }
    const voData = voSnap.data() as BOQVariation;

    const batch = writeBatch(this.db);
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    
    // جلب المراحل الحالية للمعاملة للتعامل مع الترتيب والحقن
    const stagesColl = collection(this.db, paths.transactionStages(this.companyId, transactionId));
    const stagesSnap = await getDocs(query(stagesColl, orderBy('order', 'asc')));
    let currentStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageInstance));

    const stagesToReopen = new Set<string>();

    for (const itemDoc of voItemsSnap.docs) {
      const vItem = itemDoc.data() as BOQVariationItem;
      if (!vItem.description) continue;

      let targetTechnicalStageId = vItem.technicalStageId || '';

      // الحالة: حقن مرحلة محلية جديدة
      if (vItem.type === 'new_item' && vItem.stageMode === 'new_local_stage' && vItem.localStageName) {
        const afterStage = currentStages.find(s => s.id === vItem.insertAfterStageId);
        const insertAtOrder = (afterStage?.order !== undefined) ? afterStage.order + 1 : currentStages.length;
        
        const newStageRef = doc(stagesColl);
        targetTechnicalStageId = `manual_${newStageRef.id}`;
        
        const newStageData: StageInstance = {
          id: newStageRef.id,
          transactionId,
          technicalStageId: targetTechnicalStageId,
          code: vItem.localStageCode || `MANUAL_${(insertAtOrder + 1).toString().padStart(2, '0')}`,
          name: vItem.localStageName,
          description: vItem.localStageNotes || 'مرحلة طارئة محقونة من أمر تغييري',
          order: insertAtOrder,
          isNumeric: false,
          numericTarget: 0,
          currentCount: 0,
          isTimed: false,
          timeTargetDays: 0,
          isRequired: true,
          isEditable: true,
          nextStageIds: [],
          status: 'pending',
          isTemporary: true,
          createdFromVO: true,
          originType: 'temporary_vo',
          companyId: this.companyId,
          activityTypeId: voData.activityTypeId || '',
          serviceId: voData.serviceId || '',
          subServiceId: voData.subServiceId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(newStageRef, newStageData);

        // إزاحة المراحل اللاحقة
        currentStages.forEach(s => {
          if (s.order >= insertAtOrder) {
            s.order += 1;
            batch.update(doc(this.db, stagesColl.path, s.id!), { order: s.order, updatedAt: serverTimestamp() });
          }
        });

        currentStages.push(newStageData);
        currentStages.sort((a, b) => a.order - b.order);
      }

      // تعديل بند موجود
      if (vItem.type !== 'new_item' && vItem.sourceBoqItemId) {
        const boqItemRef = doc(this.db, paths.boqItems(this.companyId, boqId), vItem.sourceBoqItemId);
        const itemSnap = await getDoc(boqItemRef);
        
        if (itemSnap.exists()) {
          const currentItem = itemSnap.data() as BOQItem;
          const newPlanned = Math.max(0, (currentItem.plannedQuantity || 0) + (vItem.quantityDelta || 0));
          
          batch.update(boqItemRef, { 
            plannedQuantity: newPlanned,
            estimatedRate: vItem.rate || currentItem.estimatedRate,
            updatedAt: serverTimestamp() 
          });

          if (newPlanned > (currentItem.executedQuantity || 0)) {
            const stageToOpen = vItem.technicalStageId || currentItem.technicalStageId;
            if (stageToOpen) stagesToReopen.add(stageToOpen);
          }
        }
      } 
      // بند جديد تماماً
      else if (vItem.type === 'new_item') {
        if (!targetTechnicalStageId) {
          throw new Error(`MISSING_STAGE: البند المستجد "${vItem.description}" لا يحتوي على مرحلة فنية مرتبطة.`);
        }

        const newRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
        const newItem: BOQItem = {
          id: newRef.id,
          boqId,
          transactionId,
          boqReferenceNodeId: vItem.boqReferenceNodeId || '',
          referenceCode: 'VO-' + voId.slice(-4),
          referenceTitle: vItem.description,
          plannedQuantity: vItem.quantityDelta,
          executedQuantity: 0,
          estimatedRate: vItem.rate,
          unitName: vItem.unitName || '',
          unitSymbol: vItem.unitSymbol || '',
          technicalStageId: targetTechnicalStageId,
          technicalStageIds: [targetTechnicalStageId],
          companyId: this.companyId,
          order: 999,
          ancestorIds: [],
          depth: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        batch.set(newRef, newItem);
        stagesToReopen.add(targetTechnicalStageId);
      }
    }

    if (stagesToReopen.size > 0) {
      currentStages.forEach(s => {
        if (stagesToReopen.has(s.technicalStageId) && s.status === 'completed') {
          batch.update(doc(this.db, stagesColl.path, s.id!), { 
            status: 'in-progress', 
            completedAt: null, 
            completedBy: null,
            updatedAt: serverTimestamp() 
          });
        }
      });
    }

    batch.update(voRef, { status: 'approved', approvedBy: userId, approvedAt: serverTimestamp() });
    batch.update(boqRef, { updatedAt: serverTimestamp() });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    const timelineDoc = doc(timelineRef);
    batch.set(timelineDoc, {
      transactionId,
      type: 'system',
      content: `اعتماد الأمر التغييري: ${voData.title}. تم تعديل النطاق الميداني وحقن/تحديث المراحل الفنية المتأثرة.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit().catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: voRef.path, operation: 'update'
        }));
        throw err;
    });
  }

  /**
   * رفض وإلغاء أمر تغييري
   */
  async rejectVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    
    await updateDoc(voRef, {
      status: 'cancelled',
      rejectedBy: userId,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    const timelineDoc = doc(timelineRef);
    await setDoc(timelineDoc, {
      transactionId,
      type: 'system',
      content: `إجراء إداري: تم رفض وإلغاء الأمر التغييري رقم ${voId.slice(-4)} من قبل الإدارة.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async getVariations(boqId: string): Promise<BOQVariation[]> {
    const q = query(collection(this.db, paths.boqVariations(this.companyId, boqId)), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariation));
  }
}
