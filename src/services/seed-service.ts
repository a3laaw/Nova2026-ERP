'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDocs,
  query,
  limit
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { SEED_DATA } from '@/lib/seed-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ReferenceListService } from './reference-list-service';
import { BOQReferenceNode } from '@/types/reference';

/**
 * خدمة تهيئة النظام (Seed Service).
 * تم تحديثها لضمان ضخ هيكل شجري موحد في boqReferenceNodes.
 */
export class SeedService {
  constructor(private db: Firestore, private companyId: string) {}

  async runSeed() {
    const batch = writeBatch(this.db);
    
    // 1. الأقسام والوظائف
    for (const dept of SEED_DATA.departments) {
      const deptRef = doc(collection(this.db, paths.departments(this.companyId)));
      batch.set(deptRef, {
        ...dept,
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

    // 3. الهيكل الفني الرباعي للمسارات
    const activityRefs: Record<string, string> = {};
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
            batch.set(stageRef, {
              ...stage,
              activityTypeId: actRef.id,
              serviceId: srvRef.id,
              subServiceId: subRef.id,
              isActive: true,
              companyId: this.companyId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }

    // 4. ضخ القاموس الهندسي الشجري الموحد (Unified Tree)
    // نقوم ببناء هيكل افتراضي في boqReferenceNodes
    const rootCivilRef = doc(collection(this.db, paths.boqReferenceNodes(this.companyId)));
    batch.set(rootCivilRef, {
      code: 'CIVIL_WORKS',
      title: 'الأعمال المدنية والإنشائية',
      parentId: null,
      depth: 0,
      ancestorIds: [],
      childrenCount: 2,
      nodeRole: 'group',
      isExecutable: false,
      isActive: true,
      activityTypeIds: [activityRefs['CONSULTING'] || ''],
      order: 1,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    } as BOQReferenceNode);

    // إضافة بند تنفيذي تحت الجذر (مثال)
    const excavationRef = doc(collection(this.db, paths.boqReferenceNodes(this.companyId)));
    batch.set(excavationRef, {
      code: 'EXC_001',
      title: 'حفريات القواعد والأساسات',
      parentId: rootCivilRef.id,
      depth: 1,
      ancestorIds: [rootCivilRef.id],
      childrenCount: 0,
      nodeRole: 'work_item',
      isExecutable: true,
      isActive: true,
      unitName: 'متر مكعب',
      unitSymbol: 'CUM',
      estimatedRate: 2.5,
      order: 1,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    } as BOQReferenceNode);

    // تنفيذ الـ Batch (الهياكل والقواميس)
    await batch.commit().catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'batch_seed_unified', operation: 'write'
      }));
      throw err;
    });

    // 5. ضخ القوائم المرجعية الموحدة (عبر الخدمة المخصصة)
    const refListService = new ReferenceListService(this.db, this.companyId);
    await refListService.seedAllLists('SYSTEM_ADMIN');
  }

  async isSystemSeeded() {
    const q = query(collection(this.db, paths.activityTypes(this.companyId)), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }
}
