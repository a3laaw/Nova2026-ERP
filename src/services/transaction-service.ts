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
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent, StageInstance } from '@/types/transaction';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';
import { BOQExecutionService } from './boq-execution-service';

/**
 * خدمة إدارة المعاملات الفنية (Technical Transactions Service).
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية والترقيم المهني واستنساخ مراحل العمل والتحديث الميداني.
 */
export class TransactionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إنشاء معاملة فنية جديدة مع استنساخ مراحل العمل المرجعية وتوثيق البداية.
   */
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

    // جلب القوالب المرجعية للمراحل
    const stagesPath = paths.technicalStages(this.companyId, data.activityTypeId, data.serviceId, data.subServiceId);
    const stagesSnap = await getDocs(collection(this.db, stagesPath));

    if (stagesSnap.empty) {
      throw new Error('لا يمكن فتح المعاملة لعدم وجود مراحل عمل معرّفة لهذا المسار في مركز المراجع. يرجى إضافة مراحل للخدمة الفرعية أولاً.');
    }

    const sortedStages = stagesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as TechnicalStage))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const clientData = clientSnap.data();
    const currentCounter = clientData.transactionCounter || 0;
    const nextCounter = currentCounter + 1;

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
        code: stage.code || (stage.nameEn || stage.name || 'STAGE').toUpperCase().replace(/\s+/g, '_'),
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

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم افتتاح المسار الفني بنجاح واستنساخ ${sortedStages.length} مراحل تنفيذية مرتبة.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
      return transactionId;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transRef.path, operation: 'write', requestResourceData: transactionData
      }));
      throw err;
    }
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
      type: 'stage_start',
      content: `بدء التنفيذ الميداني لمرحلة: ${stageData.name}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  /**
   * إكمال مرحلة (مشروط بإنجاز بنود المقايسة)
   */
  async completeStage(transactionId: string, stageId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), stageId);
    const stageSnap = await getDoc(stageRef);
    if (!stageSnap.exists()) return;
    const stageData = stageSnap.data() as StageInstance;

    // 1. التحقق السيادي من إنجاز بنود المقايسة المرتبطة بهذه المرحلة
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
      type: 'stage_complete',
      content: `تم إنجاز مرحلة "${stageData.name}" بالكامل بعد التحقق من المقايسة.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }
}
