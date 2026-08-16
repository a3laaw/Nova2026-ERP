'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  serverTimestamp, 
  query,
  where,
  getDocs,
  getDoc,
  addDoc
} from 'firebase/firestore';
import { handleWriteError } from '@/lib/write-error';
import { nextSequential } from '@/lib/counters';
import { paths } from '@/firebase/multi-tenant';
import { Employee, EmployeeAuditLog } from '@/types/hr';
import { ensureActionPermission } from '@/lib/permissions';
import { AccountingService } from './accounting-service';

/**
 * خدمة الموارد البشرية السيادية (Sovereign HR Service).
 * تم التحديث (IFRS 8): الموظف يمتلك مركز تكلفة فقط، ولا يولد مركز ربحية تلقائياً.
 */
export class HRService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async getNextEmployeeNumber(): Promise<string> {
    const num = await nextSequential(this.db, this.companyId, 'employee', '', 0, 1000);
    return num;
  }

  async addEmployee(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    ensureActionPermission(this.permissions, 'hr:create');
    
    const path = paths.employees(this.companyId);
    const empRef = doc(collection(this.db, path));
    const docData = {
      ...data,
      id: empRef.id,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(empRef, docData);
      
      // الأتمتة السيادية (IFRS 8 Alignment): إنشاء مركز تكلفة فقط للموظف
      const accService = new AccountingService(this.db, this.companyId);
      
      // إنشاء مركز تكلفة: لمطاردة الرواتب والمصاريف الإدارية للموظف
      await accService.createAutomaticCostCenter(
        empRef.id, 
        `تكلفة الموظف: ${data.fullName}`, 
        `CC-EMP-${data.employeeNumber}`
      );

    } catch (err: any) {
      await handleWriteError(err, { path: empRef.path, operation: 'create', requestResourceData: docData });
    }

    if (data.email) {
      await this.syncGlobalUserData(data.email, data.roleId, data.departmentId, data.fullName);
    }

    return empRef.id;
  }

  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    const oldSnap = await getDoc(empRef);
    if (!oldSnap.exists()) return;
    const oldData = oldSnap.data() as Employee;

    const updates = { ...newData, updatedAt: serverTimestamp() };
    
    try {
      await updateDoc(empRef, updates);
    } catch (err: any) {
      await handleWriteError(err, { path: empRef.path, operation: 'update', requestResourceData: updates });
    }

    if ((newData.roleId && newData.roleId !== oldData.roleId) || 
        (newData.departmentId && newData.departmentId !== oldData.departmentId) ||
        (newData.fullName && newData.fullName !== oldData.fullName)) {
      await this.syncGlobalUserData(
        newData.email || oldData.email!, 
        newData.roleId || oldData.roleId, 
        newData.departmentId || oldData.departmentId,
        newData.fullName || oldData.fullName
      );
    }

    const criticalFields: (keyof Employee)[] = ['basicSalary', 'jobTitle', 'departmentName', 'status', 'roleId'];
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
  }

  private async syncGlobalUserData(email: string, roleId?: string, departmentId?: string, fullName?: string) {
    try {
      const q = query(collection(this.db, 'global_users'), where('email', '==', email));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const globalUserRef = doc(this.db, 'global_users', snap.docs[0].id);
        const updates: any = {
          updatedAt: serverTimestamp()
        };

        if (fullName) updates.fullName = fullName;
        if (departmentId) updates.departmentId = departmentId;
        
        if (roleId) {
          updates.roleId = roleId;
          const roleSnap = await getDoc(doc(this.db, 'companies', this.companyId, 'roles', roleId));
          if (roleSnap.exists()) {
             const codeUpper = String(roleSnap.data().code).toUpperCase();
             updates.roleCode = codeUpper; 
             updates.role = codeUpper.toLowerCase(); 
          }
        } else {
          updates.roleId = "";
          updates.roleCode = "USER";
          updates.role = "user";
        }

        await updateDoc(globalUserRef, updates);
      }
    } catch (e) {
      console.warn("Security sync bypass:", e);
    }
  }

  async deleteEmployee(id: string) {
    ensureActionPermission(this.permissions, 'hr:delete');
    const empRef = doc(this.db, paths.employees(this.companyId), id);
    return deleteDoc(empRef);
  }

  async terminateEmployee(id: string, reason: string, date: string, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const empRef = doc(this.db, paths.employees(this.companyId), id);
    const updateData = { status: 'terminated' as const, isActive: false, terminationReason: reason, terminationDate: date, updatedAt: serverTimestamp() };
    await updateDoc(empRef, updateData);
    this.addAuditLog(id, { action: 'terminate', field: 'status', oldValue: 'active', newValue: 'terminated', changedBy: currentUser.uid, changedByName: currentUser.name });
  }

  private addAuditLog(employeeId: string, log: Omit<EmployeeAuditLog, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'employeeId'>) {
    const logPath = `${paths.employees(this.companyId)}/${employeeId}/auditLogs`;
    addDoc(collection(this.db, logPath), { ...log, employeeId, companyId: this.companyId, createdAt: serverTimestamp() });
  }
}