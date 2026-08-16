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
      paths.journalEntries(this.companyId),
      paths.vouchers(this.companyId),
      paths.accounts(this.companyId),
      paths.costCenters(this.companyId),
      paths.profitCenters(this.companyId),
      paths.purchaseOrders(this.companyId),
      paths.subconContracts(this.companyId), 
      paths.ipcs(this.companyId),
      paths.subIpcs(this.companyId),
      paths.fieldVisits(this.companyId),
      paths.attendance(this.companyId),
      paths.payroll(this.companyId),
      paths.leads(this.companyId),
      paths.executions(this.companyId),
      paths.leaveRequests(this.companyId),
      `companies/${this.companyId}/counters` 
    ];

    for (const path of collectionsToPurge) {
      let hasMore = true;
      while (hasMore) {
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

  /**
   * سكربت هجرة الهوية السيادي (The Great Identity Migration)
   * يحل مشاكل الصلاحيات بتوحيد حالة أحرف roleCode ومعالجة السجلات المفقودة.
   */
  async runIdentityMigration() {
    const globalUsersRef = collection(this.db, 'global_users');
    const snap = await getDocs(globalUsersRef);
    const batch = writeBatch(this.db);
    let count = 0;

    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      let currentRoleCode = data.roleCode;
      let currentRole = data.role;
      let targetCompanyId = data.companyId;
      let roleId = data.roleId;

      if (!currentRoleCode && roleId && targetCompanyId && targetCompanyId !== 'awaiting_setup') {
        try {
          const roleSnap = await getDoc(doc(this.db, 'companies', targetCompanyId, 'roles', roleId));
          if (roleSnap.exists()) {
            currentRoleCode = roleSnap.data().code;
          }
        } catch (e) {
          console.error("Migration fetch failed for:", userDoc.id);
        }
      }

      const rawCode = currentRoleCode || currentRole || 'USER';
      const finalRoleCode = String(rawCode).toUpperCase();
      const finalRole = finalRoleCode.toLowerCase();

      if (data.roleCode !== finalRoleCode || data.role !== finalRole) {
        batch.update(userDoc.ref, {
          roleCode: finalRoleCode,
          role: finalRole,
          updatedAt: serverTimestamp()
        });

        if (targetCompanyId && targetCompanyId !== 'awaiting_setup') {
           const localUserRef = doc(this.db, 'companies', targetCompanyId, 'users', userDoc.id);
           batch.update(localUserRef, {
              roleCode: finalRoleCode,
              role: finalRole,
              updatedAt: serverTimestamp()
           });
        }
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (const job of dept.jobs) {
        const jobRef = doc(collection(this.db, paths.jobs(this.companyId, deptRef.id)));
        batch.set(jobRef, {
          ...job,
          departmentId: deptRef.id,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // 2. الجغرافيا
    for (const gov of SEED_DATA.governorates) {
      const govRef = doc(collection(this.db, paths.governorates(this.companyId)));
      batch.set(govRef, {
        name: gov.name,
        nameEn: gov.nameEn,
        order: gov.order,
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (const area of gov.areas) {
        const areaRef = doc(collection(this.db, paths.areas(this.companyId, govRef.id)));
        batch.set(areaRef, {
          ...area,
          governorateId: govRef.id,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // 3. الهيكل الفني
    const activityRefs: Record<string, string> = {};
    const serviceRefs: Record<string, string> = {};
    const subServiceRefs: Record<string, string> = {};
    const stageRefs: Record<string, string> = {};

    for (const act of SEED_DATA.activityTypes) {
      const actRef = doc(collection(this.db, paths.activityTypes(this.companyId)));
      activityRefs[act.code] = actRef.id;
      batch.set(actRef, {
        code: act.code,
        name: act.name,
        nameEn: act.nameEn,
        order: act.order,
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (const srv of act.services) {
        const srvRef = doc(collection(this.db, paths.services(this.companyId, actRef.id)));
        serviceRefs[srv.code] = srvRef.id;
        batch.set(srvRef, {
          code: srv.code,
          name: srv.name,
          nameEn: srv.nameEn,
          order: srv.order,
          activityTypeId: actRef.id,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        for (const sub of srv.subServices) {
          const subRef = doc(collection(this.db, paths.subServices(this.companyId, actRef.id, srvRef.id)));
          subServiceRefs[sub.code] = subRef.id;
          batch.set(subRef, {
            code: sub.code,
            name: sub.name,
            nameEn: sub.nameEn,
            order: sub.order,
            activityTypeId: actRef.id,
            serviceId: srvRef.id,
            isActive: true,
            companyId: this.companyId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          for (const stage of sub.technicalStages) {
            const stageRef = doc(collection(this.db, paths.technicalStages(this.companyId, actRef.id, srvRef.id, subRef.id)));
            stageRefs[stage.code] = stageRef.id;
            
            const allowedDepts = [];
            if (act.code === 'CONSULTING') allowedDepts.push(deptRefs['ARCH']);
            if (act.code === 'CONSTRUCTION') allowedDepts.push(deptRefs['CIVIL']);

            batch.set(stageRef, {
              ...stage,
              id: stageRef.id,
              activityTypeId: actRef.id,
              serviceId: srvRef.id,
              subServiceId: subRef.id,
              fullPathName: `${act.name} > ${srv.name}`,
              allowedDepartmentIds: allowedDepts,
              isActive: true,
              companyId: this.companyId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }

    // 4. ضخ قوالب العقود المتخصصة (Design vs Construction)
    const contractTemplatesRef = collection(this.db, paths.contractTemplates(this.companyId));
    
    // أ. قالب التصميم الهندسي (0% Retention)
    const designTemplateRef = doc(contractTemplatesRef);
    batch.set(designTemplateRef, {
      id: designTemplateRef.id,
      name: 'اتفاقية أتعاب تصميم معماري وهندسي',
      nameEn: 'Engineering Design Fee Agreement',
      code: 'TPL-ARCH-01',
      activityTypeId: activityRefs['CONSULTING'],
      serviceId: serviceRefs['RESIDENTIAL_DESIGN'],
      subServiceId: subServiceRefs['MUN-PERMIT'],
      baseAmount: 1500,
      retentionRate: 0, 
      pricingMode: 'fixed',
      isActive: true,
      isDefault: true,
      defaultMilestones: [
        { name: 'دفعة عند توقيع العقد', percentage: 20, timing: 'at', technicalStageId: 'SIGNING' },
        { name: 'دفعة عند اعتماد المسقط الأفقي المعماري', percentage: 40, timing: 'after', technicalStageId: stageRefs['ARCH-APPR'] },
        { name: 'دفعة عند تسليم المخطط النهائي والمختوم', percentage: 40, timing: 'after', technicalStageId: stageRefs['ENG-STAMP'] },
      ],
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // ب. قالب أعمال المقاولات (5% Retention)
    const constTemplateRef = doc(contractTemplatesRef);
    batch.set(constTemplateRef, {
      id: constTemplateRef.id,
      name: 'عقد تنفيذ أعمال الهيكل الأسود',
      nameEn: 'Construction Skeleton Execution Contract',
      code: 'TPL-CONST-01',
      activityTypeId: activityRefs['CONSTRUCTION'],
      serviceId: serviceRefs['SKELETON_WORKS'],
      subServiceId: subServiceRefs['VILLA-SKELETON'],
      baseAmount: 45000,
      retentionRate: 5, 
      pricingMode: 'percentage',
      isActive: true,
      isDefault: true,
      defaultMilestones: [
        { name: 'دفعة مقدمة (مباشرة الحفر)', percentage: 10, timing: 'at', technicalStageId: stageRefs['EXCAVATION'] },
        { name: 'دفعة صب القواعد والأساسات', percentage: 20, timing: 'after', technicalStageId: stageRefs['FOOTINGS'] },
        { name: 'دفعة صب أعمدة الدور الأرضي', percentage: 15, timing: 'after', technicalStageId: stageRefs['COLUMNS-G'] },
        { name: 'دفعة صب سقف الدور الأرضي', percentage: 25, timing: 'after', technicalStageId: stageRefs['SLAB-G'] },
      ],
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

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
   * ضخ شجرة الحسابات القياسية لشركات المقاولات
   * يتم تأسيس مراكز التكلفة والربحية الإدارية آلياً لضمان التوافق مع محرك التحقق
   */
  async seedConstructionCOA(userId: string) {
    const batch = writeBatch(this.db);
    const coaRef = collection(this.db, paths.accounts(this.companyId));
    
    // 1. تأسيس مراكز الأبعاد المالية الإدارية (Sovereign Foundations)
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

    const tree = [
      { code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'asset', isGroup: true, parentId: null, level: 1 },
      { code: '11', nameAr: 'الأصول غير المتداولة', nameEn: 'Non-Current Assets', type: 'asset', isGroup: true, parentId: '1', level: 2 },
      { code: '1101', nameAr: 'آليات ومعدات ثقيلة', nameEn: 'Heavy Machinery & Equipment', type: 'asset', isGroup: true, parentId: '11', level: 3 },
      { code: '12', nameAr: 'الأصول المتداولة', nameEn: 'Current Assets', type: 'asset', isGroup: true, parentId: '1', level: 2 },
      { code: '1201', nameAr: 'الصناديق والبنوك', nameEn: 'Cash & Banks', type: 'asset', isGroup: true, parentId: '12', level: 3 },
      { code: '1202', nameAr: 'ذمم العملاء', nameEn: 'Accounts Receivable', type: 'asset', isGroup: true, parentId: '12', level: 3 },
      { code: '1203', nameAr: 'محتجزات لدى العملاء', nameEn: 'Retentions Receivable', type: 'asset', isGroup: true, parentId: '12', level: 3 },
      { code: '1204', nameAr: 'مخزون مواد البناء', nameEn: 'Inventory - Raw Materials', type: 'asset', isGroup: true, parentId: '12', level: 3 },
      { code: '1205', nameAr: 'أعمال تحت التنفيذ (WIP)', nameEn: 'Work In Progress', type: 'asset', isGroup: true, parentId: '12', level: 3 },
      
      { code: '2', nameAr: 'الالتزامات', nameEn: 'Liabilities', type: 'liability', isGroup: true, parentId: null, level: 1 },
      { code: '22', nameAr: 'الالتزامات المتداولة', nameEn: 'Current Liabilities', type: 'liability', isGroup: true, parentId: '2', level: 2 },
      { code: '2201', nameAr: 'ذمم الموردين', nameEn: 'Accounts Payable', type: 'liability', isGroup: true, parentId: '22', level: 3 },
      { code: '2202', nameAr: 'محتجزات لمقاولي الباطن', nameEn: 'Retentions Payable', type: 'liability', isGroup: true, parentId: '22', level: 3 },
      
      { code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'equity', isGroup: true, parentId: null, level: 1 },
      { code: '301', nameAr: 'رأس المال', nameEn: 'Capital', type: 'equity', isGroup: false, parentId: '3', level: 2 },
      
      { code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'revenue', isGroup: true, parentId: null, level: 1 },
      { code: '401', nameAr: 'إيرادات عقود المقاولات', nameEn: 'Construction Contracts Revenue', type: 'revenue', isGroup: false, parentId: '4', level: 2 },
      
      { code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'expense', isGroup: true, parentId: null, level: 1 },
      { code: '501', nameAr: 'تكاليف تشغيلية مباشرة', nameEn: 'Direct Operational Costs', type: 'expense', isGroup: true, parentId: '5', level: 2 },
      { code: '50101', nameAr: 'تكاليف مواد', nameEn: 'Material Costs', type: 'expense', isGroup: false, parentId: '501', level: 3 },
      { code: '50102', nameAr: 'تكاليف عمالة موقع', nameEn: 'Site Labor Costs', type: 'expense', isGroup: false, parentId: '501', level: 3 },
      { code: '502', nameAr: 'مصاريف إدارية وعمومية', nameEn: 'General & Admin Expenses', type: 'expense', isGroup: true, parentId: '5', level: 2 },
      { code: '50201', nameAr: 'رواتب إدارية', nameEn: 'Admin Salaries', type: 'expense', isGroup: false, parentId: '502', level: 3 },
    ];

    const idMap: Record<string, string> = {};

    for (const item of tree) {
      const newRef = doc(coaRef);
      idMap[item.code] = newRef.id;
      
      batch.set(newRef, {
        ...item,
        id: newRef.id,
        parentId: item.parentId ? idMap[item.parentId] : null,
        companyId: this.companyId,
        isActive: true,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
  }
}
