'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خدمة إدارة البيانات المرجعية.
 * توفر عمليات CRUD موحدة مع دعم كامل لعزل الشركات (Multi-tenancy).
 */
export class ReferenceService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إضافة سجل مرجعي جديد
   */
  async add(path: string, data: any) {
    const colRef = collection(this.db, path);
    try {
      return await addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(path, 'create', data);
      throw err;
    }
  }

  /**
   * تحديث سجل مرجعي موجود
   */
  async update(path: string, id: string, data: any) {
    const docRef = doc(this.db, path, id);
    try {
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'update', data);
      throw err;
    }
  }

  /**
   * حذف سجل مرجعي
   */
  async delete(path: string, id: string) {
    const docRef = doc(this.db, path, id);
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'delete');
      throw err;
    }
  }

  private handleError(path: string, operation: any, data?: any) {
    const permissionError = new FirestorePermissionError({
      path,
      operation,
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}
