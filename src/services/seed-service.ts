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
 * خدمة تهيئة النظام الموحدة (Consolidated Seed Service).
 * تقوم بضخ البيانات المرجعية حصراً في الهياكل الجديدة boqReferenceNodes.
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

    // 3. الهيكل الفني الرباعي (المسارات)
    const activityRefs: Record<string, string> = {};
    const serviceRefs: Record<string, string> = {};

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
              fullPathName: `${act.name} > ${srv.name}`,
              isActive: true,
              companyId: this.companyId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    }

    // 4. ضخ القاموس الهندسي الشجري الموحد (boqReferenceNodes)
    const rootCivilRef = doc(collection(this.db, paths.boqReferenceNodes(this.companyId)));
    batch.set(rootCivilRef, {
      code: 'CONSTRUCTION_ROOT',
      title: 'أعمال المقاولات والإنشاءات',
      parentId: null,
      depth: 0,
      ancestorIds: [],
      childrenCount: 1,
      nodeRole: 'group',
      isExecutable: false,
      isActive: true,
      allowedActivityTypeIds: [activityRefs['CONSULTING'] || ''],
      allowedActivityTypeNames: ['استشارات هندسية'],
      allowedServiceIds: [serviceRefs['RESIDENTIAL'] || ''],
      allowedServiceNames: ['بناء وتصميم سكني'],
      order: 1,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    } as BOQReferenceNode);

    const excavationRef = doc(collection(this.db, paths.boqReferenceNodes(this.companyId)));
    batch.set(excavationRef, {
      code: 'EXC_STR_01',
      title: 'حفريات القواعد والأساسات الإنشائية',
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
      allowedItemCategoryIds: ['CIVIL_MAT'],
      order: 1,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    } as BOQReferenceNode);

    await batch.commit().catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'seed_final_purge', operation: 'write'
      }));
      throw err;
    });

    const refListService = new ReferenceListService(this.db, this.companyId);
    await refListService.seedAllLists('SYSTEM_ADMIN');
  }

  async isSystemSeeded() {
    const q = query(collection(this.db, paths.boqReferenceNodes(this.companyId)), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }
}
