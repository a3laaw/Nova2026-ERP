'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';
import { TransactionType, SubService } from '@/types/reference';

export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- Transaction Types ---
  async addTransactionType(data: Omit<TransactionType, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.transactionTypes(this.companyId);
    try {
      return await addDoc(collection(this.db, path), {
        ...data,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(path, 'create', data);
      throw err;
    }
  }

  async updateTransactionType(id: string, data: Partial<TransactionType>) {
    const path = paths.transactionTypes(this.companyId);
    try {
      await updateDoc(doc(this.db, path, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'update', data);
      throw err;
    }
  }

  async deleteTransactionType(id: string) {
    const path = paths.transactionTypes(this.companyId);
    try {
      // الحذف المتتالي للخدمات الفرعية
      const subsRef = collection(this.db, paths.subServices(this.companyId, id));
      const subsSnap = await getDocs(subsRef);
      
      const batch = writeBatch(this.db);
      subsSnap.docs.forEach(subDoc => batch.delete(subDoc.ref));
      batch.delete(doc(this.db, path, id));
      
      await batch.commit();
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'delete');
      throw err;
    }
  }

  // --- Sub Services ---
  async addSubService(txId: string, data: Omit<SubService, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.subServices(this.companyId, txId);
    try {
      return await addDoc(collection(this.db, path), {
        ...data,
        companyId: this.companyId,
        transactionTypeId: txId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(path, 'create', data);
      throw err;
    }
  }

  async updateSubService(txId: string, subId: string, data: Partial<SubService>) {
    const path = paths.subServices(this.companyId, txId);
    try {
      await updateDoc(doc(this.db, path, subId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(`${path}/${subId}`, 'update', data);
      throw err;
    }
  }

  async deleteSubService(txId: string, subId: string) {
    const path = paths.subServices(this.companyId, txId);
    try {
      await deleteDoc(doc(this.db, path, subId));
    } catch (err: any) {
      this.handleError(`${path}/${subId}`, 'delete');
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
