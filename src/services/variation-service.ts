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
import { BOQVariation, BOQVariationItem, BOQVariationStatus, BOQItem } from '@/types/documents';
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
      updatedAt: serverTimestamp()
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
   * يعالج الحالات الأربع ويقوم بإعادة فتح المراحل إذا لزم الأمر.
   */
  async approveVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    const voItemsSnap = await getDocs(collection(this.db, paths.boqVariationItems(this.companyId, boqId, voId)));
    const voSnap = await getDoc(voRef);

    if (!voSnap.exists() || voSnap.data().status !== 'draft') throw new Error('VO_NOT_READY');
    const voData = voSnap.data() as BOQVariation;

    const batch = writeBatch(this.db);
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    
    // تتبع المراحل الفنية التي قد تحتاج لإعادة فتح (Re-opening)
    const stagesToReopen = new Set<string>();

    for (const itemDoc of voItemsSnap.docs) {
      const vItem = itemDoc.data() as BOQVariationItem;
      
      // الحالة 1 و 2 و 4: تعديل بند موجود
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

          // إذا كانت الكمية زادت، يجب فحص المرحلة لإعادة فتحها
          if (newPlanned > (currentItem.executedQuantity || 0)) {
            if (currentItem.technicalStageId) stagesToReopen.add(currentItem.technicalStageId);
          }
        }
      } 
      // الحالة 3: بند جديد تماماً
      else if (vItem.type === 'new_item') {
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
          unitName: vItem.unitName,
          unitSymbol: vItem.unitSymbol,
          technicalStageId: vItem.technicalStageId || '',
          technicalStageIds: vItem.technicalStageId ? [vItem.technicalStageId] : [],
          companyId: this.companyId,
          order: 999, // دائماً في النهاية كأعمال إضافية
          ancestorIds: [],
          depth: 0,
          createdAt: serverTimestamp()
        };
        batch.set(newRef, newItem);
        if (newItem.technicalStageId) stagesToReopen.add(newItem.technicalStageId);
      }
    }

    // إدارة حالات مراحل العمل (الميدان)
    if (stagesToReopen.size > 0) {
      const stagesColl = collection(this.db, paths.transactionStages(this.companyId, transactionId));
      const stagesSnap = await getDocs(stagesColl);
      
      stagesSnap.docs.forEach(sDoc => {
        const sData = sDoc.data();
        if (stagesToReopen.has(sData.technicalStageId) && sData.status === 'completed') {
          batch.update(sDoc.ref, { 
            status: 'in-progress', 
            completedAt: null, 
            completedBy: null,
            updatedAt: serverTimestamp() 
          });
        }
      });
    }

    // تحديث حالة الأمر التغييري والميزانية
    batch.update(voRef, { status: 'approved', approvedBy: userId, approvedAt: serverTimestamp() });
    batch.update(boqRef, { updatedAt: serverTimestamp() });

    // توثيق الحدث السيادي في التايم لاين
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    batch.add(doc(timelineRef), {
      transactionId,
      type: 'system',
      content: `اعتماد الأمر التغييري: ${voData.title}. تم تعديل النطاق الميداني وإعادة فتح المراحل المتأثرة.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  async getVariations(boqId: string): Promise<BOQVariation[]> {
    const q = query(collection(this.db, paths.boqVariations(this.companyId, boqId)), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariation));
  }
}
