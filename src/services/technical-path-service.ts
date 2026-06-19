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

export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- 1. Activity Types ---
  addActivityType(data: Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.activityTypes(this.companyId);
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateActivityType(id: string, data: Partial<ActivityType>) {
    const path = paths.activityTypes(this.companyId);
    updateDoc(doc(this.db, path, id), { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'update', requestResourceData: data }));
    });
  }

  deleteActivityType(id: string) {
    const path = paths.activityTypes(this.companyId);
    deleteDoc(doc(this.db, path, id)).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'delete' }));
    });
  }

  // --- 2. Services ---
  addService(actId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    const docData = { ...data, activityTypeId: actId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateService(actId: string, srvId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    updateDoc(doc(this.db, path, srvId), { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${srvId}`, operation: 'update', requestResourceData: data }));
    });
  }

  deleteService(actId: string, srvId: string) {
    const path = paths.services(this.companyId, actId);
    deleteDoc(doc(this.db, path, srvId)).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${srvId}`, operation: 'delete' }));
    });
  }

  // --- 3. Sub Services ---
  addSubService(actId: string, srvId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateSubService(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    updateDoc(doc(this.db, path, subId), { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${subId}`, operation: 'update', requestResourceData: data }));
    });
  }

  deleteSubService(actId: string, srvId: string, subId: string) {
    const path = paths.subServices(this.companyId, actId, srvId);
    deleteDoc(doc(this.db, path, subId)).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${subId}`, operation: 'delete' }));
    });
  }

  // --- 4. Technical Stages ---
  addTechnicalStage(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, subServiceId: subId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateTechnicalStage(actId: string, srvId: string, subId: string, stageId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    updateDoc(doc(this.db, path, stageId), { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${stageId}`, operation: 'update', requestResourceData: data }));
    });
  }

  deleteTechnicalStage(actId: string, srvId: string, subId: string, stageId: string) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    deleteDoc(doc(this.db, path, stageId)).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${stageId}`, operation: 'delete' }));
    });
  }
}
