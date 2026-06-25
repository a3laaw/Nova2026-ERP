
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

export class TechnicalPathService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب كافة المراحل الفنية المعرفة للمنشأة (لأغراض الربط في القاموس)
   * تم تحصينها بقواعد الحماية العالمية
   */
  async getAllCompanyStages(): Promise<TechnicalStage[]> {
    const q = query(
      collectionGroup(this.db, 'stages'),
      where('companyId', '==', this.companyId),
      orderBy('order')
    );
    
    return getDocs(q)
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage)))
      .catch(async (err) => {
        // في حال فشل الصلاحيات، نطلق الخطأ السياقي السيادي لـ NovaFlow
        if (err.code === 'permission-denied' || err.message.includes('permissions')) {
          const permissionError = new FirestorePermissionError({
            path: 'collection_group_stages',
            operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        }
        return [];
      });
  }

  async addActivityType(data: Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.activityTypes(this.companyId);
    const docData = { ...data, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
    });
  }

  async updateActivityType(id: string, data: Partial<ActivityType>) {
    const path = paths.activityTypes(this.companyId);
    const docRef = doc(this.db, path, id);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
    });
  }

  async deleteActivityType(id: string) {
    const path = paths.activityTypes(this.companyId);
    const docRef = doc(this.db, path, id);
    
    deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
    });
  }

  async addService(actId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    const docData = { ...data, activityTypeId: actId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
    });
  }

  async updateService(actId: string, srvId: string, data: any) {
    const path = paths.services(this.companyId, actId);
    const docRef = doc(this.db, path, srvId);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
    });
  }

  async deleteService(actId: string, srvId: string) {
    const path = paths.services(this.companyId, actId);
    const docRef = doc(this.db, path, srvId);
    
    deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
    });
  }

  async addSubService(actId: string, srvId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
    });
  }

  async updateSubService(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docRef = doc(this.db, path, subId);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
    });
  }

  async deleteSubService(actId: string, srvId: string, subId: string) {
    const path = paths.subServices(this.companyId, actId, srvId);
    const docRef = doc(this.db, path, subId);
    
    deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
    });
  }

  async addTechnicalStage(actId: string, srvId: string, subId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docData = { ...data, activityTypeId: actId, serviceId: srvId, subServiceId: subId, companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    addDoc(collection(this.db, path), docData).catch((err) => {
      this.handleError(path, 'create', docData);
    });
  }

  async updateTechnicalStage(actId: string, srvId: string, subId: string, stageId: string, data: any) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docRef = doc(this.db, path, stageId);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch((err) => {
      this.handleError(docRef.path, 'update', data);
    });
  }

  async deleteTechnicalStage(actId: string, srvId: string, subId: string, stageId: string) {
    const path = paths.technicalStages(this.companyId, actId, srvId, subId);
    const docRef = doc(this.db, path, stageId);
    
    deleteDoc(docRef).catch((err) => {
      this.handleError(docRef.path, 'delete');
    });
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

    batch.commit().catch((err) => {
      this.handleError(path, 'update');
    });
  }

  private handleError(path: string, operation: any, data?: any) {
    const permissionError = new FirestorePermissionError({
      path,
      operation,
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  }
}
