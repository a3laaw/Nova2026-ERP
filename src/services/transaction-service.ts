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

  private verifyDeptAccess(stage: StageInstance, userDeptId?: string, isAssignedEngineer: boolean = false) {
    if (this.permissions.includes('*') || isAssignedEngineer) return;
    if (stage.allowedDepartmentIds && stage.allowedDepartmentIds.length > 0) {
      if (!userDeptId || !stage.allowedDepartmentIds.includes(userDeptId)) {
        throw new Error('RESTRICTED_DEPARTMENT: عذراً، هذه المرحلة تتبع قسم آخر ولا يمكن المباشرة بها من قبلك.');
      }
    }
  }

  private async getIsAssignedEngineer(transactionId: string, userId: string): Promise<boolean> {
     const transSnap = await getDoc(doc(this.db, paths.transactions(this.companyId), transactionId));
     const transData = transSnap.data();
     if (!transData) return false;
     const userSnap = await getDoc(doc(this.db, 'global_users', userId));
     const userData = userSnap.data();
     return transData.assignedEngineerId === userData?.employeeId;
  }

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
      content: `[إجراء نظام] تم فتح المعاملة الفنية بنجاح. المهندس المسؤول المعتمد: ${data.assignedEngineerName}.`,
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
        allowedDepartmentIds: stage.allowedDepartmentIds || [],
        status: 'pending',
        activityTypeId: activityId,
        serviceId: serviceId,
        subServiceId: subServiceId,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        revisionCount: 0
      };
      batch.set(instanceRef, instanceData);
    });

    await batch.commit();
  }

  async incrementStageRevision(transactionId: string, stageId: string, userId: string, userName: string, notes: string = "", userDeptId?: string, appointmentId?: string) {
    const isAssigned = await this.getIsAssignedEngineer(transactionId, userId);
    if (!isAssigned) {
       ensureActionPermission(this.permissions, 'projects:edit');
    }

    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    this.verifyDeptAccess(stageData, userDeptId, isAssigned);

    const nextRev = (stageData.revisionCount || 0) + 1;

    await updateDoc(stageRef, {
      revisionCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      stageId,
      appointmentId: appointmentId || null,
      technicalStageId: stageData.technicalStageId,
      type: 'revision_logged',
      content: `[مراجعة #${nextRev}] تم تسجيل دورة تعديل مخطط للمرحلة: ${stageData.name}`,
      notes, 
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    if (notes.trim()) {
       const commentService = new CommentService(this.db, this.companyId, this.permissions);
       await commentService.addTransactionComment(
          transactionId,
          `[دورة تعديل #${nextRev}] ${notes}`,
          userId,
          userName,
          stageId,
          stageData.name,
          'note',
          appointmentId
       );
    }
  }

  async startStage(transactionId: string, stageId: string, userId: string, userName: string, userDeptId?: string, appointmentId?: string) {
    const isAssigned = await this.getIsAssignedEngineer(transactionId, userId);
    if (!isAssigned) {
       ensureActionPermission(this.permissions, 'projects:edit');
    }

    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    this.verifyDeptAccess(stageData, userDeptId, isAssigned);

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
  }

  async completeStage(transactionId: string, stageId: string, userId: string, userName: string, userDeptId?: string, force: boolean = false, appointmentId?: string) {
    const isAssigned = await this.getIsAssignedEngineer(transactionId, userId);
    if (!isAssigned) {
       ensureActionPermission(this.permissions, 'projects:edit');
    }
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    this.verifyDeptAccess(stageData, userDeptId, isAssigned);

    if (!force) {
      const boqService = new BOQExecutionService(this.db, this.companyId, this.permissions);
      const progress = await boqService.getTechnicalStageProgress(transactionId, stageData.technicalStageId);
      
      if (!progress.canComplete) {
        throw new Error(progress.reason || "لا يمكن إغلاق المرحلة قبل اكتمال 100% من البنود المرتبطة بها.");
      }
    }

    const batch = writeBatch(this.db);
    
    batch.update(stageRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedByApptId: appointmentId || null,
      completedBy: userId,
      updatedAt: serverTimestamp(),
      isForceClosed: force || false
    });

    const nextStagesQuery = query(
      collection(this.db, paths.transactionStages(this.companyId, transactionId)),
      where('order', '==', (stageData.order || 0) + 1),
      limit(1)
    );
    
    const nextSnap = await getDocs(nextStagesQuery);
    let autoStartedStageName = "";

    if (!nextSnap.empty) {
      const nextDoc = nextSnap.docs[0];
      const nextData = nextDoc.data() as StageInstance;
      if (nextData.status === 'pending') {
         batch.update(nextDoc.ref, {
           status: 'in-progress',
           startedAt: serverTimestamp(),
           updatedAt: serverTimestamp(),
           updatedBy: 'SYSTEM_AUTO'
         });
         autoStartedStageName = nextData.name;
      }
    }

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    
    const completeLogRef = doc(timelineRef);
    batch.set(completeLogRef, {
      transactionId,
      stageId,
      appointmentId: appointmentId || null,
      technicalStageId: stageData.technicalStageId,
      type: 'stage_complete',
      content: force 
        ? `[اعتماد إداري] تم إغلاق المرحلة إجبارياً: ${stageData.name}`
        : `[إنجاز فني] تم إتمام العمل في المرحلة بنجاح: ${stageData.name}`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    if (autoStartedStageName) {
      const autoStartLogRef = doc(timelineRef);
      batch.set(autoStartLogRef, {
        transactionId,
        type: 'stage_start',
        content: `[تنشيط تلقائي] تم تفعيل المرحلة التالية (${autoStartedStageName}) فور إنجاز سابقتها لضمان استمرارية التدفق الميداني.`,
        userId: 'SYSTEM',
        userName: 'محرك NovaFlow الذكي',
        isArchived: false,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();
  }

  async reopenStage(transactionId: string, stageId: string, userId: string, userName: string) {
    const isAssigned = await this.getIsAssignedEngineer(transactionId, userId);
    if (!isAssigned) {
       ensureActionPermission(this.permissions, 'projects:edit');
    }
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    const batch = writeBatch(this.db);
    
    batch.update(stageRef, {
      status: 'in-progress',
      completedAt: null,
      completedBy: null,
      completedByApptId: null,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    const allStagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
    const affectedStageIds: string[] = [stageId];

    allStagesSnap.docs.forEach(d => {
       const s = d.data() as StageInstance;
       if (s.order > stageData.order) {
          batch.update(d.ref, {
             status: 'pending',
             startedAt: null,
             completedAt: null,
             completedBy: null,
             completedByApptId: null,
             startedByApptId: null,
             updatedAt: serverTimestamp()
          });
          affectedStageIds.push(d.id!);
       }
    });

    const commentService = new CommentService(this.db, this.companyId, this.permissions);
    const boqService = new BOQExecutionService(this.db, this.companyId, this.permissions);

    for (const sid of affectedStageIds) {
       await commentService.archiveStageComments(transactionId, sid);
       const sData = allStagesSnap.docs.find(d => d.id === sid)?.data() as StageInstance;
       if (sData) {
          await boqService.archiveStageExecutions(transactionId, sData.technicalStageId, true);
       }
    }

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      stageId,
      technicalStageId: stageData.technicalStageId,
      type: 'stage_reopen',
      content: `[إجراء استثنائي] إعادة فتح مرحلة "${stageData.name}" وتجميد المسار اللاحق وتطهير السجلات لضمان سلامة التنفيذ.`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  async deleteStageInstance(transactionId: string, stageId: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    return deleteDoc(stageRef);
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
