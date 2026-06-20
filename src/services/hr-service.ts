
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
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
   * إضافة موظف جديد بنمط Non-blocking
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

    // تنفيذ غير محظور (No await)
    setDoc(empRef, docData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'create',
        requestResourceData: docData
      }));
    });

    if (data.email) {
      // تحديث الصلاحيات في الخلفية
      this.syncGlobalPermissions(data.email, data.roleId);
    }

    return empRef.id;
  }

  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.employees(this.companyId);
    const empRef = doc(this.db, path, id);

    // جلب البيانات القديمة للتدقيق (قراءة - مسموح بـ await)
    const oldSnap = await getDoc(empRef);
    if (!oldSnap.exists()) return;
    const oldData = oldSnap.data() as Employee;

    const updates = { ...newData, updatedAt: serverTimestamp() };
    
    // تحديث غير محظور
    updateDoc(empRef, updates).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: empRef.path,
        operation: 'update',
        requestResourceData: updates
      }));
    });

    if (newData.roleId && newData.roleId !== oldData.roleId && (newData.email || oldData.email)) {
      this.syncGlobalPermissions(newData.email || oldData.email!, newData.roleId);
    }

    // تسجيل في سجل التدقيق
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

  private async syncGlobalPermissions(email: string, roleId?: string) {
    if (!roleId) return;
    const q = query(collection(this.db, 'global_users'), where('email', '==', email));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const globalUserRef = doc(this.db, 'global_users', snap.docs[0].id);
      updateDoc(globalUserRef, {
        roleId: roleId,
        updatedAt: serverTimestamp()
      }).catch(() => {
        // حماية هادئة: قد لا يملك الأدمن صلاحية تعديل سجل المستخدم العالمي مباشرة
      });
    }
  }

  async terminateEmployee(id: string, reason: string, date: string, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const empRef = doc(this.db, paths.employees(this.companyId), id);

    const updateData = {
      status: 'terminated' as const,
      isActive: false,
      terminationReason: reason,
      terminationDate: date,
      updatedAt: serverTimestamp()
    };

    updateDoc(empRef, updateData).catch(() => {
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
}
