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
  getDocs,
  query,
  orderBy,
  collectionGroup,
  where
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';

export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب كافة المراحل الفنية المعرفة للمنشأة (لأغراض الربط في القاموس)
   */
  async getAllCompanyStages(): Promise<TechnicalStage[]> {
    const q = query(
      collectionGroup(this.db, 'stages'),
      where('companyId', '==', this.companyId),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage));
  }

  async addActivityType(data: Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.activityTypes(this.companyId);
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateActivityType(id: string, data: Partial<ActivityType>) {
    const path = paths.activityTypes(this.companyId);
    const docRef = doc(this.db, path, id);
    return updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteActivityType(id: string) {
    const path = paths.activityTypes(this.companyId);
    const docRef = doc(this.db, path, id);
    return deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
      throw err;
    });
  }

  async addService(actId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    const docData = { ...data, activityTypeId: actId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateService(actId: string, srvId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    const docRef = doc(this.db, path, srvId);
    return updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteService(actId: string, srvId: string) {
    const path = paths.services(this.companyId, actId);
    const docRef = doc(this.db, path, srvId);
    return deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
      throw err;
    });
  }

  async addSubService(actId: string, srvId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateSubService(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docRef = doc(this.db, path, subId);
    return updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteSubService(actId: string, srvId: string, subId: string) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docRef = doc(this.db, path, subId);
    return deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
      throw err;
    });
  }

  async addTechnicalStage(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, subServiceId: subId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateTechnicalStage(actId: string, srvId: string, subId: string, stageId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docRef = doc(this.db, path, stageId);
    return updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteTechnicalStage(actId: string, srvId: string, subId: string, stageId: string) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docRef = doc(this.db, path, stageId);
    return deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
      throw err;
    });
  }

  async reorderStages(actId: string, srvId: string, subId: string, stages: TechnicalStage[]) {
    const batch = writeBatch(this.db);
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    
    stages.forEach((stage, index) => {
      if (stage.id) {
        const docRef = doc(this.db, path, stage.id);
        batch.update(docRef, { order: index, updatedAt: serverTimestamp() });
      }
    });

    return batch.commit().catch((err) => {
      this.handleError(path, 'update');
      throw err;
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
