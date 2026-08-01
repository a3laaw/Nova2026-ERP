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
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';
import { Governorate, Area } from '@/types/reference';

export class LocationService {
  constructor(private db: Firestore, private companyId: string) {}

  async addGovernorate(data: Omit<Governorate, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.governorates(this.companyId);
    const collRef = collection(this.db, path);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    addDoc(collRef, docData).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: collRef.path,
        operation: 'create',
        requestResourceData: docData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async updateGovernorate(id: string, data: Partial<Governorate>) {
    const docRef = doc(this.db, paths.governorates(this.companyId), id);
    
    updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async deleteGovernorate(id: string) {
    const docRef = doc(this.db, paths.governorates(this.companyId), id);
    
    deleteDoc(docRef).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async addArea(govId: string, data: Omit<Area, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.areas(this.companyId, govId);
    const collRef = collection(this.db, path);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      governorateId: govId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    addDoc(collRef, docData).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: collRef.path,
        operation: 'create',
        requestResourceData: docData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async updateArea(govId: string, areaId: string, data: Partial<Area>) {
    const docRef = doc(this.db, paths.areas(this.companyId, govId), areaId);
    
    updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async deleteArea(govId: string, areaId: string) {
    const docRef = doc(this.db, paths.areas(this.companyId, govId), areaId);
    
    deleteDoc(docRef).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }
}