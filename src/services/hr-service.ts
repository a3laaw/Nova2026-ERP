'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
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

  async getNextEmployeeNumber(): Promise<string> {
    try {
      const q = query(
        collection(this.db, paths.employees(this.companyId)), 
        orderBy('employeeNumber', 'desc'), 
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return "1001";
      const lastNum = parseInt(snap.docs[0].data().employeeNumber);
      return isNaN(lastNum) ? "1001" : (lastNum + 1).toString();
    } catch (e) {
      return "1001";
    }
  }

  /**
   * إضافة موظف جديد وربط بياناته بالهيكل المرجعي
   */
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

    // كتابة غير محظورة
    await setDoc(empRef, docData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'create',
        requestResourceData: docData
      }));
    });

    // المزامنة العالمية: الموظف يحمل الآن كود القسم وكود الدور
    if (data.email) {
      await this.syncGlobalUserData(data.email, data.roleId, data.departmentId);
    }

    return empRef.id;
  }

  /**
   * تحديث بيانات الموظف ومزامنة الهوية الأمنية
   */
  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    const oldSnap = await getDoc(empRef);
    if (!oldSnap.exists()) return;
    const oldData = oldSnap.data() as Employee;

    const updates = { ...newData, updatedAt: serverTimestamp() };
    
    await updateDoc(empRef, updates).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'update',
        requestResourceData: updates
      }));
    });

    // مزامنة التغييرات في القسم أو الدور فوراً
    if ((newData.roleId && newData.roleId !== oldData.roleId) || 
        (newData.departmentId && newData.departmentId !== oldData.departmentId)) {
      await this.syncGlobalUserData(
        newData.email || oldData.email!, 
        newData.roleId || oldData.roleId, 
        newData.departmentId || oldData.departmentId
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

  /**
   * وظيفة المزامنة السيادية:
   * تضمن أن "محرك الصلاحيات" يعرف القسم المرجعي والدور الأمني للموظف عند تسجيل الدخول.
   */
  private async syncGlobalUserData(email: string, roleId?: string, departmentId?: string) {
    try {
      const q = query(collection(this.db, 'global_users'), where('email', '==', email));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const globalUserRef = doc(this.db, 'global_users', snap.docs[0].id);
        await updateDoc(globalUserRef, {
          roleId: roleId || '',
          departmentId: departmentId || '', // تخزين ID القسم المرجعي (من مراجعك)
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn("Global security sync failed:", e);
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
