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
import { TransactionType, SubService, TechnicalStage } from '@/types/reference';

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
      // الحذف المتتالي للخدمات الفرعية والمراحل
      const subsRef = collection(this.db, paths.subServices(this.companyId, id));
      const subsSnap = await getDocs(subsRef);
      
      const batch = writeBatch(this.db);
      for (const subDoc of subsSnap.docs) {
        const stagesRef = collection(this.db, paths.technicalStages(this.companyId, id, subDoc.id));
        const stagesSnap = await getDocs(stagesRef);
        stagesSnap.docs.forEach(stageDoc => batch.delete(stageDoc.ref));
        batch.delete(subDoc.ref);
      }
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
      const stagesRef = collection(this.db, paths.technicalStages(this.companyId, txId, subId));
      const stagesSnap = await getDocs(stagesRef);
      const batch = writeBatch(this.db);
      stagesSnap.docs.forEach(stageDoc => batch.delete(stageDoc.ref));
      batch.delete(doc(this.db, path, subId));
      await batch.commit();
    } catch (err: any) {
      this.handleError(`${path}/${subId}`, 'delete');
      throw err;
    }
  }

  // --- Technical Stages ---
  async addTechnicalStage(txId: string, subId: string, data: Omit<TechnicalStage, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.technicalStages(this.companyId, txId, subId);
    try {
      return await addDoc(collection(this.db, path), {
        ...data,
        companyId: this.companyId,
        transactionTypeId: txId,
        subServiceId: subId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(path, 'create', data);
      throw err;
    }
  }

  async updateTechnicalStage(txId: string, subId: string, stageId: string, data: Partial<TechnicalStage>) {
    const path = paths.technicalStages(this.companyId, txId, subId);
    try {
      await updateDoc(doc(this.db, path, stageId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(`${path}/${stageId}`, 'update', data);
      throw err;
    }
  }

  async deleteTechnicalStage(txId: string, subId: string, stageId: string) {
    const path = paths.technicalStages(this.companyId, txId, subId);
    try {
      await deleteDoc(doc(this.db, path, stageId));
    } catch (err: any) {
      this.handleError(`${path}/${stageId}`, 'delete');
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
