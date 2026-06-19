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
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';

/**
 * خدمة إدارة المسارات الفنية بالهيكل الرباعي الجديد.
 */
export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- 1. Activity Types (Replacing TransactionTypes) ---
  async addActivityType(data: Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.activityTypes(this.companyId);
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

  async updateActivityType(id: string, data: Partial<ActivityType>) {
    const path = paths.activityTypes(this.companyId);
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

  // --- 2. Services ---
  async addService(actId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    return addDoc(collection(this.db, path), {
      ...data,
      activityTypeId: actId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // --- 3. Sub Services ---
  async addSubService(actId: string, srvId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    return addDoc(collection(this.db, path), {
      ...data,
      activityTypeId: actId,
      serviceId: srvId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // --- 4. Technical Stages ---
  async addTechnicalStage(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    return addDoc(collection(this.db, path), {
      ...data,
      activityTypeId: actId,
      serviceId: srvId,
      subServiceId: subId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
