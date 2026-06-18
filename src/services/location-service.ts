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

  async updateGovernorate(id: string, data: Partial<Governorate>) {
    const path = paths.governorates(this.companyId);
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

  async deleteGovernorate(id: string) {
    const path = paths.governorates(this.companyId);
    try {
      const areasRef = collection(this.db, paths.areas(this.companyId, id));
      const areasSnap = await getDocs(areasRef);
      
      const batch = writeBatch(this.db);
      areasSnap.docs.forEach(areaDoc => batch.delete(areaDoc.ref));
      batch.delete(doc(this.db, path, id));
      
      await batch.commit();
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'delete');
      throw err;
    }
  }

  async addArea(govId: string, data: Omit<Area, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.areas(this.companyId, govId);
    try {
      return await addDoc(collection(this.db, path), {
        ...data,
        companyId: this.companyId,
        governorateId: govId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(path, 'create', data);
      throw err;
    }
  }

  async updateArea(govId: string, areaId: string, data: Partial<Area>) {
    const path = paths.areas(this.companyId, govId);
    try {
      await updateDoc(doc(this.db, path, areaId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(`${path}/${areaId}`, 'update', data);
      throw err;
    }
  }

  async deleteArea(govId: string, areaId: string) {
    const path = paths.areas(this.companyId, govId);
    try {
      await deleteDoc(doc(this.db, path, areaId));
    } catch (err: any) {
      this.handleError(`${path}/${areaId}`, 'delete');
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
