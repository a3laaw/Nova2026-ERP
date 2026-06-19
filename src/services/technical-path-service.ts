'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';

/**
 * خدمة إدارة المسارات الفنية بالهيكل الرباعي.
 */
export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- 1. Activity Types ---
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

  async deleteActivityType(id: string) {
    const path = paths.activityTypes(this.companyId);
    try {
      await deleteDoc(doc(this.db, path, id));
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'delete');
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

  async updateService(actId: string, srvId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    return updateDoc(doc(this.db, path, srvId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteService(actId: string, srvId: string) {
    const path = paths.services(this.companyId, actId);
    return deleteDoc(doc(this.db, path, srvId));
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

  async updateSubService(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    return updateDoc(doc(this.db, path, subId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteSubService(actId: string, srvId: string, subId: string) {
    const path = paths.subServices(this.companyId, actId, srvId);
    return deleteDoc(doc(this.db, path, subId));
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

  async updateTechnicalStage(actId: string, srvId: string, subId: string, stageId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    return updateDoc(doc(this.db, path, stageId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteTechnicalStage(actId: string, srvId: string, subId: string, stageId: string) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    return deleteDoc(doc(this.db, path, stageId));
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
