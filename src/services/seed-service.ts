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
  where,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { SEED_DATA } from '@/lib/seed-data';
import { WorkingDaysService } from './working-days-service';
import { WorkHoursService } from './work-hours-service';

/**
 * خدمة التأسيس والتهيئة السيادية (Sovereign Seed Service).
 * تم تحديثها لربط الهياكل عبر UUID لضمان عمل زر التوسعة وتطهير الدليل.
 */
export class SeedService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * التحقق مما إذا كان النظام قد تمت تهيئته مسبقاً
   */
  async isSystemSeeded(): Promise<boolean> {
    const q = query(collection(this.db, paths.accounts(this.companyId)), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }

  /**
   * تطهير دليل الحسابات ومراكز التكلفة والربحية (Nuclear Reset)
   */
  async purgeCOA() {
    const q = query(collection(this.db, paths.accounts(this.companyId)), limit(500));
    const snap = await getDocs(q);
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    
    // تطهير المراكز أيضاً للبدء من جديد
    const ccSnap = await getDocs(collection(this.db, paths.costCenters(this.companyId)));
    ccSnap.docs.forEach(d => batch.delete(d.ref));
    
    const pcSnap = await getDocs(collection(this.db, paths.profitCenters(this.companyId)));
    pcSnap.docs.forEach(d => batch.delete(d.ref));
    
    await batch.commit();
  }

  /**
   * تطهير شامل للبيانات التشغيلية
   */
  async purgeSystemData() {
    const batch = writeBatch(this.db);
    
    const transSnap = await getDocs(collection(this.db, paths.transactions(this.companyId)));
    transSnap.docs.forEach(d => batch.delete(d.ref));

    const clientsSnap = await getDocs(collection(this.db, paths.clients(this.companyId)));
    clientsSnap.docs.forEach(d => batch.delete(d.ref));

    const boqSnap = await getDocs(collection(this.db, paths.boqs(this.companyId)));
    boqSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
  }

  /**
   * حذف كافة المواعيد المجدولة
   */
  async purgeAllAppointments() {
    const q = query(collection(this.db, paths.appointments(this.companyId)));
    const snap = await getDocs(q);
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  /**
   * تأسيس شجرة الحسابات الهرمية (True UUID Linking)
   */
  async seedConstructionCOA(userId: string) {
    const batch = writeBatch(this.db);
    const accountsRef = collection(this.db, paths.accounts(this.companyId));
    
    const rawHierarchy = [
      { code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'asset', isGroup: true, level: 1, parentCode: null },
      { code: '11', nameAr: 'أصول متداولة', nameEn: 'Current Assets', type: 'asset', isGroup: true, level: 2, parentCode: '1' },
      { code: '1101', nameAr: 'النقدية والبنك', nameEn: 'Cash & Bank', type: 'asset', isGroup: true, level: 3, parentCode: '11' },
      { code: '12', nameAr: 'ذمم مدينة', nameEn: 'Accounts Receivable', type: 'asset', isGroup: true, level: 2, parentCode: '1' },
      { code: '1202', nameAr: 'ذمم العملاء (AR)', nameEn: 'Clients Receivable', type: 'asset', isGroup: true, level: 3, parentCode: '12' },
      { code: '1205', nameAr: 'أعمال تحت التنفيذ (WIP)', nameEn: 'Work In Progress', type: 'asset', isGroup: true, level: 3, parentCode: '12' },
      
      { code: '2', nameAr: 'الخصوم', nameEn: 'Liabilities', type: 'liability', isGroup: true, level: 1, parentCode: null },
      { code: '22', nameAr: 'خصوم متداولة', nameEn: 'Current Liabilities', type: 'liability', isGroup: true, level: 2, parentCode: '2' },
      { code: '2204', nameAr: 'مستحقات رواتب وأجور', nameEn: 'Accrued Salaries', type: 'liability', isGroup: true, level: 3, parentCode: '22' },
      { code: '2205', nameAr: 'مخصص مكافأة نهاية الخدمة', nameEn: 'Provision for Gratuity', type: 'liability', isGroup: false, level: 3, parentCode: '22' },
      { code: '2206', nameAr: 'مخصص رصيد الإجازات', nameEn: 'Provision for Leave', type: 'liability', isGroup: false, level: 3, parentCode: '22' },
      
      { code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'equity', isGroup: true, level: 1, parentCode: null },
      
      { code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'revenue', isGroup: true, level: 1, parentCode: null },
      { code: '4101', nameAr: 'إيرادات عقود ومقاولات', nameEn: 'Project Revenue', type: 'revenue', isGroup: false, level: 2, parentCode: '4' },
      
      { code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'expense', isGroup: true, level: 1, parentCode: null },
      { code: '5101', nameAr: 'تكاليف تنفيذ مباشرة', nameEn: 'Direct Execution Costs', type: 'expense', isGroup: false, level: 2, parentCode: '5' },
      { code: '5201', nameAr: 'رواتب ومصاريف إدارية', nameEn: 'G&A Expenses', type: 'expense', isGroup: false, level: 2, parentCode: '5' },
      { code: '5202', nameAr: 'مصروف مخصص نهاية الخدمة', nameEn: 'Gratuity Provision Exp', type: 'expense', isGroup: false, level: 2, parentCode: '5' },
      { code: '5203', nameAr: 'مصروف مخصص الإجازات', nameEn: 'Leave Provision Exp', type: 'expense', isGroup: false, level: 2, parentCode: '5' }
    ];

    const codeToIdMap: Record<string, string> = {};
    rawHierarchy.forEach(item => {
      codeToIdMap[item.code] = doc(accountsRef).id;
    });

    rawHierarchy.forEach(item => {
      const myId = codeToIdMap[item.code];
      const parentId = item.parentCode ? codeToIdMap[item.parentCode] : "";
      
      batch.set(doc(accountsRef, myId), {
        id: myId,
        code: item.code,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        type: item.type,
        isGroup: item.isGroup,
        level: item.level,
        parentId: parentId,
        companyId: this.companyId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId
      });
    });

    // تأسيس المراكز الإدارية الافتراضية
    const ccRef = doc(this.db, paths.costCenters(this.companyId), 'cc_admin_general');
    batch.set(ccRef, { 
      id: 'cc_admin_general', 
      code: 'CC-100', 
      name: 'الإدارة العامة',
      nameAr: 'الإدارة العامة والمصاريف المشتركة', 
      nameEn: 'General & Admin Shared Costs',
      isAdministrative: true, 
      isActive: true, 
      companyId: this.companyId, 
      createdAt: serverTimestamp() 
    });

    const pcRef = doc(this.db, paths.profitCenters(this.companyId), 'pc_corp_general');
    batch.set(pcRef, { 
      id: 'pc_corp_general', 
      code: 'PC-100', 
      name: 'العمليات المؤسسية',
      nameAr: 'مركز أرباح العمليات المؤسسية', 
      nameEn: 'Corporate Operations Profit Center',
      isActive: true, 
      companyId: this.companyId, 
      createdAt: serverTimestamp() 
    });

    await batch.commit();
  }

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
        batch.update(empDoc.ref, { annualLeaveBalance: trueBalance, updatedAt: serverTimestamp() });
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

  async runIdentityMigration() {
    const usersSnap = await getDocs(collection(this.db, 'global_users'));
    const batch = writeBatch(this.db);
    let count = 0;
    usersSnap.docs.forEach(d => {
      const data = d.data();
      const currentCode = data.roleCode || data.role || 'USER';
      const upperCode = currentCode.toUpperCase();
      if (currentCode !== upperCode) {
        batch.update(d.ref, { roleCode: upperCode, role: upperCode.toLowerCase(), updatedAt: serverTimestamp() });
        count++;
      }
    });
    if (count > 0) await batch.commit();
    return count;
  }
}
