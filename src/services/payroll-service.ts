'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Employee, AttendanceRecord, LeaveRequest, PermissionRequest } from '@/types/hr';
import { PayrollBatch, PayrollRecord, PayrollStatus } from '@/types/payroll';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { AccountingIntegrationService } from './accounting-integration-service';

export class PayrollService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * توليد بيانات مسودة الرواتب لشهر معين
   */
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

      let deductions = 0;
      let unjustifiedAbsenceDays = 0;
      let justifiedAbsenceDays = 0;

      const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = empAttendance.find(a => a.date === dateStr);
        const hasApprovedLeave = empLeaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
        
        if (hasApprovedLeave) {
          justifiedAbsenceDays++;
          continue; 
        }

        if (!record || record.status === 'absent') {
          unjustifiedAbsenceDays++;
          deductions += (emp.basicSalary / 30);
        } else if (record.status === 'late') {
          const hasPerm = empPerms.some(p => p.date === dateStr && p.type === 'late_arrival');
          if (!hasPerm) {
            const minuteRate = (emp.basicSalary / 30 / 8 / 60);
            deductions += (minuteRate * record.minutesLate);
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
        deductions: Math.round(deductions * 1000) / 1000,
        netSalary: Math.round((emp.basicSalary + totalAllowances - deductions) * 1000) / 1000,
        unjustifiedAbsenceDays,
        justifiedAbsenceDays,
        status: 'draft'
      });
    }

    return payrollDrafts;
  }

  async saveBatch(month: number, year: number, records: Partial<PayrollRecord>[], userId: string) {
    const batch = writeBatch(this.db);
    const batchRef = doc(collection(this.db, paths.payroll(this.companyId)));
    
    const summary = {
      totalEmployees: records.length,
      totalBasicSalary: records.reduce((acc, r) => acc + (r.basicSalary || 0), 0),
      totalAllowances: records.reduce((acc, r) => acc + (r.allowances || 0), 0),
      totalDeductions: records.reduce((acc, r) => acc + (r.deductions || 0), 0),
      totalNetSalary: records.reduce((acc, r) => acc + (r.netSalary || 0), 0),
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
    records.forEach(rec => {
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
      
      // تنفيذ الربط المحاسبي (Accounting Hook)
      const batchSnap = await getDoc(batchRef);
      const recordsSnap = await getDocs(collection(this.db, `${paths.payroll(this.companyId)}/${batchId}/records`));
      
      if (batchSnap.exists()) {
        const payload = AccountingIntegrationService.generatePayrollJournalPayload(
          { id: batchId, ...batchSnap.data() } as PayrollBatch,
          recordsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord))
        );
        console.log('INTEGRATION: Accounting Journal Payload Generated', payload);
        // هنا يمكن استدعاء AccountingService.createJournalEntry(payload)
      }
    }

    await updateDoc(batchRef, updates);
  }
}
