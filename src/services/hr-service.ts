
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
import { WorkingDaysService } from './working-days-service';
import { WorkHoursService } from './work-hours-service';

export class HRService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async getNextEmployeeNumber(): Promise<string> {
    return await nextSequential(this.db, this.companyId, 'employee', '', 0, 1000);
  }

  async addEmployee(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    ensureActionPermission(this.permissions, 'hr:create');
    const path = paths.employees(this.companyId);
    const empRef = doc(collection(this.db, path));
    const docData = { ...data, id: empRef.id, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

    try {
      await setDoc(empRef, docData);
      
      // الأتمتة المالية السيادية: إنشاء مركز تكلفة للموظف فور تعيينه
      const accService = new AccountingService(this.db, this.companyId);
      await accService.createAutomaticCostCenter(
        empRef.id, 
        `تكلفة الموظف: ${data.fullName}`, 
        `Staff Cost: ${data.nameEn || data.fullName}`,
        `CC-EMP-${data.employeeNumber}`
      );

    } catch (err: any) {
      await handleWriteError(err, { path: empRef.path, operation: 'create', requestResourceData: docData });
    }

    if (data.email) await this.syncGlobalUserData(data.email, data.roleId, data.departmentId, data.fullName);
    return empRef.id;
  }

  async updateEmployee(id: string, newData: Partial<Employee>, currentUser: { uid: string, name: string }) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const empRef = doc(this.db, paths.employees(this.companyId), id);
    const oldSnap = await getDoc(empRef);
    if (!oldSnap.exists()) return;
    const oldData = oldSnap.data() as Employee;

    // --- محرك إعادة تقييم المخصصات عند زيادة الراتب (Sovereign Revaluation Engine) ---
    if (newData.basicSalary && newData.basicSalary > oldData.basicSalary) {
       await this.revalueEmployeeProvisions(oldData, newData.basicSalary, currentUser.uid);
    }

    const updates = { ...newData, updatedAt: serverTimestamp() };
    await updateDoc(empRef, updates);

    if (newData.email || newData.roleId || newData.departmentId || newData.fullName) {
      await this.syncGlobalUserData(newData.email || oldData.email!, newData.roleId || oldData.roleId, newData.departmentId || oldData.departmentId, newData.fullName || oldData.fullName);
    }

    const criticalFields: (keyof Employee)[] = ['basicSalary', 'jobTitle', 'departmentName', 'status', 'roleId'];
    for (const field of criticalFields) {
      if (newData[field] !== undefined && newData[field] !== oldData[field]) {
        this.addAuditLog(id, { action: 'update', field: field as string, oldValue: oldData[field] || 'None', newValue: newData[field], changedBy: currentUser.uid, changedByName: currentUser.name });
      }
    }
  }

  /**
   * إعادة حساب الفجوة المالية للمخصصات السابقة بناءً على الراتب الجديد
   */
  private async revalueEmployeeProvisions(emp: Employee, newSalary: number, userId: string) {
    const whService = new WorkHoursService(this.db, this.companyId);
    let settings = await whService.getSettings();
    if (!settings) settings = whService.getDefaultSettings() as any;
    const wdService = new WorkingDaysService(settings!);

    const oldDailyWage = emp.basicSalary / 26;
    const newDailyWage = newSalary / 26;
    const wageDiff = newDailyWage - oldDailyWage;

    const accruedDays = wdService.calculateAccruedLeave(emp.hireDate);
    const gratuityDays = (accruedDays / 30) * 15; 

    const leaveGap = accruedDays * wageDiff;
    const gratuityGap = gratuityDays * wageDiff;

    const accService = new AccountingService(this.db, this.companyId);
    await accService.createJournalEntry({
      date: new Date().toISOString().split('T')[0],
      description: `قيد إعادة تقييم مخصصات الموظف ${emp.fullName} لزيادة الراتب من ${emp.basicSalary} إلى ${newSalary}`,
      status: 'posted',
      lines: [
        { accountId: 'id_5202', accountName: 'مصروف مخصص نهاية الخدمة', debit: Math.round(gratuityGap * 1000) / 1000, credit: 0 },
        { accountId: 'id_5203', accountName: 'مصروف مخصص الإجازات', debit: Math.round(leaveGap * 1000) / 1000, credit: 0 },
        { accountId: 'id_2205', accountName: 'مخصص مكافأة نهاية الخدمة', debit: 0, credit: Math.round(gratuityGap * 1000) / 1000 },
        { accountId: 'id_2206', accountName: 'مخصص رصيد الإجازات', debit: 0, credit: Math.round(leaveGap * 1000) / 1000 }
      ]
    }, userId);
  }

  private async syncGlobalUserData(email: string, roleId?: string, departmentId?: string, fullName?: string) {
    try {
      const q = query(collection(this.db, 'global_users'), where('email', '==', email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const globalUserRef = doc(this.db, 'global_users', snap.docs[0].id);
        const updates: any = { updatedAt: serverTimestamp() };
        if (fullName) updates.fullName = fullName;
        if (departmentId) updates.departmentId = departmentId;
        if (roleId) {
          updates.roleId = roleId;
          const roleSnap = await getDoc(doc(this.db, 'companies', this.companyId, 'roles', roleId));
          if (roleSnap.exists()) {
             const codeUpper = String(roleSnap.data().code).toUpperCase();
             updates.roleCode = codeUpper; updates.role = codeUpper.toLowerCase();
          }
        }
        await updateDoc(globalUserRef, updates);
      }
    } catch (e) { console.warn("Security sync bypass:", e); }
  }

  async terminateEmployee(id: string, reason: string, date: string, currentUser: { uid: string, name: string }) {
    const empRef = doc(this.db, paths.employees(this.companyId), id);
    await updateDoc(empRef, { status: 'terminated', isActive: false, terminationReason: reason, terminationDate: date, updatedAt: serverTimestamp() });
    this.addAuditLog(id, { action: 'terminate', field: 'status', oldValue: 'active', newValue: 'terminated', changedBy: currentUser.uid, changedByName: currentUser.name });
  }

  private addAuditLog(employeeId: string, log: Omit<EmployeeAuditLog, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'employeeId'>) {
    const logPath = `${paths.employees(this.companyId)}/${employeeId}/auditLogs`;
    addDoc(collection(this.db, logPath), { ...log, employeeId, companyId: this.companyId, createdAt: serverTimestamp() });
  }
}
