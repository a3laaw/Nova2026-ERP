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
  orderBy
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent, StageInstance } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { TechnicalStage } from '@/types/reference';

/**
 * خدمة إدارة المعاملات الفنية (Technical Transactions Service).
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية، استنساخ المراحل، والربط الزمني.
 */
export class TransactionService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء معاملة فنية جديدة مع استنساخ كافة المراحل المرجعية وتوثيق الأحداث.
   */
  async createTransaction(data: {
    clientId: string;
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
    
    // 1. قراءة بيانات العميل لاستخراج العداد ورقم الملف
    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND: العميل غير موجود في قاعدة البيانات.');
    }

    const client = clientSnap.data();

    // 2. جلب المراحل الفنية المرجعية (Reference Technical Stages)
    const stagesPath = paths.technicalStages(this.companyId, data.activityTypeId, data.serviceId, data.subServiceId);
    const stagesSnap = await getDocs(query(collection(this.db, stagesPath), orderBy('order')));
    
    // 3. توليد الرقم المتسلسل المهني (رقم الملف - تسلسل المعاملة)
    const currentCounter = client.transactionCounter || 0;
    const nextCounter = currentCounter + 1;
    const transactionNumber = `${client.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

    // 4. تجهيز الـ Batch لإجراء عملية ذرية (Atomic)
    const batch = writeBatch(this.db);
    const transRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const transactionId = transRef.id;

    // أ. إنشاء سجل المعاملة الأساسي
    const transactionData: Transaction = {
      id: transactionId,
      transactionNumber,
      clientId: data.clientId,
      clientName: client.nameAr || '',
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

    // ب. إضافة حدث افتتاح المعاملة في الجدول الزمني (Timeline)
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    const timelineData: Omit<TransactionTimelineEvent, 'id'> = {
      transactionId,
      type: 'system',
      content: `تم افتتاح المعاملة الفنية بنجاح وبدء المسار التشغيلي لخدمة: ${data.subServiceName}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    };
    batch.set(timelineRef, timelineData);

    // ج. إضافة حدث في سجل تاريخ العميل (Client History)
    const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, data.clientId)));
    batch.set(historyRef, {
      clientId: data.clientId,
      type: 'transaction_created',
      content: `تم فتح معاملة فنية جديدة برقم: ${transactionNumber}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // د. تحديث عداد المعاملات في ملف العميل
    batch.update(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    // هـ. استنساخ المراحل الفنية إلى نسخ تنفيذية (Stage Instances)
    if (!stagesSnap.empty) {
      const instancesCollRef = collection(this.db, paths.transactionStages(this.companyId, transactionId));
      
      stagesSnap.docs.forEach((stageDoc) => {
        const refStage = stageDoc.data() as TechnicalStage;
        const instanceRef = doc(instancesCollRef);
        
        const instanceData: Omit<StageInstance, 'id'> = {
          transactionId,
          technicalStageId: stageDoc.id,
          code: refStage.code,
          name: refStage.name,
          description: refStage.description || '',
          order: refStage.order,
          isNumeric: refStage.isNumeric,
          numericTarget: refStage.numericTarget,
          currentCount: 0,
          isTimed: refStage.isTimed,
          timeTargetDays: refStage.timeTargetDays,
          isRequired: refStage.isRequired,
          isEditable: refStage.isEditable,
          nextStageIds: refStage.nextStageIds || [],
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
    }

    // 5. تنفيذ العملية الجماعية
    return batch.commit().catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transRef.path,
        operation: 'create',
        requestResourceData: transactionData
      }));
      throw err;
    });
  }
}
