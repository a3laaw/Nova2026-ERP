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
import { Governorate, Area } from '@/types/reference';

export class LocationService {
  constructor(private db: Firestore, private companyId: string) {}

  async addGovernorate(data: Omit<Governorate, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.governorates(this.companyId);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateGovernorate(id: string, data: Partial<Governorate>) {
    const path = paths.governorates(this.companyId);
    const docRef = doc(this.db, path, id);
    
    return updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteGovernorate(id: string) {
    const path = paths.governorates(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      const areasRef = collection(this.db, paths.areas(this.companyId, id));
      const areasSnap = await getDocs(areasRef);
      const batch = writeBatch(this.db);
      
      // حذف كافة المناطق التابعة أولاً
      areasSnap.docs.forEach(areaDoc => batch.delete(areaDoc.ref));
      batch.delete(docRef);
      
      return await batch.commit().catch((err) => {
        this.handleError(docRef.path, 'delete');
        throw err;
      });
    } catch (err) {
      return deleteDoc(docRef).catch((e) => {
        this.handleError(docRef.path, 'delete');
        throw e;
      });
    }
  }

  async addArea(govId: string, data: Omit<Area, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.areas(this.companyId, govId);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      governorateId: govId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateArea(govId: string, areaId: string, data: Partial<Area>) {
    const path = paths.areas(this.companyId, govId);
    const docRef = doc(this.db, path, areaId);
    
    return updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteArea(govId: string, areaId: string) {
    const path = paths.areas(this.companyId, govId);
    const docRef = doc(this.db, path, areaId);
    
    return deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
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
