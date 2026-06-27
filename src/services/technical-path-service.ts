'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  getDocs,
  query,
  orderBy,
  collectionGroup,
  where
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';

/**
 * خدمة إدارة المسارات الفنية والمراحل (Technical Path & Stages Service).
 */
export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب كافة المراحل الفنية المعرفة للمنشأة مع مسارها الهيكلي.
   * تم تبسيط الاستعلام لتجنب الحاجة لفهارس مركبة لضمان العمل الفوري.
   */
  async getAllCompanyStages(): Promise<TechnicalStage[]> {
    // ملاحظة: أزلنا orderBy لتجنب الحاجة لفهرس COLLECTION_GROUP_ASC يدوي
    const q = query(
      collectionGroup(this.db, 'stages'),
      where('companyId', '==', this.companyId)
    );
    
    return getDocs(q)
      .then(snap => {
        const stages = snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage));
        // فرز يدوي في الذاكرة لتوفير الفهارس
        return stages.sort((a, b) => (a.order || 0) - (b.order || 0));
      })
      .catch(async (err) => {
        console.warn("Stages index might be missing, returning empty list. Error:", err.message);
        return [];
      });
  }

  async addActivityType(data: Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.activityTypes(this.companyId);
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData);
  }

  async updateActivityType(id: string, data: Partial<ActivityType>) {
    const path = paths.activityTypes(this.companyId);
    return updateDoc(doc(this.db, path, id), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteActivityType(id: string) {
    const path = paths.activityTypes(this.companyId);
    return deleteDoc(doc(this.db, path, id));
  }

  async addService(actId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    const docData = { ...data, activityTypeId: actId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData);
  }

  async updateService(actId: string, srvId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    return updateDoc(doc(this.db, path, srvId), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteService(actId: string, srvId: string) {
    const path = paths.services(this.companyId, actId);
    return deleteDoc(doc(this.db, path, srvId));
  }

  async addSubService(actId: string, srvId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return addDoc(collection(this.db, path), docData);
  }

  async updateSubService(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    return updateDoc(doc(this.db, path, subId), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteSubService(actId: string, srvId: string, subId: string) {
    const path = paths.subServices(this.companyId, actId, srvId);
    return deleteDoc(doc(this.db, path, subId));
  }

  async addTechnicalStage(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docData = { 
      ...data, 
      activityTypeId: actId, 
      serviceId: srvId, 
      subServiceId: subId, 
      companyId: this.companyId, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    };
    return addDoc(collection(this.db, path), docData);
  }

  async updateTechnicalStage(actId: string, srvId: string, subId: string, stageId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    return updateDoc(doc(this.db, path, stageId), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteTechnicalStage(actId: string, srvId: string, subId: string, stageId: string) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    return deleteDoc(doc(this.db, path, stageId));
  }

  async reorderStages(actId: string, srvId: string, subId: string, stages: TechnicalStage[]) {
    const batch = writeBatch(this.db);
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    
    stages.forEach((stage, index) => {
      if (stage.id) {
        const docRef = doc(this.db, path, stage.id);
        batch.update(docRef, { order: index, updatedAt: serverTimestamp() });
      }
    });

    return batch.commit();
  }
}
