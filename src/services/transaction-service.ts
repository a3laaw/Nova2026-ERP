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
  where
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent, StageInstance } from '@/types/transaction';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions/engine';
import { BOQExecutionService } from './boq-execution-service';
import { CommentService } from './comment-service';
import { differenceInHours, differenceInDays, format } from 'date-fns';

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

    const stagesPath = paths.technicalStages(this.companyId, data.activityTypeId, data.serviceId, data.subServiceId);
    const stagesSnap = await getDocs(collection(this.db, stagesPath));

    if (stagesSnap.empty) {
      throw new Error('لا يمكن فتح المعاملة لعدم وجود مراحل عمل معرّفة لهذا المسار.');
    }

    const sortedStages = stagesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as TechnicalStage))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

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

    sortedStages.forEach((stage, idx) => {
      const instanceRef = doc(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
      const instanceData: StageInstance = {
        transactionId,
        technicalStageId: stage.id!,
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
        activityTypeId: data.activityTypeId,
        serviceId: data.serviceId,
        subServiceId: data.subServiceId,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(instanceRef, instanceData);
    });

    await batch.commit();
    return transactionId;
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
      stageId: stageId, // Use Instance ID
      technicalStageId: stageData.technicalStageId, // Use Reference ID
      type: 'stage_start',
      content: `تم بدء العمل في المرحلة الفنية`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async completeStage(transactionId: string, stageId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    const boqService = new BOQExecutionService(this.db, this.companyId, this.permissions);
    const progress = await boqService.getTechnicalStageProgress(transactionId, stageData.technicalStageId);
    
    if (!progress.canComplete) {
      throw new Error(progress.reason || "لا يمكن إغلاق المرحلة لعدم كفاية الإنجاز في بنود المقايسة.");
    }

    await updateDoc(stageRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedBy: userId,
      updatedAt: serverTimestamp(),
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      stageId: stageId, // Use Instance ID
      technicalStageId: stageData.technicalStageId, // Use Reference ID
      type: 'stage_complete',
      content: `تم إنجاز المرحلة بنجاح`,
      userId,
      userName,
      isArchived: false,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async reopenStage(transactionId: string, stageId: string, userId: string, userName: string, clearLogs: boolean = false) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    const start = stageData.startedAt?.toDate();
    const end = stageData.completedAt?.toDate() || new Date();
    const durationText = start ? `${differenceInDays(end, start)}d ${differenceInHours(end, start) % 24}h` : '0d 0h';

    const batch = writeBatch(this.db);

    // 1. Reset current stage
    batch.update(stageRef, {
      status: 'in-progress',
      completedAt: null,
      completedBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });

    // 2. Sequential locking of next stage
    const nextOrder = (stageData.order || 0) + 1;
    const stagesRef = collection(this.db, paths.transactionStages(this.companyId, transactionId));
    const nextQ = query(stagesRef, where('order', '==', nextOrder));
    const nextSnap = await getDocs(nextQ);
    if (!nextSnap.empty) {
      batch.update(nextSnap.docs[0].ref, {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        updatedAt: serverTimestamp()
      });
    }

    // 3. Archive Timeline Events using actual stageId (Instance ID)
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    const timelineSnap = await getDocs(query(timelineRef, where('stageId', '==', stageId)));
    timelineSnap.docs.forEach(d => {
       if (!d.data().isArchived) {
          batch.update(d.ref, { isArchived: true, archivedAt: serverTimestamp() });
       }
    });

    await batch.commit();

    // 4. Document reopen in timeline
    await addDoc(timelineRef, {
      transactionId,
      stageId: stageId, // Instance ID
      technicalStageId: stageData.technicalStageId, // Reference ID
      type: 'stage_reopen',
      content: `تراجع عن الإكمال: تمت أرشفة محاولة سابقة استغرقت ${durationText}`,
      previousStart: stageData.startedAt || null,
      previousEnd: stageData.completedAt || null,
      durationText,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // 5. Archive stage comments
    const commentService = new CommentService(this.db, this.companyId, this.permissions);
    await commentService.archiveStageComments(transactionId, stageId);

    // 6. Archive execution logs (using technicalStageId for calculation integrity)
    const boqService = new BOQExecutionService(this.db, this.companyId, this.permissions);
    await boqService.archiveStageExecutions(transactionId, stageData.technicalStageId, clearLogs);
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
