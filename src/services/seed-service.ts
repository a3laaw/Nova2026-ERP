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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ReferenceListService } from './reference-list-service';
import { BOQReferenceNode } from '@/types/reference';

export class SeedService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * سكربت هجرة الهوية السيادي (Sovereign Identity Migration)
   * يمر على كافة المستخدمين لتوحيد حقول الأدوار (roleCode / role)
   */
  async runIdentityMigration() {
    const globalUsersRef = collection(this.db, 'global_users');
    const snap = await getDocs(globalUsersRef);
    const batch = writeBatch(this.db);
    let count = 0;

    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      const updates: any = {};

      // 1. استخراج وتوحيد roleCode
      if (data.roleId && data.companyId && !data.roleCode) {
        const roleSnap = await getDoc(doc(this.db, 'companies', data.companyId, 'roles', data.roleId));
        if (roleSnap.exists()) {
          updates.roleCode = roleSnap.data().code.toUpperCase();
        }
      } else if (data.roleCode) {
        updates.roleCode = data.roleCode.toUpperCase();
      } else if (data.role) {
        // إذا كان role موجود كنص فقط
        updates.roleCode = data.role.toUpperCase();
      }

      // 2. توحيد حقل role ليكون lowercase (للتوافق مع الواجهات القديمة)
      if (updates.roleCode) {
        updates.role = updates.roleCode.toLowerCase();
      }

      if (Object.keys(updates).length > 0) {
        batch.update(userDoc.ref, { ...updates, updatedAt: serverTimestamp() });
        count++;
      }
    }

    if (count > 0) await batch.commit();
    return count;
  }

  async runSeed() {
    const batch = writeBatch(this.db);
    
    // 1. الأقسام والوظائف (ربط سيادي مع الألوان)
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

    // 3. الهيكل الفني الرباعي (المسارات)
    const activityRefs: Record<string, string> = {};
    const serviceRefs: Record<string, string> = {};
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

    const rooms = [
       { name: 'القاعة الكبرى', nameEn: 'Grand Hall', order: 1 },
       { name: 'غرفة اجتماعات (1)', nameEn: 'Meeting Room 1', order: 2 },
       { name: 'المكتب الفني', nameEn: 'Technical Office', order: 3 },
    ];
    rooms.forEach(r => {
       const ref = doc(collection(this.db, paths.meetingRooms(this.companyId)));
       batch.set(ref, { ...r, isActive: true, companyId: this.companyId, createdAt: serverTimestamp() });
    });

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
      allowedActivityTypeIds: [activityRefs['CONSTRUCTION'] || ''],
      allowedActivityTypeNames: ['أعمال المقاولات والإنشاءات'],
      order: 1,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    } as BOQReferenceNode);

    const excavationRef = doc(collection(this.db, paths.boqReferenceNodes(this.companyId)));
    const excavationStageId = stageRefs['EXCAVATION'] || '';

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
      technicalStageId: excavationStageId,
      technicalStageIds: [excavationStageId],
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
}