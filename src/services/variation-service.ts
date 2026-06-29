'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  serverTimestamp, 
  query,
  orderBy,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQVariation, BOQVariationItem, BOQVariationStatus } from '@/types/documents';
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
      userName: 'Admin', // يمكن تمريره لاحقاً
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
   * تحديث حالة الأمر التغييري (اعتماد أو إلغاء)
   */
  async updateVariationStatus(boqId: string, voId: string, transactionId: string, status: BOQVariationStatus, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const voRef = doc(this.db, paths.boqVariations(this.companyId, boqId), voId);
    const updates: any = { status, updatedBy: userId, updatedAt: serverTimestamp() };

    if (status === 'approved') {
      updates.approvedBy = userId;
      updates.approvedAt = serverTimestamp();
    }

    await updateDoc(voRef, updates).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: voRef.path, operation: 'update'
      }));
      throw err;
    });

    // توثيق التغيير في التايم لاين
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم ${status === 'approved' ? 'اعتماد' : 'إلغاء'} الأمر التغييري رقم ${voId.slice(0, 5)}`,
      userId,
      userName: 'Admin',
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  /**
   * جلب كافة أوامر التغيير لمقايسة محددة
   */
  async getVariations(boqId: string): Promise<BOQVariation[]> {
    const q = query(
      collection(this.db, paths.boqVariations(this.companyId, boqId)),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariation));
  }
}
