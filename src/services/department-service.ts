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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';
import { Department, Job } from '@/types/reference';

export class DepartmentService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إضافة قسم جديد بنمط الكتابة غير المعطلة لضمان استقرار الواجهة.
   */
  async addDepartment(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.departments(this.companyId);
    const collRef = collection(this.db, path);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    // تنفيذ العملية بدون انتظار (Non-blocking) مع معالجة الخطأ سياقياً
    addDoc(collRef, docData).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: collRef.path,
        operation: 'create',
        requestResourceData: docData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async updateDepartment(id: string, data: Partial<Department>) {
    const docRef = doc(this.db, paths.departments(this.companyId), id);
    
    updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async deleteDepartment(id: string) {
    const docRef = doc(this.db, paths.departments(this.companyId), id);
    
    deleteDoc(docRef).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async addJob(deptId: string, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.jobs(this.companyId, deptId);
    const collRef = collection(this.db, path);
    const docData = { 
      ...data, 
      companyId: this.companyId, 
      departmentId: deptId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    
    addDoc(collRef, docData).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: collRef.path,
        operation: 'create',
        requestResourceData: docData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async updateJob(deptId: string, jobId: string, data: Partial<Job>) {
    const docRef = doc(this.db, paths.jobs(this.companyId, deptId), jobId);
    
    updateDoc(docRef, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  async deleteJob(deptId: string, jobId: string) {
    const docRef = doc(this.db, paths.jobs(this.companyId, deptId), jobId);
    
    deleteDoc(docRef).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  }
}