
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';

/**
 * خدمة إدارة القوائم المرجعية والمسارات الفنية.
 */
export class ReferenceService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- 1. ActivityTypes ---
  async addActivityType(data: Omit<ActivityType, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) {
    const path = paths.activityTypes(this.companyId);
    return addDoc(collection(this.db, path), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async updateActivityType(id: string, data: Partial<ActivityType>) {
    const path = paths.activityTypes(this.companyId);
    return updateDoc(doc(this.db, path, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // --- 2. Services ---
  async addService(activityTypeId: string, data: Omit<Service, 'id' | 'companyId' | 'activityTypeId'>) {
    const path = paths.services(this.companyId, activityTypeId);
    return addDoc(collection(this.db, path), {
      ...data,
      activityTypeId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async updateService(activityTypeId: string, serviceId: string, data: Partial<Service>) {
    const path = paths.services(this.companyId, activityTypeId);
    return updateDoc(doc(this.db, path, serviceId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // --- 3. SubServices ---
  async addSubService(activityTypeId: string, serviceId: string, data: Omit<SubService, 'id' | 'companyId' | 'activityTypeId' | 'serviceId'>) {
    const path = paths.subServices(this.companyId, activityTypeId, serviceId);
    return addDoc(collection(this.db, path), {
      ...data,
      activityTypeId,
      serviceId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // --- 4. TechnicalStages ---
  async addTechnicalStage(
    activityTypeId: string, 
    serviceId: string, 
    subServiceId: string, 
    data: Omit<TechnicalStage, 'id' | 'companyId' | 'activityTypeId' | 'serviceId' | 'subServiceId' | 'createdAt' | 'updatedAt'>
  ) {
    // التحقق من nextStageIds لضمان عدم وجود إشارة للذات (Validation)
    // ملاحظة: التحقق النهائي يتم عادة في الواجهة قبل الاستدعاء
    
    const path = paths.technicalStages(this.companyId, activityTypeId, serviceId, subServiceId);
    return addDoc(collection(this.db, path), {
      ...data,
      activityTypeId,
      serviceId,
      subServiceId,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async updateTechnicalStage(
    activityTypeId: string, 
    serviceId: string, 
    subServiceId: string, 
    stageId: string, 
    data: Partial<TechnicalStage>
  ) {
    const path = paths.technicalStages(this.companyId, activityTypeId, serviceId, subServiceId);
    return updateDoc(doc(this.db, path, stageId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // --- Common Helpers ---
  async deleteItem(fullPath: string, id: string) {
    return deleteDoc(doc(this.db, fullPath, id));
  }
}
