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
import { BillingService } from './billing-service';

export class TransactionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async createTransaction(data: {
    clientId: string;
    clientName: string;
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
    };

    batch.set(transRef, transactionData);
    batch.update(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    // --- الأتمتة المالية السيادية المزدوجة (WIP & Dimensions) ---
    const accService = new AccountingService(this.db, this.companyId);
    const shortProjectName = `${data.clientName} - ${data.subServiceName}`;
    const wipName = `${shortProjectName} (WIP)`;
    
    await accService.ensureControlAccount('1205', 'أعمال تحت التنفيذ', 'Work In Progress', 'asset');
    await accService.createAutomaticSubAccount('1205', transactionId, wipName, 'asset');

    // إنشاء الأبعاد التحليلية ثنائية اللغة آلياً
    await accService.createAutomaticProfitCenter(
      transactionId, 
      `مركز ربحية: ${shortProjectName}`, 
      `Profit Center: ${shortProjectName}`,
      `PC-${transactionNumber}`
    );

    await accService.createAutomaticCostCenter(
       transactionId,
       `تكلفة مشروع: ${shortProjectName}`,
       `Cost Center: ${shortProjectName}`,
       `CC-${transactionNumber}`,
       transactionId
    );

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId, type: 'system',
      content: `[إجراء سيادي] تم تأسيس حساب WIP ومركز ربحية وتكلفة للمشروع: ${shortProjectName}`,
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

  async startStage(transactionId: string, stageId: string, userId: string, userName: string, userDeptId?: string, appointmentId?: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    await updateDoc(stageRef, {
      status: 'in-progress', startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(), updatedBy: userId
    });

    const billing = new BillingService(this.db, this.companyId);
    await billing.triggerMilestoneBilling(transactionId, stageData.technicalStageId, 'at', userId, userName);
  }

  async completeStage(transactionId: string, stageId: string, userId: string, userName: string, userDeptId?: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    await updateDoc(stageRef, {
      status: 'completed', completedAt: serverTimestamp(),
      completedBy: userId, updatedAt: serverTimestamp()
    });

    const billing = new BillingService(this.db, this.companyId);
    await billing.triggerMilestoneBilling(transactionId, stageData.technicalStageId, 'after', userId, userName);
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
        revisionCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}
