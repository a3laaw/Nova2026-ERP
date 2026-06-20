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
import { Department, Job } from '@/types/reference';

export class DepartmentService {
  constructor(private db: Firestore, private companyId: string) {}

  addDepartment(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.departments(this.companyId);
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateDepartment(id: string, data: Partial<Department>) {
    const path = paths.departments(this.companyId);
    const docRef = doc(this.db, path, id);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data }));
    });
  }

  async deleteDepartment(id: string) {
    const path = paths.departments(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      const jobsRef = collection(this.db, paths.jobs(this.companyId, id));
      const jobsSnap = await getDocs(jobsRef);
      const batch = writeBatch(this.db);
      
      jobsSnap.docs.forEach(jobDoc => batch.delete(jobDoc.ref));
      batch.delete(docRef);
      
      await batch.commit().catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
      });
    } catch (err) {
      console.error("Delete department error:", err);
    }
  }

  addJob(deptId: string, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.jobs(this.companyId, deptId);
    const docData = { ...data, companyId: this.companyId, departmentId: deptId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    });
  }

  updateJob(deptId: string, jobId: string, data: Partial<Job>) {
    const path = paths.jobs(this.companyId, deptId);
    const docRef = doc(this.db, path, jobId);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data }));
    });
  }

  deleteJob(deptId: string, jobId: string) {
    const path = paths.jobs(this.companyId, deptId);
    const docRef = doc(this.db, path, jobId);
    
    deleteDoc(docRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    });
  }
}
