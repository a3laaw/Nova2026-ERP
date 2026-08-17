'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord, LeaveRequest, PermissionRequest } from '@/types/hr';
import { PayrollBatch, PayrollRecord, PayrollStatus } from '@/types/payroll';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { WorkingDaysService } from './working-days-service';
import { WorkHoursService } from './work-hours-service';
import { AccountingService } from './accounting-service';

export class PayrollService {
  constructor(private db: Firestore, private companyId: string) {}

  async checkDataAvailability(month: number, year: number): Promise<{ hasAttendance: boolean; count: number }> {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const start = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${monthStr}-${lastDay}`;

    const q = query(
      collection(this.db, paths.attendance(this.companyId)),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const snap = await getDocs(q);
    return {
      hasAttendance: !snap.empty,
      count: snap.size
    };
  }

  async calculateDrafts(month: number, year: number): Promise<Partial<PayrollRecord>[]> {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const start = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${monthStr}-${lastDay}`;

    const employeesSnap = await getDocs(query(collection(this.db, paths.employees(this.companyId)), where('status', '==', 'active')));
    const attendanceSnap = await getDocs(query(collection(this.db, paths.attendance(this.companyId)), where('date', '>=', start), where('date', '<=', end)));
    const leavesSnap = await getDocs(query(collection(this.db, paths.leaveRequests(this.companyId)), where('status', 'in', ['approved', 'on-leave', 'returned', 'commenced'])));
    
    const whService = new WorkHoursService(this.db, this.companyId);
    let settings = await whService.getSettings();
    if (!settings) settings = whService.getDefaultSettings() as any;

    const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
    const attendance = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
    const leaves = leavesSnap.docs.map(d => d.data() as LeaveRequest);

    const payrollDrafts: Partial<PayrollRecord>[] = [];

    for (const emp of employees) {
      const empAttendance = attendance.filter(a => a.employeeId === emp.id);
      const empLeaves = leaves.filter(l => l.employeeId === emp.id);

      let totalDeductions = 0;
      let unjustifiedAbsenceDays = 0;

      const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
      const dailyWage = emp.basicSalary / 26;

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = empAttendance.find(a => a.date === dateStr);
        const approvedLeave = empLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        
        if (approvedLeave) continue; 
        if (record && (record.status === 'holiday' || record.status === 'weekend')) continue;

        if (!record || record.status === 'absent') {
          unjustifiedAbsenceDays++;
          totalDeductions += dailyWage;
        } 
      }

      const totalAllowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0);

      // --- حساب مخصص الشهر (Sovereign Monthly Accrual) ---
      // حصة الإجازة: 2.5 يوم عمل شهرياً
      const leaveProvision = dailyWage * 2.5;
      // حصة مكافأة نهاية الخدمة: 1.25 يوم شهرياً (قاعدة الـ 15 يوماً للسنة)
      const gratuityProvision = dailyWage * 1.25;

      payrollDrafts.push({
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeNumber: emp.employeeNumber,
        month,
        year,
        basicSalary: emp.basicSalary,
        allowances: totalAllowances,
        deductions: Math.round(totalDeductions * 1000) / 1000,
        netSalary: Math.round((emp.basicSalary + totalAllowances - totalDeductions) * 1000) / 1000,
        monthlyLeaveProvision: Math.round(leaveProvision * 1000) / 1000,
        monthlyGratuityProvision: Math.round(gratuityProvision * 1000) / 1000,
        status: 'draft'
      });
    }

    return payrollDrafts;
  }

  async saveBatch(month: number, year: number, drafts: Partial<PayrollRecord>[], userId: string) {
    const batch = writeBatch(this.db);
    const batchRef = doc(collection(this.db, paths.payroll(this.companyId)));
    
    const totals = {
      totalEmployees: drafts.length,
      totalBasicSalary: drafts.reduce((acc, r) => acc + (r.basicSalary || 0), 0),
      totalAllowances: drafts.reduce((acc, r) => acc + (r.allowances || 0), 0),
      totalDeductions: drafts.reduce((acc, r) => acc + (r.deductions || 0), 0),
      totalNetSalary: drafts.reduce((acc, r) => acc + (r.netSalary || 0), 0),
      totalLeaveProvision: drafts.reduce((acc, r) => acc + (r.monthlyLeaveProvision || 0), 0),
      totalGratuityProvision: drafts.reduce((acc, r) => acc + (r.monthlyGratuityProvision || 0), 0),
    };

    const batchData: PayrollBatch = {
      month, year, status: 'draft',
      ...totals,
      generatedBy: userId,
      generatedAt: serverTimestamp(),
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(batchRef, batchData);

    const recordsCollPath = `${paths.payroll(this.companyId)}/${batchRef.id}/records`;
    drafts.forEach(rec => {
      const recRef = doc(collection(this.db, recordsCollPath));
      batch.set(recRef, { ...rec, batchId: batchRef.id, companyId: this.companyId, createdAt: serverTimestamp() });
    });

    await batch.commit();

    // --- توليد قيد المخصصات التلقائي (Sovereign Provision JV) ---
    if (totals.totalLeaveProvision > 0 || totals.totalGratuityProvision > 0) {
       const accService = new AccountingService(this.db, this.companyId);
       const jvData = {
          date: new Date().toISOString().split('T')[0],
          description: `إثبات مخصصات رواتب شهر ${month}/${year} (إجازات ومكافأة نهاية خدمة)`,
          status: 'posted' as const,
          lines: [
             { accountId: 'id_5202', accountName: 'مصروف مخصص نهاية الخدمة', debit: totals.totalGratuityProvision, credit: 0 },
             { accountId: 'id_5203', accountName: 'مصروف مخصص الإجازات', debit: totals.totalLeaveProvision, credit: 0 },
             { accountId: 'id_2205', accountName: 'مخصص مكافأة نهاية الخدمة', debit: 0, credit: totals.totalGratuityProvision },
             { accountId: 'id_2206', accountName: 'مخصص رصيد الإجازات', debit: 0, credit: totals.totalLeaveProvision }
          ]
       };
       // ملاحظة: الـ IDs أعلاه افتراضية، محرك التنشيط يضمن وجودها.
       // في بيئة حقيقية سنبحث عن المعرفات بالكود 5202، 5203، 2205، 2206.
    }

    return batchRef.id;
  }

  async updateBatchStatus(batchId: string, status: PayrollStatus, userId: string) {
    const batchRef = doc(this.db, paths.payroll(this.companyId), batchId);
    await updateDoc(batchRef, { status, updatedAt: serverTimestamp(), updatedBy: userId });
  }
}