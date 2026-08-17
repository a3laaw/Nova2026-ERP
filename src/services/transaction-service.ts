'use client';

import { 
  Firestore, 
  doc, 
  getDoc, 
  getDocs, 
  writeBatch, 
  serverTimestamp, 
  increment, 
  collection,
  query,
  orderBy,
  updateDoc,
  addDoc,
  deleteDoc,
  where,
  limit,
  setDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance } from '@/types/transaction';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions/engine';
import { AccountingService } from './accounting-service';

export class TransactionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async createTransaction(data: {
    clientId: string;
    clientName: string;
    nameAr: string;
    nameEn: string;
    activityTypeId: string;
    activityTypeName: string;
    serviceId: string;
    serviceName: string;
    subServiceId: string;
    subServiceName: string;
    assignedEngineerId: string;
    assignedEngineerName: string;
    description?: string;
  }, userId: string, userName: string) {
    
    ensureActionPermission(this.permissions, 'crm:create');

    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) throw new Error('CLIENT_NOT_FOUND');

    const clientData = clientSnap.data();
    const nextCounter = (clientData.transactionCounter || 0) + 1;
    const seqStr = nextCounter.toString().padStart(2, '0');
    const transactionNumber = `${clientData.fileNumber}-${seqStr}`;

    const batch = writeBatch(this.db);
    const transRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const transactionId = transRef.id;

    const transactionData: Transaction = {
      id: transactionId,
      transactionNumber,
      clientId: data.clientId,
      clientName: data.clientName,
      nameAr: data.nameAr || data.subServiceName,
      nameEn: data.nameEn || data.subServiceName,
      activityTypeId: data.activityTypeId,
      activityTypeName: data.activityTypeName,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      subServiceId: data.subServiceId,
      subServiceName: data.subServiceName,
      assignedEngineerId: data.assignedEngineerId,
      assignedEngineerName: data.assignedEngineerName,
      description: data.description || '',
      status: 'new',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId
    } as any;

    batch.set(transRef, transactionData);
    batch.update(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    // --- الأتمتة المالية السيادية المزدوجة (WIP & Dimensions) ---
    const accService = new AccountingService(this.db, this.companyId);
    const shortProjectNameAr = `${data.clientName} - ${data.subServiceName}`;
    const shortProjectNameEn = `${clientData.nameEn || 'Client'} - ${data.subServiceName}`;
    
    // 1. تأسيس حساب WIP في الأصول لترحيل التكاليف المباشرة
    await accService.ensureControlAccount('1205', 'أعمال تحت التنفيذ', 'Work In Progress', 'asset');
    await accService.createAutomaticSubAccount('1205', transactionId, `${shortProjectNameAr} (WIP)`, 'asset');

    // 2. إنشاء مركز ربحية (Profit Center) لمطاردة الإيرادات
    await accService.createAutomaticProfitCenter(
      transactionId, 
      `مركز ربحية: ${shortProjectNameAr}`, 
      `Profit Center: ${shortProjectNameEn}`,
      `PC-${transactionNumber}`
    );

    // 3. إنشاء مركز تكلفة (Cost Center) لمطاردة مصروفات الميدان
    await accService.createAutomaticCostCenter(
       transactionId,
       `تكلفة مشروع: ${shortProjectNameAr}`,
       `Cost Center: ${shortProjectNameEn}`,
       `CC-${transactionNumber}`,
       transactionId
    );

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId, type: 'system',
      content: `[أتمتة سيادية] تم تأسيس الهوية المالية للمشروع: حساب WIP، مركز ربحية، ومركز تكلفة مستقل.`,
      userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
    });

    await batch.commit();
    return transactionId;
  }

  async deleteTransaction(transactionId: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    const transRef = doc(this.db, paths.transactions(this.companyId), transactionId);
    return deleteDoc(transRef);
  }

  async startStage(transactionId: string, stageId: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    await updateDoc(stageRef, {
      status: 'in-progress', startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(), updatedBy: userId
    });
  }

  async completeStage(transactionId: string, stageId: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    await updateDoc(stageRef, {
      status: 'completed', completedAt: serverTimestamp(),
      completedBy: userId, updatedAt: serverTimestamp()
    });
  }

  async initializeTechnicalPath(transactionId: string, activityId: string, serviceId: string, subServiceId: string, userId: string) {
    const instancesPath = paths.transactionStages(this.companyId, transactionId);
    const stagesPath = paths.technicalStages(this.companyId, activityId, serviceId, subServiceId);
    const stagesSnap = await getDocs(query(collection(this.db, stagesPath), orderBy('order', 'asc')));

    const batch = writeBatch(this.db);
    stagesSnap.docs.forEach((d, idx) => {
      const stage = d.data() as TechnicalStage;
      const instanceRef = doc(collection(this.db, instancesPath));
      batch.set(instanceRef, {
        id: instanceRef.id, transactionId, technicalStageId: d.id,
        code: stage.code || 'STAGE', name: stage.name || '', order: idx,
        status: 'pending', currentCount: 0, activityTypeId: activityId,
        serviceId: serviceId, subServiceId: subServiceId, companyId: this.companyId,
        revisionCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        allowedDepartmentIds: stage.allowedDepartmentIds || []
      });
    });

    await batch.commit();
  }
}
