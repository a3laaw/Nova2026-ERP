'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
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
 * مسؤولة عن إدارة تعديلات النطاق المالي والكمي للمقايسات الحية.
 */
export class VariationService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إنشاء أمر تغييري جديد (VO) مع بنوده
   */
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

    // توثيق في السجل الزمني للمعاملة
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم إنشاء مسودة أمر تغييري جديد: ${data.title} بقيمة ${totalAmount.toLocaleString()} KWD`,
      userId,
      userName: 'Manager', 
      companyId: this.companyId,
      createdAt: serverTimestamp()
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
   * اعتماد الأمر التغييري وتحديث المقايسة الحية (The Engine)
   */
  async approveVariation(boqId: string, voId: string, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    const itemsRef = collection(this.db, paths.boqVariationItems(this.companyId, boqId, voId));
    
    const [voSnap, voItemsSnap] = await Promise.all([
      getDoc(voRef),
      getDocs(itemsRef)
    ]);

    if (!voSnap.exists()) throw new Error('VO_NOT_FOUND');
    const voData = voSnap.data() as BOQVariation;
    if (voData.status !== 'draft') throw new Error('ALREADY_PROCESSED');

    const batch = writeBatch(this.db);
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);

    // 1. معالجة البنود وتحديث المقايسة الحية
    for (const itemDoc of voItemsSnap.docs) {
      const vItem = itemDoc.data() as BOQVariationItem;
      
      if (vItem.type === 'increase_quantity' || vItem.type === 'decrease_quantity' || vItem.type === 'omit_item') {
        if (!vItem.sourceBoqItemId) continue;
        const boqItemRef = doc(this.db, paths.boqItems(this.companyId, boqId), vItem.sourceBoqItemId);
        const boqItemSnap = await getDoc(boqItemRef);
        
        if (boqItemSnap.exists()) {
          const currentPlanned = boqItemSnap.data().plannedQuantity || 0;
          const newPlanned = currentPlanned + (vItem.quantityDelta || 0);
          batch.update(boqItemRef, { 
            plannedQuantity: newPlanned,
            updatedAt: serverTimestamp() 
          });
        }
      } 
      else if (vItem.type === 'new_item') {
        const newBoqItemRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
        const newBoqItem: Partial<BOQItem> = {
          id: newBoqItemRef.id,
          boqId,
          transactionId,
          boqReferenceNodeId: vItem.boqReferenceNodeId,
          referenceCode: 'VO-' + (vItem.id?.slice(0,4) || 'NEW'),
          referenceTitle: vItem.description,
          plannedQuantity: vItem.quantityDelta,
          executedQuantity: 0,
          estimatedRate: vItem.rate,
          unitName: vItem.unitName,
          unitSymbol: vItem.unitSymbol,
          technicalStageId: vItem.technicalStageId || '',
          technicalStageIds: vItem.technicalStageId ? [vItem.technicalStageId] : [],
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        batch.set(newBoqItemRef, newBoqItem);
      }
    }

    // 2. تحديث رأس المقايسة (الميزانية الإجمالية)
    batch.update(boqRef, {
      totalAmount: (voData.totalAmount || 0) + (voData.totalAmount || 0), // حاصل الجمع سيتم تحديثه برمجياً بشكل أدق في الواجهة
      updatedAt: serverTimestamp()
    });

    // 3. تحديث حالة الأمر التغييري
    batch.update(voRef, {
      status: 'approved',
      approvedBy: userId,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 4. توثيق في التايم لاين
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    batch.add(doc(timelineRef), {
      transactionId,
      type: 'system',
      content: `تم اعتماد الأمر التغييري "${voData.title}" بنجاح. تم تحديث كميات المقايسة الحية.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  async updateVariationStatus(boqId: string, voId: string, transactionId: string, status: BOQVariationStatus, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    await updateDoc(voRef, { status, updatedBy: userId, updatedAt: serverTimestamp() });
  }

  async getVariations(boqId: string): Promise<BOQVariation[]> {
    const q = query(collection(this.db, paths.boqVariations(this.companyId, boqId)), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariation));
  }
}
