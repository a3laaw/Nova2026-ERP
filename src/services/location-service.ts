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
    updateDoc(doc(this.db, path, id), { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'update', requestResourceData: data }));
    });
  }

  async deleteGovernorate(id: string) {
    const path = paths.governorates(this.companyId);
    try {
      const areasRef = collection(this.db, paths.areas(this.companyId, id));
      const areasSnap = await getDocs(areasRef);
      const batch = writeBatch(this.db);
      areasSnap.docs.forEach(areaDoc => batch.delete(areaDoc.ref));
      batch.delete(doc(this.db, path, id));
      batch.commit().catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'delete' }));
      });
    } catch (err) {}
  }

  addArea(govId: string, data: Omit<Area, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.areas(this.companyId, govId);
    const docData = { ...data, companyId: this.companyId, governorateId: govId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }
}