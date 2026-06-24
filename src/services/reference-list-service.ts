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
  getDoc,
  setDoc
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
  | 'costTypeCategories'
  | string; // دعم القوائم المخصصة

/**
 * خدمة إدارة القوائم المرجعية الموحدة والقابلة للتوسعة.
 */
export class ReferenceListService {
  constructor(private db: Firestore, private companyId: string) {}

  private getCollectionPath(type: ReferenceListType): string {
    // إذا كانت من القوائم الأساسية المعروفة
    if (paths[type as keyof typeof paths] && typeof paths[type as keyof typeof paths] === 'function') {
      return (paths[type as keyof typeof paths] as Function)(this.companyId);
    }
    // إذا كانت قائمة مخصصة (Custom List)
    return `companies/${this.companyId}/customReferenceLists/${type}/items`;
  }

  /**
   * جلب تعريفات القوائم المخصصة
   */
  async getCustomListsMetadata() {
    const q = query(collection(this.db, `companies/${this.companyId}/customReferenceLists`), orderBy('order'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * إنشاء تعريف لقائمة مرجعية جديدة بالكامل
   */
  async createCustomList(data: { code: string, name: string, nameEn: string, icon?: string, order: number }, userId: string) {
    const docRef = doc(this.db, `companies/${this.companyId}/customReferenceLists`, data.code);
    const docData = {
      ...data,
      companyId: this.companyId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, docData);
    return data.code;
  }

  /**
   * جلب كافة عناصر القائمة مرتبة
   */
  async list(type: ReferenceListType): Promise<BaseReferenceList[]> {
    const path = this.getCollectionPath(type);
    const q = query(
      collection(this.db, path), 
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
   * تحديث عنصر مرجعي
   */
  async update(type: ReferenceListType, id: string, data: Partial<BaseReferenceList>, userId: string) {
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    
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
      throw new Error('SYSTEM_PROTECTED');
    }

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
      throw new Error('SYSTEM_PROTECTED');
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
   * ضخ البيانات الأولية للقوائم المرجعية
   */
  async seedAllLists(userId: string) {
    const batch = writeBatch(this.db);
    const listTypes: string[] = [
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
            isEditable: type !== 'milestoneTimingTypes',
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
