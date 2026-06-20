
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
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent, StageInstance } from '@/types/transaction';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export class TransactionService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء معاملة جديدة مع استنساخ المسار الفني المرجعي
   */
  async createTransaction(
    data: Omit<Transaction, 'id' | 'transactionNumber' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>,
    userId: string,
    userName: string
  ) {
    const transactionRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const tId = transactionRef.id;

    // 1. توليد رقم المعاملة
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

    try {
      // 2. كتابة سجل المعاملة الأساسي
      await setDoc(transactionRef, transactionData);

      // 3. استنساخ المراحل الفنية (Templates -> Runtime Instances)
      await this.cloneTechnicalStages(tId, data);

      // 4. إنشاء أول حدث في التايم لاين
      this.addTimelineEvent(tId, {
        type: 'system',
        content: `تم فتح المعاملة بنجاح واستنساخ مراحل العمل لـ ${data.subServiceName}`,
        userId,
        userName,
        companyId: this.companyId
      });

      return tId;
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionRef.path,
        operation: 'create',
        requestResourceData: transactionData
      }));
      throw err;
    }
  }

  /**
   * محرك استنساخ المراحل الفنية
   */
  private async cloneTechnicalStages(transactionId: string, context: any) {
    const { activityTypeId, serviceId, subServiceId } = context;
    
    // جلب القوالب المرجعية
    const templatePath = paths.technicalStages(this.companyId, activityTypeId, serviceId, subServiceId);
    const templateSnap = await getDocs(query(collection(this.db, templatePath), orderBy('order')));
    
    if (templateSnap.empty) return;

    const batch = writeBatch(this.db);
    const instancesRef = collection(this.db, paths.transactionStages(this.companyId, transactionId));

    // استخراج كافة المعرفات التي تعتبر "لاحقة" (Successors) لتحديد البداية
    const allNextIds = new Set<string>();
    templateSnap.docs.forEach(doc => {
      const stage = doc.data() as TechnicalStage;
      stage.nextStageIds?.forEach(id => allNextIds.add(id));
    });

    templateSnap.docs.forEach(docSnap => {
      const template = docSnap.data() as TechnicalStage;
      const instanceRef = doc(instancesRef);
      
      // منطق الحالة الأولية:
      // إذا كان القالب غير مذكور في أي nextStageIds، فهو غالباً مرحلة بداية
      const isStartStage = !allNextIds.has(docSnap.id);
      
      const instanceData: StageInstance = {
        transactionId,
        technicalStageId: docSnap.id,
        code: template.code,
        name: template.name,
        description: template.description || '',
        order: template.order,
        isNumeric: template.isNumeric,
        numericTarget: template.numericTarget,
        currentCount: 0,
        isTimed: template.isTimed,
        timeTargetDays: template.timeTargetDays,
        isRequired: template.isRequired,
        isEditable: template.isEditable,
        nextStageIds: template.nextStageIds || [],
        status: isStartStage ? 'pending' : 'blocked',
        companyId: this.companyId,
        activityTypeId,
        serviceId,
        subServiceId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(instanceRef, instanceData);
    });

    await batch.commit();
  }

  /**
   * إضافة حدث للسجل الزمني
   */
  addTimelineEvent(transactionId: string, event: Omit<TransactionTimelineEvent, 'id' | 'createdAt' | 'transactionId'>) {
    const path = paths.transactionTimeline(this.companyId, transactionId);
    const eventData = {
      ...event,
      transactionId,
      createdAt: serverTimestamp()
    };
    addDoc(collection(this.db, path), eventData);
  }
}
