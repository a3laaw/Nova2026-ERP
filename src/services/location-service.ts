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

  addGovernorate(data: Omit<Governorate, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.governorates(this.companyId);
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateGovernorate(id: string, data: Partial<Governorate>) {
    const path = paths.governorates(this.companyId);
    const docRef = doc(this.db, path, id);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data }));
    });
  }

  async deleteGovernorate(id: string) {
    const path = paths.governorates(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      const areasRef = collection(this.db, paths.areas(this.companyId, id));
      const areasSnap = await getDocs(areasRef);
      const batch = writeBatch(this.db);
      
      areasSnap.docs.forEach(areaDoc => batch.delete(areaDoc.ref));
      batch.delete(docRef);
      
      await batch.commit().catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
      });
    } catch (err) {
      console.error("Delete gov error:", err);
    }
  }

  addArea(govId: string, data: Omit<Area, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.areas(this.companyId, govId);
    const docData = { ...data, companyId: this.companyId, governorateId: govId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateArea(govId: string, areaId: string, data: Partial<Area>) {
    const path = paths.areas(this.companyId, govId);
    const docRef = doc(this.db, path, areaId);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data }));
    });
  }

  deleteArea(govId: string, areaId: string) {
    const path = paths.areas(this.companyId, govId);
    const docRef = doc(this.db, path, areaId);
    
    deleteDoc(docRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    });
  }
}
