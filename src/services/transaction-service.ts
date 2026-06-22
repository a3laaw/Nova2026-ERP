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
  updateDoc,
  getDoc,
  increment
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

    // 1. جلب بيانات العميل لتوليد الرقم المتسلسل المهني
    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    const clientInfo = clientSnap.data();
    
    // الترقيم الهرمي الذكي: رقم العميل + تسلسل المعاملة
    const sequence = (clientInfo?.transactionCounter || 0) + 1;
    const transactionNumber = `${clientInfo?.fileNumber || 'TR'}-${sequence.toString().padStart(2, '0')}`;

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

    // 2. حفظ المعاملة
    await setDoc(transactionRef, transactionData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionRef.path, operation: 'create', requestResourceData: transactionData
      }));
      throw err;
    });

    // 3. تحديث عداد المعاملات وحالة العميل
    await updateDoc(clientRef, { 
      transactionCounter: increment(1),
      status: 'contracted',
      updatedAt: serverTimestamp()
    });

    // 4. استنساخ المراحل الفنية من القالب المرجعي
    await this.cloneTechnicalStages(tId, data);
    
    // 5. توثيق الحدث في السجل التاريخي للعميل (بدون كود عشوائي)
    const clientService = new ClientService(this.db, this.companyId);
    await clientService.addHistory(data.clientId, {
      type: 'transaction_created',
      content: `فتح مسار فني جديد: ${data.subServiceName} (رقم: ${transactionNumber})`,
      userId, userName, companyId: this.companyId
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

    templateSnap.docs.forEach(docSnap => {
      const template = docSnap.data() as TechnicalStage;
      const instanceRef = doc(instancesRef);
      
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
        status: 'pending',
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    return await batch.commit();
  }

  async startStage(transactionId: string, instanceId: string, stageName: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), instanceId);
    await updateDoc(stageRef, { status: 'in-progress', startedAt: serverTimestamp(), updatedAt: serverTimestamp() });

    this.addTimelineEvent(transactionId, {
      type: 'stage_start', content: `بدء العمل في المرحلة: ${stageName}`, userId, userName, companyId: this.companyId
    });
  }

  async completeStage(transactionId: string, instanceId: string, stageName: string, userId: string, userName: string) {
    const stageRef = doc(this.db, paths.transactionStages(this.companyId, transactionId), instanceId);
    await updateDoc(stageRef, { status: 'completed', completedAt: serverTimestamp(), completedBy: userId, updatedAt: serverTimestamp() });

    this.addTimelineEvent(transactionId, {
      type: 'stage_complete', content: `تم إنجاز المرحلة بنجاح: ${stageName}`, userId, userName, companyId: this.companyId
    });

    const transactionRef = doc(this.db, paths.transactions(this.companyId), transactionId);
    await updateDoc(transactionRef, { status: 'in-progress', updatedAt: serverTimestamp() });
  }

  private addTimelineEvent(transactionId: string, event: Omit<TransactionTimelineEvent, 'id' | 'createdAt' | 'transactionId'>) {
    const path = paths.transactionTimeline(this.companyId, transactionId);
    addDoc(collection(this.db, path), { ...event, transactionId, createdAt: serverTimestamp() }).catch(() => {});
  }
}
