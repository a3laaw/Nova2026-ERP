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
import { Department, Job } from '@/types/reference';

export class DepartmentService {
  constructor(private db: Firestore, private companyId: string) {}

  async addDepartment(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.departments(this.companyId);
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

  async updateDepartment(id: string, data: Partial<Department>) {
    const path = paths.departments(this.companyId);
    const docRef = doc(this.db, path, id);
    try {
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'update', requestResourceData: data });
    }
  }

  async deleteDepartment(id: string) {
    const path = paths.departments(this.companyId);
    const docRef = doc(this.db, path, id);
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'delete' });
    }
  }

  async addJob(deptId: string, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.jobs(this.companyId, deptId);
    const collRef = collection(this.db, path);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      departmentId: deptId, 
      roleId: data.roleId || '',
      roleCode: data.roleCode || '',
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    try {
      await addDoc(collRef, docData);
    } catch (err: any) {
      await handleWriteError(err, { path: collRef.path, operation: 'create', requestResourceData: docData });
    }
  }

  async updateJob(deptId: string, jobId: string, data: Partial<Job>) {
    const path = paths.jobs(this.companyId, deptId);
    const docRef = doc(this.db, path, jobId);
    try {
      await updateDoc(docRef, { 
        ...data, 
        roleId: data.roleId || '',
        roleCode: data.roleCode || '',
        updatedAt: serverTimestamp() 
      });
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'update', requestResourceData: data });
    }
  }

  async deleteJob(deptId: string, jobId: string) {
    const path = paths.jobs(this.companyId, deptId);
    const docRef = doc(this.db, path, jobId);
    try {
      await deleteDoc(docRef);
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'delete' });
    }
  }
}
