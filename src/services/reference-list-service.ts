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
  orderBy
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
 * تدعم الـ Multi-tenancy والضخ الأولي للبيانات.
 */
export class ReferenceListService {
  constructor(private db: Firestore, private companyId: string) {}

  private getCollectionPath(type: ReferenceListType) {
    return paths[type](this.companyId);
  }

  async list(type: ReferenceListType): Promise<BaseReferenceList[]> {
    const q = query(collection(this.db, this.getCollectionPath(type)), orderBy('order'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BaseReferenceList));
  }

  async add(type: ReferenceListType, data: Partial<BaseReferenceList>, userId: string) {
    const path = this.getCollectionPath(type);
    const docData = {
      ...data,
      companyId: this.companyId,
      isSystem: false,
      isEditable: true,
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return addDoc(collection(this.db, path), docData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path, operation: 'create', requestResourceData: docData
      }));
      throw err;
    });
  }

  async update(type: ReferenceListType, id: string, data: Partial<BaseReferenceList>, userId: string) {
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    
    // فحص القابلية للتعديل (الأمان الميداني)
    const snap = await getDocs(query(collection(this.db, path)));
    const target = snap.docs.find(d => d.id === id)?.data() as BaseReferenceList;
    
    if (target && !target.isEditable) {
      throw new Error('SYSTEM_PROTECTED: لا يمكن تعديل هذا السجل لأنه جزء من نواة النظام.');
    }

    return updateDoc(docRef, {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });
  }

  async delete(type: ReferenceListType, id: string) {
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    return deleteDoc(docRef);
  }

  /**
   * ضخ البيانات الأولية للقوائم المرجعية لشركة معينة.
   * يتم استدعاء هذه الدالة عند إنشاء الشركة أو عبر أداة التهيئة.
   */
  async seedAllLists(userId: string) {
    const batch = writeBatch(this.db);
    const listTypes: ReferenceListType[] = [
      'unitTypes', 'paymentMethods', 'paymentConditionTypes', 
      'milestoneTimingTypes', 'itemCategories', 'costTypeCategories'
    ];

    for (const type of listTypes) {
      const collRef = collection(this.db, this.getCollectionPath(type));
      const sourceData = SEED_DATA[type as keyof typeof SEED_DATA] as any[];

      if (sourceData) {
        sourceData.forEach(item => {
          const newRef = doc(collRef);
          batch.set(newRef, {
            ...item,
            companyId: this.companyId,
            isSystem: true,
            isEditable: type !== 'milestoneTimingTypes', // التوقيت (at, during, after) غير قابل للتعديل
            isActive: true,
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
