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
   * تنشيط شجرة الحسابات مع إنشاء مراكز التكلفة والربحية آلياً (التكامل المالي)
   */
  async seedConstructionCOA(userId: string) {
    const batch = writeBatch(this.db);
    const accountsRef = collection(this.db, paths.accounts(this.companyId));
    
    // 1. تعريف شجرة الحسابات القياسية للمقاولات
    const standardAccounts = [
      { code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'asset', isGroup: true, level: 1 },
      { code: '11', nameAr: 'أصول متداولة', nameEn: 'Current Assets', type: 'asset', isGroup: true, level: 2, parentId: '1' },
      { code: '1101', nameAr: 'النقدية والبنك', nameEn: 'Cash & Bank', type: 'asset', isGroup: false, level: 3, parentId: '11' },
      { code: '12', nameAr: 'ذمم وحسابات مدينة', nameEn: 'Accounts Receivable', type: 'asset', isGroup: true, level: 2, parentId: '1' },
      { code: '1202', nameAr: 'ذمم العملاء (AR)', nameEn: 'Clients Receivable', type: 'asset', isGroup: true, level: 3, parentId: '12' },
      { code: '1205', nameAr: 'أعمال تحت التنفيذ (WIP)', nameEn: 'Work In Progress', type: 'asset', isGroup: true, level: 3, parentId: '12' },
      
      { code: '2', nameAr: 'الخصوم', nameEn: 'Liabilities', type: 'liability', isGroup: true, level: 1 },
      { code: '22', nameAr: 'خصوم متداولة', nameEn: 'Current Liabilities', type: 'liability', isGroup: true, level: 2, parentId: '2' },
      { code: '2204', nameAr: 'مستحقات رواتب وأجور', nameEn: 'Accrued Salaries', type: 'liability', isGroup: true, level: 3, parentId: '22' },
      
      { code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'equity', isGroup: true, level: 1 },
      
      { code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'revenue', isGroup: true, level: 1 },
      { code: '4101', nameAr: 'إيرادات عقود ومقاولات', nameEn: 'Project Revenue', type: 'revenue', isGroup: false, level: 2, parentId: '4' },
      
      { code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'expense', isGroup: true, level: 1 },
      { code: '5101', nameAr: 'تكاليف تنفيذ مباشرة', nameEn: 'Direct Execution Costs', type: 'expense', isGroup: false, level: 2, parentId: '5' },
      { code: '5201', nameAr: 'رواتب ومصاريف إدارية', nameEn: 'G&A Expenses', type: 'expense', isGroup: false, level: 2, parentId: '5' }
    ];

    // حفظ الحسابات
    standardAccounts.forEach(acc => {
      const newRef = doc(accountsRef);
      batch.set(newRef, {
        ...acc,
        id: newRef.id,
        companyId: this.companyId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId
      });
    });

    // 2. إنشاء مراكز التكلفة والربحية الإدارية (تلقائي)
    const ccRef = doc(this.db, paths.costCenters(this.companyId), 'cc_admin_general');
    batch.set(ccRef, {
      id: 'cc_admin_general',
      code: 'CC-100',
      name: 'الإدارة العامة والمصاريف المشتركة',
      isAdministrative: true,
      isActive: true,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    const pcRef = doc(this.db, paths.profitCenters(this.companyId), 'pc_corp_general');
    batch.set(pcRef, {
      id: 'pc_corp_general',
      code: 'PC-100',
      name: 'مركز أرباح العمليات المؤسسية',
      isActive: true,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * مزامنة وإصلاح أرصدة الإجازات لكافة الموظفين بناءً على تاريخ التعيين (Historical Sync)
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

      const totalAccrued = wdService.calculateAccruedLeave(emp.hireDate);
      const empUsed = leavesSnap.docs
        .filter(d => d.data().employeeId === empDoc.id && d.data().type === 'annual')
        .reduce((sum, d) => sum + (d.data().workingDays || 0), 0);

      const trueBalance = Math.max(0, Math.round((totalAccrued - empUsed) * 10) / 10);

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

  async purgeSystemData() {
    const collectionsToPurge = [
      paths.clients(this.companyId), paths.transactions(this.companyId), paths.boqs(this.companyId),
      paths.quotations(this.companyId), paths.contracts(this.companyId), paths.journalEntries(this.companyId),
      paths.vouchers(this.companyId), paths.ipcs(this.companyId), paths.subIpcs(this.companyId),
      paths.fieldVisits(this.companyId), paths.attendance(this.companyId), paths.payroll(this.companyId),
      paths.executions(this.companyId), paths.leaveRequests(this.companyId), paths.appointments(this.companyId)
    ];
    for (const path of collectionsToPurge) {
      const snap = await getDocs(query(collection(this.db, path), limit(500)));
      const batch = writeBatch(this.db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
}
