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

/**
 * خدمة التغذية المرجعية (Seed Service).
 * مسؤولة عن ضخ البيانات المرجعية الأساسية للشركة عند الطلب.
 */
export class SeedService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تشغيل المحرك لضخ كافة البيانات المرجعية
   */
  async runSeed() {
    try {
      // 1. ضخ الهيكل التنظيمي
      await this.seedOrganization();
      
      // 2. ضخ الجغرافيا
      await this.seedGeography();
      
      // 3. ضخ أنواع الأنشطة
      await this.seedServiceTypes();
      
      // 4. ضخ المسارات الفنية (بناءً على الأنشطة)
      await this.seedTechnicalPaths();
      
      return { success: true };
    } catch (error) {
      console.error('Seed execution failed:', error);
      throw error;
    }
  }

  private async seedOrganization() {
    const batch = writeBatch(this.db);
    for (const dept of SEED_DATA.departments) {
      const deptRef = doc(collection(this.db, paths.departments(this.companyId)));
      batch.set(deptRef, {
        code: dept.code,
        name: dept.name,
        nameEn: dept.nameEn,
        order: dept.order,
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (const job of dept.jobs) {
        const jobRef = doc(collection(this.db, paths.jobs(this.companyId, deptRef.id)));
        batch.set(jobRef, {
          code: job.code,
          name: job.name,
          nameEn: job.nameEn,
          order: job.order,
          departmentId: deptRef.id,
          departmentCode: dept.code,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
    await batch.commit();
  }

  private async seedGeography() {
    const batch = writeBatch(this.db);
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
          name: area.name,
          nameEn: area.nameEn,
          order: area.order,
          governorateId: govRef.id,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
    await batch.commit();
  }

  private async seedServiceTypes() {
    const batch = writeBatch(this.db);
    for (const st of SEED_DATA.serviceTypes) {
      const stRef = doc(collection(this.db, paths.serviceTypes(this.companyId)));
      batch.set(stRef, {
        ...st,
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  }

  private async seedTechnicalPaths() {
    // نحتاج لجلب المعرفات الحقيقية لأنواع الأنشطة لربطها
    const serviceTypesSnap = await getDocs(collection(this.db, paths.serviceTypes(this.companyId)));
    const stMap = new Map(serviceTypesSnap.docs.map(d => [d.data().code, d.id]));

    for (const tx of SEED_DATA.transactionTypes) {
      const batch = writeBatch(this.db);
      const txRef = doc(collection(this.db, paths.transactionTypes(this.companyId)));
      
      batch.set(txRef, {
        code: tx.code,
        name: tx.name,
        nameEn: tx.nameEn,
        order: tx.order,
        serviceTypeId: stMap.get(tx.serviceTypeCode) || '',
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (const sub of tx.subServices) {
        const subRef = doc(collection(this.db, paths.subServices(this.companyId, txRef.id)));
        batch.set(subRef, {
          code: sub.code,
          name: sub.name,
          nameEn: sub.nameEn,
          order: sub.order,
          transactionTypeId: txRef.id,
          transactionTypeCode: tx.code,
          isCore: sub.isCore,
          isBillable: sub.isBillable,
          requiresTechnicalStages: sub.requiresTechnicalStages,
          isActive: true,
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        for (const stage of sub.stages) {
          const stageRef = doc(collection(this.db, paths.technicalStages(this.companyId, txRef.id, subRef.id)));
          batch.set(stageRef, {
            code: stage.code,
            name: stage.name,
            nameEn: stage.nameEn,
            order: stage.order,
            expectedDurationDays: stage.duration,
            stageType: stage.type,
            controlType: 'TimeBased',
            trackingType: 'Manual',
            isActive: true,
            companyId: this.companyId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
      await batch.commit();
    }
  }

  /**
   * للتحقق مما إذا كانت البيانات موجودة مسبقاً (حماية من التكرار)
   */
  async isSystemSeeded() {
    const q = query(collection(this.db, paths.departments(this.companyId)), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }
}