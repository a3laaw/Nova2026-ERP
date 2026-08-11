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
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    const clientData = clientSnap.data();
    const nextCounter = (clientData.transactionCounter || 0) + 1;
    const transactionNumber = `${clientData.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

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

    const accService = new AccountingService(this.db, this.companyId);
    await accService.ensureControlAccount('1205', 'أعمال تحت التنفيذ (WIP)', 'Work In Progress', 'asset');
    await accService.createAutomaticSubAccount('1205', transactionId, `مشروع: ${data.subServiceName} (${transactionNumber})`, 'asset');

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `[إجراء نظام] تم فتح المعاملة الفنية بنجاح. المهندس المسؤول المعتمد: ${data.assignedEngineerName}.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return transactionId;
  }

  async deleteTransaction(transactionId: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    const transRef = doc(this.db, paths.transactions(this.companyId), transactionId);
    return deleteDoc(transRef);
  }

  async assignSubcontractor(transactionId: string, stageId: string, subId: string, subName: string, price: number) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    await updateDoc(stageRef, {
      subcontractorId: subId,
      subcontractorName: subName,
      subcontractorPrice: price,
      updatedAt: serverTimestamp()
    });
  }

  async addStageRevision(transactionId: string, stageId: string, content: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stage = stageSnap.data() as StageInstance;

    const batch = writeBatch(this.db);
    batch.update(stageRef, {
      revisionCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      stageId,
      type: 'revision_logged',
      content: `[تعديل فني] ${content}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // أتمتة مالية: تفعيل "أثناء التنفيذ" إذا كان الشرط يعتمد على وجود مراجعات (لمكتب التصميم والمقاولات)
    const billing = new BillingService(this.db, this.companyId);
    await billing.triggerMilestoneBilling(transactionId, stage.technicalStageId, 'during', userId, userName);
  }

  private verifyDeptAccess(stage: StageInstance, userDeptId?: string, isAssignedEngineer: boolean = false) {
    if (this.permissions.includes('*') || isAssignedEngineer) return;
    if (stage.allowedDepartmentIds && stage.allowedDepartmentIds.length > 0) {
      if (!userDeptId || !stage.allowedDepartmentIds.includes(userDeptId)) {
        throw new Error('RESTRICTED_DEPARTMENT');
      }
    }
  }

  async startStage(transactionId: string, stageId: string, userId: string, userName: string, userDeptId?: string, appointmentId?: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    this.verifyDeptAccess(stageData, userDeptId);

    await updateDoc(stageRef, {
      status: 'in-progress',
      startedAt: serverTimestamp(),
      startedByApptId: appointmentId || null,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      stageId,
      appointmentId: appointmentId || null,
      technicalStageId: stageData.technicalStageId,
      type: 'stage_start',
      content: `[مباشرة ميدانية] تم بدء العمل في المرحلة: ${stageData.name}`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // أتمتة مالية: تفعيل دفعة "عند البداية"
    const billing = new BillingService(this.db, this.companyId);
    await billing.triggerMilestoneBilling(transactionId, stageData.technicalStageId, 'at', userId, userName);
  }

  async completeStage(transactionId: string, stageId: string, userId: string, userName: string, userDeptId?: string, force: boolean = false, appointmentId?: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    this.verifyDeptAccess(stageData, userDeptId);

    const batch = writeBatch(this.db);
    batch.update(stageRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedByApptId: appointmentId || null,
      completedBy: userId,
      updatedAt: serverTimestamp()
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    batch.set(doc(timelineRef), {
      transactionId,
      stageId,
      appointmentId: appointmentId || null,
      type: 'stage_complete',
      content: `[إنجاز فني] تم إتمام العمل في المرحلة بنجاح: ${stageData.name}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // أتمتة مالية للمالك: تفعيل دفعة "بعد الانتهاء"
    const billing = new BillingService(this.db, this.companyId);
    await billing.triggerMilestoneBilling(transactionId, stageData.technicalStageId, 'after', userId, userName);

    // أتمتة مالية لمقاول الباطن: توليد مطالبة له فور إتمام المرحلة المنسوبة له
    if (stageData.subcontractorId && stageData.subcontractorPrice) {
       await billing.generateSubcontractorIPC(
          transactionId, 
          stageData.subcontractorId, 
          stageData.subcontractorName!, 
          stageData.subcontractorPrice, 
          `مستحقات إتمام المرحلة: ${stageData.name}`,
          userId
       );
    }
  }

  async initializeTechnicalPath(transactionId: string, activityId: string, serviceId: string, subServiceId: string, userId: string) {
    const instancesPath = paths.transactionStages(this.companyId, transactionId);
    const existingSnap = await getDocs(query(collection(this.db, instancesPath), limit(1)));
    if (!existingSnap.empty) return; 

    const stagesPath = paths.technicalStages(this.companyId, activityId, serviceId, subServiceId);
    const stagesSnap = await getDocs(query(collection(this.db, stagesPath), orderBy('order', 'asc')));

    const batch = writeBatch(this.db);
    stagesSnap.docs.forEach((d, idx) => {
      const stage = d.data() as TechnicalStage;
      const instanceRef = doc(collection(this.db, instancesPath));
      batch.set(instanceRef, {
        id: instanceRef.id,
        transactionId,
        technicalStageId: d.id,
        code: stage.code || 'STAGE',
        name: stage.name || '',
        order: idx,
        status: 'pending',
        isNumeric: !!stage.isNumeric,
        numericTarget: stage.numericTarget || 0,
        currentCount: 0,
        isTimed: !!stage.isTimed,
        timeTargetDays: stage.timeTargetDays || 0,
        allowedDepartmentIds: stage.allowedDepartmentIds || [],
        activityTypeId: activityId,
        serviceId: serviceId,
        subServiceId: subServiceId,
        companyId: this.companyId,
        revisionCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}
