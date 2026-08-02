'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
} from 'firebase/firestore';
import { handleWriteError } from '@/lib/write-error';
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
    
    try {
      await addDoc(collRef, docData);
    } catch (err: any) {
      await handleWriteError(err, { path: collRef.path, operation: 'create', requestResourceData: docData });
    }
  }

  async updateGovernorate(id: string, data: Partial<Governorate>) {
    const path = paths.governorates(this.companyId);
    const docRef = doc(this.db, path, id);
    try {
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'update', requestResourceData: data });
    }
  }

  async deleteGovernorate(id: string) {
    const path = paths.governorates(this.companyId);
    const docRef = doc(this.db, path, id);
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'delete' });
    }
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
    
    try {
      await addDoc(collRef, docData);
    } catch (err: any) {
      await handleWriteError(err, { path: collRef.path, operation: 'create', requestResourceData: docData });
    }
  }

  async updateArea(govId: string, areaId: string, data: Partial<Area>) {
    const path = paths.areas(this.companyId, govId);
    const docRef = doc(this.db, path, areaId);
    try {
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'update', requestResourceData: data });
    }
  }

  async deleteArea(govId: string, areaId: string) {
    const path = paths.areas(this.companyId, govId);
    const docRef = doc(this.db, path, areaId);
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'delete' });
    }
  }
}
