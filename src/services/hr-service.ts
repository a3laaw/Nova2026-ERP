'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Employee, EmployeeAuditLog } from '@/types/hr';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class HRService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async addEmployee(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    ensureActionPermission(this.permissions, 'hr:create');
    const path = paths.employees(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // تنفيذ غير محظور (Non-blocking)
    addDoc(collection(this.db, path), docData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
    });
  }

  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    try {
      const oldSnap = await getDoc(empRef);
      if (!oldSnap.exists()) throw new Error('Employee not found');
      const oldData = oldSnap.data() as Employee;

      const criticalFields: (keyof Employee)[] = ['basicSalary', 'jobTitle', 'departmentName', 'status', 'contractExpiry'];
      const updates: any = { ...newData, updatedAt: serverTimestamp() };
      
      // تحديث غير محظور
      updateDoc(empRef, updates).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: empRef.path,
          operation: 'update',
          requestResourceData: updates
        }));
      });

      for (const field of criticalFields) {
        if (newData[field] !== undefined && newData[field] !== oldData[field]) {
          this.addAuditLog(id, {
            action: 'update',
            field: field as string,
            oldValue: oldData[field] || 'None',
            newValue: newData[field],
            changedBy: currentUser.uid,
            changedByName: currentUser.name
          });
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async terminateEmployee(id: string, reason: string, date: string, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    const updateData = {
      status: 'terminated' as const,
      isActive: false,
      terminationReason: reason,
      terminationDate: date,
      updatedAt: serverTimestamp()
    };

    updateDoc(empRef, updateData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'update'
      }));
    });

    this.addAuditLog(id, {
      action: 'terminate',
      field: 'status',
      oldValue: 'active',
      newValue: 'terminated',
      changedBy: currentUser.uid,
      changedByName: currentUser.name
    });
  }

  private addAuditLog(employeeId: string, log: Omit<EmployeeAuditLog, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'employeeId'>) {
    const logPath = `${paths.employees(this.companyId)}/${employeeId}/auditLogs`;
    const logData = {
      ...log,
      employeeId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    addDoc(collection(this.db, logPath), logData);
  }

  async getEmployeeByNumber(empNumber: string) {
    const q = query(
      collection(this.db, paths.employees(this.companyId)), 
      where('employeeNumber', '==', empNumber)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Employee;
  }
}
