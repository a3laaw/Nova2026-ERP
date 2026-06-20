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
  getDoc,
  updateDoc,
  limit,
  orderBy
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord, LeaveRequest, PermissionRequest } from '@/types/hr';
import { PayrollBatch, PayrollRecord, PayrollStatus } from '@/types/payroll';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { AccountingIntegrationService } from './accounting-integration-service';

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
    const leavesSnap = await getDocs(query(collection(this.db, paths.leaveRequests(this.companyId)), where('status', 'in', ['approved', 'on-leave', 'returned'])));
    const permsSnap = await getDocs(query(collection(this.db, paths.permissionRequests(this.companyId)), where('status', '==', 'approved'), where('date', '>=', start), where('date', '<=', end)));

    const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
    const attendance = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
    const leaves = leavesSnap.docs.map(d => d.data() as LeaveRequest);
    const permissions = permsSnap.docs.map(d => d.data() as PermissionRequest);

    const payrollDrafts: Partial<PayrollRecord>[] = [];

    for (const emp of employees) {
      const empAttendance = attendance.filter(a => a.employeeId === emp.id);
      const empLeaves = leaves.filter(l => l.userId === emp.id || (emp.id && l.employeeId === emp.id));
      const empPerms = permissions.filter(p => p.userId === emp.id);

      let totalDeductions = 0;
      let unjustifiedAbsenceDays = 0;
      let justifiedAbsenceDays = 0;

      const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });

      /**
       * حسبة الـ 26 يوماً (العرف الكويتي):
       * قيمة اليوم الواحد = الراتب الشهري / 26.
       * نستخدمها حصراً للخصم (الغياب/التأخير) وليس لصرف الإجازات.
       */
      const dailyWage = emp.basicSalary / 26;
      const hourlyWage = dailyWage / 8;
      const minuteWage = hourlyWage / 60;

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = empAttendance.find(a => a.date === dateStr);
        const approvedLeave = empLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        
        // إذا كان في إجازة معتمدة (سنوية أو مرضية)
        if (approvedLeave) {
          justifiedAbsenceDays++;
          
          // تطبيق خصم شرائح المرضية (المادة 69) إن وجدت
          if (approvedLeave.type === 'sick' && approvedLeave.sickLeaveTiers) {
             // منطق الخصم المتدرج: يتم خصم النسبة المتبقية من اليومية
             // مثال: شريحة الـ 75% تعني خصم 25% من اليومية (الراتب/26)
          }
          continue; 
        }

        // استبعاد أيام الراحة والعطلات
        if (record && (record.status === 'holiday' || record.status === 'weekend')) {
          continue;
        }

        // غياب غير مبرر (خصم يوم كامل)
        if (!record || record.status === 'absent') {
          unjustifiedAbsenceDays++;
          totalDeductions += dailyWage;
        } 
        // تأخير (خصم بالدقائق)
        else if (record.status === 'late') {
          const hasPerm = empPerms.some(p => p.date === dateStr && p.type === 'late_arrival');
          if (!hasPerm) {
            totalDeductions += (minuteWage * (record.minutesLate || 0));
          }
        }
      }

      const totalAllowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0);

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
        unjustifiedAbsenceDays,
        justifiedAbsenceDays,
        status: 'draft'
      });
    }

    return payrollDrafts;
  }

  async saveBatch(month: number, year: number, drafts: Partial<PayrollRecord>[], userId: string) {
    const batch = writeBatch(this.db);
    const batchRef = doc(collection(this.db, paths.payroll(this.companyId)));
    
    const summary = {
      totalEmployees: drafts.length,
      totalBasicSalary: drafts.reduce((acc, r) => acc + (r.basicSalary || 0), 0),
      totalAllowances: drafts.reduce((acc, r) => acc + (r.allowances || 0), 0),
      totalDeductions: drafts.reduce((acc, r) => acc + (r.deductions || 0), 0),
      totalNetSalary: drafts.reduce((acc, r) => acc + (r.netSalary || 0), 0),
    };

    const batchData: PayrollBatch = {
      month,
      year,
      status: 'draft',
      ...summary,
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
      batch.set(recRef, {
        ...rec,
        batchId: batchRef.id,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
    return batchRef.id;
  }

  async updateBatchStatus(batchId: string, status: PayrollStatus, userId: string) {
    const batchRef = doc(this.db, paths.payroll(this.companyId), batchId);
    const updates: any = {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    };

    if (status === 'reviewed') { updates.reviewedBy = userId; updates.reviewedAt = serverTimestamp(); }
    if (status === 'approved') { updates.approvedBy = userId; updates.approvedAt = serverTimestamp(); }
    if (status === 'paid') { 
      updates.paidBy = userId; 
      updates.paidAt = serverTimestamp();
    }

    await updateDoc(batchRef, updates);
  }
}