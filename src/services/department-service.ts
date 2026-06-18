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

  async updateDepartment(id: string, data: Partial<Department>) {
    const path = paths.departments(this.companyId);
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

  async deleteDepartment(id: string) {
    const path = paths.departments(this.companyId);
    try {
      // تنبيه: الحذف الحقيقي يجب أن يشمل الوظائف التابعة له
      const jobsRef = collection(this.db, paths.jobs(this.companyId, id));
      const jobsSnap = await getDocs(jobsRef);
      
      const batch = writeBatch(this.db);
      jobsSnap.docs.forEach(jobDoc => batch.delete(jobDoc.ref));
      batch.delete(doc(this.db, path, id));
      
      await batch.commit();
    } catch (err: any) {
      this.handleError(`${path}/${id}`, 'delete');
      throw err;
    }
  }

  async addJob(deptId: string, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.jobs(this.companyId, deptId);
    try {
      return await addDoc(collection(this.db, path), {
        ...data,
        companyId: this.companyId,
        departmentId: deptId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(path, 'create', data);
      throw err;
    }
  }

  async updateJob(deptId: string, jobId: string, data: Partial<Job>) {
    const path = paths.jobs(this.companyId, deptId);
    try {
      await updateDoc(doc(this.db, path, jobId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      this.handleError(`${path}/${jobId}`, 'update', data);
      throw err;
    }
  }

  async deleteJob(deptId: string, jobId: string) {
    const path = paths.jobs(this.companyId, deptId);
    try {
      await deleteDoc(doc(this.db, path, jobId));
    } catch (err: any) {
      this.handleError(`${path}/${jobId}`, 'delete');
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
