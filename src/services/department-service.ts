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

  async addDepartment(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.departments(this.companyId);
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

  async updateDepartment(id: string, data: Partial<Department>) {
    const path = paths.departments(this.companyId);
    const docRef = doc(this.db, path, id);
    
    return updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
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
      return await batch.commit();
    } catch (err) {
      return deleteDoc(docRef).catch((e) => {
        this.handleError(docRef.path, 'delete');
        throw e;
      });
    }
  }

  async addJob(deptId: string, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.jobs(this.companyId, deptId);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      departmentId: deptId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    return addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
      throw err;
    });
  }

  async updateJob(deptId: string, jobId: string, data: Partial<Job>) {
    const path = paths.jobs(this.companyId, deptId);
    const docRef = doc(this.db, path, jobId);
    
    return updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  async deleteJob(deptId: string, jobId: string) {
    const path = paths.jobs(this.companyId, deptId);
    const docRef = doc(this.db, path, jobId);
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
