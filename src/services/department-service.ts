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
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    try {
      await addDoc(collection(this.db, path), docData);
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    }
  }

  async updateDepartment(id: string, data: Partial<Department>) {
    const path = paths.departments(this.companyId);
    try {
      await updateDoc(doc(this.db, path, id), { ...data, updatedAt: serverTimestamp() });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'update', requestResourceData: data }));
    }
  }

  async deleteDepartment(id: string) {
    const path = paths.departments(this.companyId);
    try {
      const jobsRef = collection(this.db, paths.jobs(this.companyId, id));
      const jobsSnap = await getDocs(jobsRef);
      const batch = writeBatch(this.db);
      jobsSnap.docs.forEach(jobDoc => batch.delete(jobDoc.ref));
      batch.delete(doc(this.db, path, id));
      await batch.commit();
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'delete' }));
    }
  }

  async addJob(deptId: string, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.jobs(this.companyId, deptId);
    const docData = { ...data, companyId: this.companyId, departmentId: deptId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    try {
      await addDoc(collection(this.db, path), docData);
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    }
  }

  async updateJob(deptId: string, jobId: string, data: Partial<Job>) {
    const path = paths.jobs(this.companyId, deptId);
    try {
      await updateDoc(doc(this.db, path, jobId), { ...data, updatedAt: serverTimestamp() });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${jobId}`, operation: 'update', requestResourceData: data }));
    }
  }

  async deleteJob(deptId: string, jobId: string) {
    const path = paths.jobs(this.companyId, deptId);
    try {
      await deleteDoc(doc(this.db, path, jobId));
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${jobId}`, operation: 'delete' }));
    }
  }
}
