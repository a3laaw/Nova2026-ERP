
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDocs,
  query,
  limit,
  where
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { SEED_DATA } from '@/lib/seed-data';
import { WorkingDaysService } from './working-days-service';
import { WorkHoursService } from './work-hours-service';

export class SeedService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * مزامنة وإصلاح أرصدة الإجازات لكافة الموظفين بناءً على تاريخ التعيين (Historical Sync)
   * يحل مشكلة الرصيد السالب للموظفين القدامى عبر إعادة حساب الاستحقاق منذ أول يوم عمل.
   */
  async syncAllEmployeeBalances() {
    const whService = new WorkHoursService(this.db, this.companyId);
    let settings = await whService.getSettings();
    if (!settings) settings = whService.getDefaultSettings() as any;
    const wdService = new WorkingDaysService(settings!);

    const empsSnap = await getDocs(collection(this.db, paths.employees(this.companyId)));
    const leavesSnap = await getDocs(query(
      collection(this.db, paths.leaveRequests(this.companyId)),
      where('status', 'in', ['approved', 'on-leave', 'returned', 'commenced'])
    ));

    const batch = writeBatch(this.db);
    let count = 0;

    for (const empDoc of empsSnap.docs) {
      const emp = empDoc.data();
      if (!emp.hireDate) continue;

      // 1. حساب الاستحقاق التراكمي القانوني من تاريخ التعيين
      const totalAccrued = wdService.calculateAccruedLeave(emp.hireDate);
      
      // 2. حساب المستهلك الفعلي من الإجازات السنوية المسجلة
      const empUsed = leavesSnap.docs
        .filter(d => d.data().employeeId === empDoc.id && d.data().type === 'annual')
        .reduce((sum, d) => sum + (d.data().workingDays || 0), 0);

      const trueBalance = Math.max(0, Math.round((totalAccrued - empUsed) * 10) / 10);

      // تحديث الرصيد فقط إذا كان مختلفاً عن المسجل
      if (emp.annualLeaveBalance !== trueBalance) {
        batch.update(empDoc.ref, { 
          annualLeaveBalance: trueBalance, 
          updatedAt: serverTimestamp() 
        });
        count++;
      }
    }

    if (count > 0) await batch.commit();
    return count;
  }

  /**
   * التطهير الشامل للنظام (Reset)
   */
  async purgeSystemData() {
    const collectionsToPurge = [
      paths.clients(this.companyId),
      paths.transactions(this.companyId),
      paths.boqs(this.companyId),
      paths.quotations(this.companyId), 
      paths.contracts(this.companyId), 
      paths.subconContracts(this.companyId), 
      paths.journalEntries(this.companyId),
      paths.vouchers(this.companyId),
      paths.accounts(this.companyId),
      paths.costCenters(this.companyId),
      paths.profitCenters(this.companyId),
      paths.purchaseOrders(this.companyId),
      paths.ipcs(this.companyId),
      paths.subIpcs(this.companyId),
      paths.fieldVisits(this.companyId),
      paths.attendance(this.companyId),
      paths.payroll(this.companyId),
      paths.leads(this.companyId),
      paths.executions(this.companyId),
      paths.leaveRequests(this.companyId),
      paths.appointments(this.companyId)
    ];

    for (const path of collectionsToPurge) {
      try {
        const q = query(collection(this.db, path), limit(500));
        const snap = await getDocs(q);
        const batch = writeBatch(this.db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } catch (e) {
        console.warn(`Purge skipped: ${path}`);
      }
    }
  }

  async runIdentityMigration() {
    const snap = await getDocs(collection(this.db, 'global_users'));
    const batch = writeBatch(this.db);
    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      const roleCode = String(data.roleCode || data.role || 'USER').toUpperCase();
      batch.update(d.ref, { roleCode, role: roleCode.toLowerCase(), updatedAt: serverTimestamp() });
      count++;
    });
    await batch.commit();
    return count;
  }

  async runSeed() {
    const batch = writeBatch(this.db);
    for (const dept of SEED_DATA.departments) {
      const deptRef = doc(collection(this.db, paths.departments(this.companyId)));
      batch.set(deptRef, { name: dept.name, nameEn: dept.nameEn, isActive: true, order: dept.order, companyId: this.companyId, createdAt: serverTimestamp() });
      for (const job of dept.jobs) {
        const jobRef = doc(collection(this.db, paths.jobs(this.companyId, deptRef.id)));
        batch.set(jobRef, { ...job, departmentId: deptRef.id, isActive: true, companyId: this.companyId, createdAt: serverTimestamp() });
      }
    }
    await batch.commit();
  }

  async purgeAllAppointments() {
    const snap = await getDocs(collection(this.db, paths.appointments(this.companyId)));
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  }
}
