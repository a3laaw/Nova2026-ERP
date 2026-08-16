'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDocs,
  getDoc,
  query,
  limit,
  deleteDoc,
  where
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { SEED_DATA } from '@/lib/seed-data';
import { BOQReferenceNode } from '@/types/reference';

export class SeedService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تطهير شامل لكافة البيانات التشغيلية والمالية (Nuclear Reset)
   * يحذف كل شيء ما عدا الموظفين، الأقسام، المسميات الوظيفية، والأدوار.
   */
  async purgeSystemData() {
    const batchSize = 500;
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
      paths.appointments(this.companyId),
      `companies/${this.companyId}/counters` 
    ];

    for (const path of collectionsToPurge) {
      let hasMore = true;
      while (hasMore) {
        try {
          const q = query(collection(this.db, path), limit(batchSize));
          const snap = await getDocs(q);
          if (snap.empty) {
            hasMore = false;
            continue;
          }

          const batch = writeBatch(this.db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();

          if (snap.size < batchSize) hasMore = false;
        } catch (e) {
          console.warn(`Purge skipped for path: ${path} - probably empty.`);
          hasMore = false;
        }
      }
    }
  }

  /**
   * تطهير سجل الإجازات فقط مع المحافظة على الموظفين
   */
  async purgeAllLeaves() {
    const q = query(collection(this.db, paths.leaveRequests(this.companyId)));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  }

  async runIdentityMigration() {
    const globalUsersRef = collection(this.db, 'global_users');
    const snap = await getDocs(globalUsersRef);
    const batch = writeBatch(this.db);
    let count = 0;

    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      const rawCode = data.roleCode || data.role || 'USER';
      const finalRoleCode = String(rawCode).toUpperCase();
      const finalRole = finalRoleCode.toLowerCase();

      if (data.roleCode !== finalRoleCode || data.role !== finalRole) {
        batch.update(userDoc.ref, {
          roleCode: finalRoleCode,
          role: finalRole,
          updatedAt: serverTimestamp()
        });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    return count;
  }

  async runSeed() {
    const batch = writeBatch(this.db);
    
    // 1. الأقسام والوظائف
    const deptRefs: Record<string, string> = {};
    for (const dept of SEED_DATA.departments) {
      const deptRef = doc(collection(this.db, paths.departments(this.companyId)));
      deptRefs[dept.code] = deptRef.id;
      batch.set(deptRef, {
        name: dept.name,
        nameEn: dept.nameEn,
        color: dept.code === 'ARCH' ? '#F57C00' : dept.code === 'CIVIL' ? '#2563eb' : '#94a3b8',
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });

      for (const job of dept.jobs) {
        const jobRef = doc(collection(this.db, paths.jobs(this.companyId, deptRef.id)));
        batch.set(jobRef, {
          ...job,
          departmentId: deptRef.id,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  }

  async purgeAllAppointments() {
    const q = query(collection(this.db, paths.appointments(this.companyId)));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  }

  async isSystemSeeded() {
    const q = query(collection(this.db, paths.boqReferenceNodes(this.companyId)), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }

  /**
   * ضخ شجرة حسابات متخصصة لشركات المقاولات مع تأسيس أبعادها التحليلية (WIP & Retentions)
   */
  async seedConstructionCOA(userId: string) {
    const batch = writeBatch(this.db);
    const coaRef = collection(this.db, paths.accounts(this.companyId));
    
    // 1. تأسيس المراكز الإدارية والعامة لضمان عمل محرك التحقق (Validation Engine)
    const adminCCRef = doc(collection(this.db, paths.costCenters(this.companyId)), 'cc_admin_general');
    batch.set(adminCCRef, {
      id: adminCCRef.id, code: 'CC-ADMIN', name: 'مركز التكاليف الإدارية والعمومية', 
      isAdministrative: true, isActive: true, companyId: this.companyId, createdAt: serverTimestamp()
    });

    const generalPCRef = doc(collection(this.db, paths.profitCenters(this.companyId)), 'pc_corp_general');
    batch.set(generalPCRef, {
      id: generalPCRef.id, code: 'PC-GENERAL', name: 'مركز الربحية العام (المنشأة)', 
      isActive: true, companyId: this.companyId, createdAt: serverTimestamp()
    });

    // 2. ضخ شجرة الحسابات (Construction Specific)
    const accounts = [
      { code: '11', nameAr: 'الأصول المتداولة', type: 'asset', isGroup: true },
      { code: '1101', nameAr: 'النقدية وما في حكمها', type: 'asset', isGroup: true, parentCode: '11' },
      { code: '110101', nameAr: 'الخزينة الرئيسية', type: 'asset', isGroup: false, parentCode: '1101' },
      { code: '1202', nameAr: 'ذمم العملاء (الملاك)', type: 'asset', isGroup: true, parentCode: '11' },
      { code: '1203', nameAr: 'محتجزات مدينة لدى الملاك', type: 'asset', isGroup: false, parentCode: '11' },
      { code: '1205', nameAr: 'أعمال تحت التنفيذ (WIP)', type: 'asset', isGroup: true, parentCode: '11' },
      { code: '21', nameAr: 'الخصوم المتداولة', type: 'liability', isGroup: true },
      { code: '2101', nameAr: 'ذمم الموردين ومقاولي الباطن', type: 'liability', isGroup: true, parentCode: '21' },
      { code: '2102', nameAr: 'محتجزات دائنة لمقاولي الباطن', type: 'liability', isGroup: false, parentCode: '2101' },
      { code: '41', nameAr: 'إيرادات المشاريع', type: 'revenue', isGroup: true },
      { code: '4101', nameAr: 'إيرادات عقود المقاولات', type: 'revenue', isGroup: false, parentCode: '41' },
      { code: '51', nameAr: 'تكاليف النشاط المباشرة', type: 'expense', isGroup: true },
      { code: '5101', nameAr: 'تكلفة مواد بناء', type: 'expense', isGroup: false, parentCode: '51' },
      { code: '5102', nameAr: 'تكلفة عمالة ميدانية', type: 'expense', isGroup: false, parentCode: '51' },
    ];

    for (const acc of accounts) {
       const ref = doc(coaRef);
       batch.set(ref, {
          ...acc,
          id: ref.id,
          companyId: this.companyId,
          isActive: true,
          level: acc.code.length,
          createdAt: serverTimestamp(),
          createdBy: userId
       });
    }

    await batch.commit();
  }
}
