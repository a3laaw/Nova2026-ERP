'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent, StageInstance, StageInstanceStatus } from '@/types/transaction';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ClientService } from './client-service';

export class TransactionService {
  constructor(private db: Firestore, private companyId: string) {}

  async createTransaction(
    data: Omit<Transaction, 'id' | 'transactionNumber' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>,
    userId: string,
    userName: string
  ) {
    const transactionRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const tId = transactionRef.id;

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const transactionNumber = `TR-${yearMonth}-${rand}`;

    const transactionData: Transaction = {
      ...data,
      id: tId,
      transactionNumber,
      status: 'new',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    // تنفيذ فتح المعاملة
    await setDoc(transactionRef, transactionData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionRef.path,
        operation: 'create',
        requestResourceData: transactionData
      }));
      throw err;
    });

    // --- الربط الذكي للحالة (HR/CRM Logic) ---
    // بمجرد فتح معاملة، يتحول العميل تلقائياً لـ "متعاقد"
    const clientService = new ClientService(this.db, this.companyId);
    await clientService.markAsContracted(data.clientId, tId);

    // استنساخ المراحل الفنية
    this.cloneTechnicalStages(tId, data);
    
    this.addTimelineEvent(tId, {
      type: 'system',
      content: `تم فتح المسار الفني للمعاملة لـ ${data.subServiceName}`,
      userId,
      userName,
      companyId: this.companyId
    });

    return tId;
  }

  private async cloneTechnicalStages(transactionId: string, context: any) {
    const { activityTypeId, serviceId, subServiceId } = context;
    const templatePath = paths.technicalStages(this.companyId, activityTypeId, serviceId, subServiceId);
    const templateSnap = await getDocs(query(collection(this.db, templatePath), orderBy('order')));
    
    if (templateSnap.empty) return;

    const batch = writeBatch(this.db);
    const instancesRef = collection(this.db, paths.transactionStages(this.companyId, transactionId));

    const allNextIds = new Set<string>();
    templateSnap.docs.forEach(docSnap => {
      const stage = docSnap.data() as TechnicalStage;
      stage.nextStageIds?.forEach(id => allNextIds.add(id));
    });

    templateSnap.docs.forEach(docSnap => {
      const template = docSnap.data() as TechnicalStage;
      const instanceRef = doc(instancesRef);
      const isStartStage = !allNextIds.has(docSnap.id);
      
      batch.set(instanceRef, {
        transactionId,
        technicalStageId: docSnap.id,
        code: template.code,
        name: template.name,
        order: template.order,
        isNumeric: template.isNumeric,
        numericTarget: template.numericTarget,
        currentCount: 0,
        isTimed: template.isTimed,
        timeTargetDays: template.timeTargetDays,
        status: isStartStage ? 'pending' : 'blocked',
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    batch.commit();
  }

  async startStage(transactionId: string, instanceId: string, stageName: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), instanceId);
    updateDoc(stageRef, {
      status: 'in-progress' as StageInstanceStatus,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    this.addTimelineEvent(transactionId, {
      type: 'stage_start',
      content: `بدء العمل في المرحلة: ${stageName}`,
      userId,
      userName,
      companyId: this.companyId
    });
  }

  async completeStage(transactionId: string, instanceId: string, stageName: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), instanceId);
    updateDoc(stageRef, {
      status: 'completed' as StageInstanceStatus,
      completedAt: serverTimestamp(),
      completedBy: userId,
      updatedAt: serverTimestamp()
    });

    this.addTimelineEvent(transactionId, {
      type: 'stage_complete',
      content: `تم إنجاز المرحلة بنجاح: ${stageName}`,
      userId,
      userName,
      companyId: this.companyId
    });

    const transactionRef = doc(this.db, paths.transactions(this.companyId), transactionId);
    updateDoc(transactionRef, { status: 'in-progress', updatedAt: serverTimestamp() });
  }

  async updateStageNumeric(transactionId: string, instanceId: string, stageName: string, value: number, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), instanceId);
    updateDoc(stageRef, {
      currentCount: value,
      updatedAt: serverTimestamp()
    });

    this.addTimelineEvent(transactionId, {
      type: 'numeric_update',
      content: `تحديث الإنجاز في مرحلة ${stageName} إلى: ${value}`,
      userId,
      userName,
      companyId: this.companyId
    });
  }

  addTimelineEvent(transactionId: string, event: Omit<TransactionTimelineEvent, 'id' | 'createdAt' | 'transactionId'>) {
    const path = paths.transactionTimeline(this.companyId, transactionId);
    const eventData = {
      ...event,
      transactionId,
      createdAt: serverTimestamp()
    };
    addDoc(collection(this.db, path), eventData).catch(() => {});
  }
}
