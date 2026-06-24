'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  getDocs,
  writeBatch,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BaseReferenceList } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { SEED_DATA } from '@/lib/seed-data';

export type ReferenceListType = 
  | 'unitTypes' 
  | 'paymentMethods' 
  | 'paymentConditionTypes' 
  | 'milestoneTimingTypes' 
  | 'itemCategories' 
  | 'costTypeCategories';

/**
 * خدمة إدارة القوائم المرجعية الموحدة والقابلة للتوسعة.
 * توفر عمليات CRUD سيادية مع احترام قواعد الحماية الميدانية.
 */
export class ReferenceListService {
  constructor(private db: Firestore, private companyId: string) {}

  private getCollectionPath(type: ReferenceListType): string {
    return paths[type](this.companyId);
  }

  /**
   * جلب كافة عناصر القائمة مرتبة
   */
  async list(type: ReferenceListType): Promise<BaseReferenceList[]> {
    const q = query(
      collection(this.db, this.getCollectionPath(type)), 
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BaseReferenceList));
  }

  /**
   * إضافة عنصر مرجعي جديد
   */
  async add(type: ReferenceListType, data: Partial<BaseReferenceList>, userId: string) {
    const path = this.getCollectionPath(type);
    const docData: any = {
      ...data,
      companyId: this.companyId,
      isSystem: data.isSystem ?? false,
      isEditable: data.isEditable ?? true,
      isActive: data.isActive ?? true,
      order: data.order ?? 0,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return addDoc(collection(this.db, path), docData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
      throw err;
    });
  }

  /**
   * تحديث عنصر مرجعي مع التحقق من قابلية التعديل
   */
  async update(type: ReferenceListType, id: string, data: Partial<BaseReferenceList>, userId: string) {
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    
    // 1. جلب السجل الحالي للتحقق من isEditable
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('NOT_FOUND');
    const current = snap.data() as BaseReferenceList;

    if (!current.isEditable) {
      const error = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
      });
      errorEmitter.emit('permission-error', error);
      throw new Error('SYSTEM_PROTECTED: لا يمكن تعديل هذا السجل النظامي.');
    }

    // 2. التنفيذ
    return updateDoc(docRef, {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    }).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
      }));
      throw err;
    });
  }

  /**
   * حذف عنصر مرجعي
   */
  async delete(type: ReferenceListType, id: string) {
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);

    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const current = snap.data() as BaseReferenceList;

    if (current.isSystem && !current.isEditable) {
      throw new Error('SYSTEM_PROTECTED: لا يمكن حذف العناصر النظامية الأساسية.');
    }

    return deleteDoc(docRef).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete'
      }));
      throw err;
    });
  }

  /**
   * ضخ البيانات الأولية للقوائم المرجعية (Seeding)
   */
  async seedAllLists(userId: string) {
    const batch = writeBatch(this.db);
    const listTypes: ReferenceListType[] = [
      'unitTypes', 'paymentMethods', 'paymentConditionTypes', 
      'milestoneTimingTypes', 'itemCategories', 'costTypeCategories'
    ];

    for (const type of listTypes) {
      const collPath = this.getCollectionPath(type);
      const collRef = collection(this.db, collPath);
      const sourceData = (SEED_DATA as any)[type] as any[];

      if (sourceData) {
        sourceData.forEach((item, idx) => {
          const newRef = doc(collRef);
          batch.set(newRef, {
            ...item,
            companyId: this.companyId,
            isSystem: true,
            isEditable: type !== 'milestoneTimingTypes', // التوقيت غير قابل للتعديل عادة
            isActive: true,
            order: idx + 1,
            createdBy: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
      }
    }

    return batch.commit();
  }
}
