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
   * إضافة موظف جديد وربط بياناته بنظام الصلاحيات العالمي
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

    setDoc(empRef, docData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'create',
        requestResourceData: docData
      }));
    });

    // مزامنة القسم والدور مع السجل العالمي للمستخدم (لأغراض الصلاحيات)
    if (data.email) {
      this.syncGlobalUserData(data.email, data.roleId, data.departmentId);
    }

    return empRef.id;
  }

  /**
   * تحديث بيانات الموظف مع مزامنة صلاحياته
   */
  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    const oldSnap = await getDoc(empRef);
    if (!oldSnap.exists()) return;
    const oldData = oldSnap.data() as Employee;

    const updates = { ...newData, updatedAt: serverTimestamp() };
    
    updateDoc(empRef, updates).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'update',
        requestResourceData: updates
      }));
    });

    // تحديث السجل العالمي إذا تغير الدور أو القسم
    if ((newData.roleId && newData.roleId !== oldData.roleId) || 
        (newData.departmentId && newData.departmentId !== oldData.departmentId)) {
      this.syncGlobalUserData(newData.email || oldData.email!, newData.roleId || oldData.roleId, newData.departmentId || oldData.departmentId);
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

  async deleteEmployee(id: string) {
    ensureActionPermission(this.permissions, 'hr:delete');
    const empRef = doc(this.db, paths.employees(this.companyId), id);
    return deleteDoc(empRef);
  }

  /**
   * وظيفة حيوية: مزامنة بيانات "من أين يحصل المحرك على القسم"
   */
  private async syncGlobalUserData(email: string, roleId?: string, departmentId?: string) {
    try {
      const q = query(collection(this.db, 'global_users'), where('email', '==', email));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const globalUserRef = doc(this.db, 'global_users', snap.docs[0].id);
        updateDoc(globalUserRef, {
          roleId: roleId || '',
          departmentId: departmentId || '', // تخزين ID القسم من المراجع
          updatedAt: serverTimestamp()
        }).catch((err) => console.warn("Sync failed:", err.message));
      }
    } catch (e) {
      console.warn("Global sync error:", e);
    }
  }

  async terminateEmployee(id: string, reason: string, date: string, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const empRef = doc(this.db, paths.employees(this.companyId), id);
    const updateData = { status: 'terminated' as const, isActive: false, terminationReason: reason, terminationDate: date, updatedAt: serverTimestamp() };
    updateDoc(empRef, updateData);
    this.addAuditLog(id, { action: 'terminate', field: 'status', oldValue: 'active', newValue: 'terminated', changedBy: currentUser.uid, changedByName: currentUser.name });
  }

  private addAuditLog(employeeId: string, log: Omit<EmployeeAuditLog, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'employeeId'>) {
    const logPath = `${paths.employees(this.companyId)}/${employeeId}/auditLogs`;
    addDoc(collection(this.db, logPath), { ...log, employeeId, companyId: this.companyId, createdAt: serverTimestamp() });
  }
}
