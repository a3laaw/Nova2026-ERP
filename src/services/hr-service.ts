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
  getDoc,
  setDoc,
  orderBy,
  limit
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

  /**
   * جلب الرقم التالي للموظف (تلقائي)
   */
  async getNextEmployeeNumber(): Promise<string> {
    const q = query(
      collection(this.db, paths.employees(this.companyId)), 
      orderBy('employeeNumber', 'desc'), 
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return "1001";
    const lastNum = parseInt(snap.docs[0].data().employeeNumber);
    return isNaN(lastNum) ? "1001" : (lastNum + 1).toString();
  }

  /**
   * إضافة موظف جديد مع تحديث السجل العالمي (Global User) للصلاحيات
   */
  async addEmployee(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    ensureActionPermission(this.permissions, 'hr:create');
    const path = paths.employees(this.companyId);
    
    // 1. إضافة الموظف لسجل الشركة
    const docData = {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const empRef = await addDoc(collection(this.db, path), docData);

      // 2. تحديث السجل العالمي إذا وجد موثق (Email match) لتمكينه من الدخول بالصلاحيات
      if (data.email) {
        await this.syncGlobalPermissions(data.email, data.roleId);
      }

      return empRef.id;
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
      throw err;
    }
  }

  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    try {
      const oldSnap = await getDoc(empRef);
      if (!oldSnap.exists()) throw new Error('Employee not found');
      const oldData = oldSnap.data() as Employee;

      const criticalFields: (keyof Employee)[] = ['basicSalary', 'jobTitle', 'departmentName', 'status', 'roleId'];
      const updates: any = { ...newData, updatedAt: serverTimestamp() };
      
      await updateDoc(empRef, updates);

      // إذا تغير الدور، نقوم بتحديث السجل العالمي فوراً
      if (newData.roleId && newData.roleId !== oldData.roleId && (newData.email || oldData.email)) {
        await this.syncGlobalPermissions(newData.email || oldData.email!, newData.roleId);
      }

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

  /**
   * دالة سحرية لربط الدور المكتسب من الوظيفة بسجل المستخدم العالمي
   */
  private async syncGlobalPermissions(email: string, roleId?: string) {
    if (!roleId) return;

    const globalUsersRef = collection(this.db, 'global_users');
    const q = query(globalUsersRef, where('email', '==', email));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const globalUserRef = doc(this.db, 'global_users', snap.docs[0].id);
      await updateDoc(globalUserRef, {
        roleId: roleId,
        updatedAt: serverTimestamp()
      });
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

    await updateDoc(empRef, updateData);

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