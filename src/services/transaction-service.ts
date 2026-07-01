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
import { BOQExecutionService } from './boq-execution-service';
import { CommentService } from './comment-service';

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
    
    ensureActionPermission(this.permissions, 'projects:create');

    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND: العميل غير موجود في النظام.');
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

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم فتح المعاملة الفنية بنجاح. بانتظار هندسة ميزانية المشروع (BOQ Setup).`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return transactionId;
  }

  async initializeTechnicalPath(transactionId: string, activityId: string, serviceId: string, subServiceId: string, userId: string) {
    const existingStagesSnap = await getDocs(query(
      collection(this.db, paths.transactionStages(this.companyId, transactionId)), 
      limit(1)
    ));
    
    if (!existingStagesSnap.empty) return;

    const stagesPath = paths.technicalStages(this.companyId, activityId, serviceId, subServiceId);
    const stagesSnap = await getDocs(query(collection(this.db, stagesPath), orderBy('order', 'asc')));

    if (stagesSnap.empty) return;

    const batch = writeBatch(this.db);
    stagesSnap.docs.forEach((d, idx) => {
      const stage = d.data() as TechnicalStage;
      const instanceRef = doc(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
      const instanceData: StageInstance = {
        transactionId,
        technicalStageId: d.id,
        code: stage.code || 'STAGE',
        name: stage.name || '',
        description: stage.description || '',
        order: stage.order !== undefined ? stage.order : idx,
        isNumeric: !!stage.isNumeric,
        numericTarget: stage.numericTarget || 0,
        currentCount: 0,
        isTimed: !!stage.isTimed,
        timeTargetDays: stage.timeTargetDays || 0,
        isRequired: !!stage.isRequired,
        isEditable: stage.isEditable !== false,
        nextStageIds: stage.nextStageIds || [],
        status: 'pending',
        activityTypeId: activityId,
        serviceId: serviceId,
        subServiceId: subServiceId,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(instanceRef, instanceData);
    });

    await batch.commit();
  }

  async startStage(transactionId: string, stageId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    await updateDoc(stageRef, {
      status: 'in-progress',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      stageId,
      technicalStageId: stageData.technicalStageId,
      type: 'stage_start',
      content: `تم بدء العمل في المرحلة الفنية: ${stageData.name}`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async completeStage(transactionId: string, stageId: string, userId: string, userName: string, force: boolean = false) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    if (!force) {
      const boqService = new BOQExecutionService(this.db, this.companyId, this.permissions);
      const progress = await boqService.getTechnicalStageProgress(transactionId, stageData.technicalStageId);
      
      if (!progress.canComplete) {
        throw new Error(progress.reason || "لا يمكن إغلاق المرحلة قبل اكتمال 100% من البنود المرتبطة بها.");
      }
    }

    await updateDoc(stageRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedBy: userId,
      updatedAt: serverTimestamp(),
      isForceClosed: force || false
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      stageId,
      technicalStageId: stageData.technicalStageId,
      type: 'stage_complete',
      content: force 
        ? `تنبيه: تم إغلاق المرحلة إجبارياً (بواسطة المدير): ${stageData.name}`
        : `تم إنجاز المرحلة بنجاح: ${stageData.name}`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  /**
   * إعادة فتح مرحلة مكتملة (التراجع السيادي)
   * تم التحديث: الآن يقوم آلياً بتعطيل أي مراحل لاحقة كانت قيد التنفيذ لضمان سلامة المسار الفني.
   */
  async reopenStage(transactionId: string, stageId: string, userId: string, userName: string, clearLogs: boolean = false) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    const previousStart = stageData.startedAt;
    const previousEnd = stageData.completedAt;

    const batch = writeBatch(this.db);
    
    // 1. تحديث حالة المرحلة الحالية إلى "قيد التنفيذ"
    batch.update(stageRef, {
      status: 'in-progress',
      completedAt: null,
      completedBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    // 2. بروتوكول التصحيح التلقائي (Sequential Path Correction):
    // أي مرحلة ترتيبها (order) أكبر من المرحلة الحالية وهي حالياً In-Progress، يجب إعادتها لـ Pending.
    const allStagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
    allStagesSnap.docs.forEach(d => {
       const s = d.data() as StageInstance;
       if (s.order > stageData.order && s.status === 'in-progress') {
          batch.update(d.ref, {
             status: 'pending',
             startedAt: null,
             updatedAt: serverTimestamp()
          });
       }
    });

    // 3. توثيق الحدث السيادي
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      stageId,
      technicalStageId: stageData.technicalStageId,
      type: 'stage_reopen',
      content: `إجراء إداري: إعادة فتح مرحلة "${stageData.name}" للمراجعة. تم تجميد المراحل اللاحقة لضمان سلامة المسار.`,
      previousStart,
      previousEnd,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // 4. أرشفة سجلات التايم لاين المرتبطة بهذه المرحلة (التقارير الميدانية القديمة)
    if (clearLogs) {
      const timelineColl = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
      const timelineSnap = await getDocs(query(timelineColl, where('stageId', '==', stageId)));
      timelineSnap.docs.forEach(d => {
        if (d.data().isArchived !== true) {
          batch.update(d.ref, { isArchived: true, archivedAt: serverTimestamp() });
        }
      });
    }

    await batch.commit();

    // 5. أرشفة سجلات الإنجاز والتعليقات
    if (clearLogs) {
      const boqExecService = new BOQExecutionService(this.db, this.companyId, this.permissions);
      await boqExecService.archiveStageExecutions(transactionId, stageData.technicalStageId, true);
      
      const commentService = new CommentService(this.db, this.companyId, this.permissions);
      await commentService.archiveStageComments(transactionId, stageId);
    }
  }

  async deleteTransaction(transactionId: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, paths.transactions(this.companyId), transactionId));
    
    const subCollections = ['stageInstances', 'timeline', 'comments'];
    for (const sub of subCollections) {
       const snap = await getDocs(collection(this.db, `companies/${this.companyId}/transactions/${transactionId}/${sub}`));
       snap.forEach(d => batch.delete(d.ref));
    }
    
    await batch.commit();
  }
}
