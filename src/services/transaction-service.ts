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
import { ClientHistory } from '@/types/client';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المعاملات الفنية (Technical Transactions Service).
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية والترقيم المهني واستنساخ مراحل العمل.
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
    
    // 1. إنفاذ الصلاحيات الميدانية
    ensureActionPermission(this.permissions, 'projects:create');

    // 2. التحقق من وجود العميل واستخراج العداد
    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND: العميل غير موجود في النظام.');
    }

    // 3. قراءة المراحل الفنية المرجعية (Template Stages)
    const stagesPath = paths.technicalStages(this.companyId, data.activityTypeId, data.serviceId, data.subServiceId);
    const stagesQuery = query(collection(this.db, stagesPath), orderBy('order'));
    const stagesSnap = await getDocs(stagesQuery);

    // معالجة واضحة في حال عدم وجود مراحل
    if (stagesSnap.empty) {
      throw new Error('NO_STAGES_DEFINED: لا يمكن فتح المعاملة لأن المسار الفني المختار لا يحتوي على مراحل عمل معرفة في مركز المراجع.');
    }

    const clientData = clientSnap.data();
    const currentCounter = clientData.transactionCounter || 0;
    const nextCounter = currentCounter + 1;

    // 4. توليد الرقم المتسلسل المهني (رقم الملف - تسلسل المعاملة)
    const transactionNumber = `${clientData.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

    // 5. تجهيز العملية الذرية (Atomic Batch) لضمان سلامة التوثيق والاستنساخ
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

    // أ. إنشاء سجل المعاملة الرئيسي
    batch.set(transRef, transactionData);

    // ب. تحديث عداد المعاملات في ملف العميل
    batch.update(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    // ج. استنساخ المراحل المرجعية إلى مراحل تنفيذية (Stage Instances)
    stagesSnap.docs.forEach(stageDoc => {
      const stage = stageDoc.data() as TechnicalStage;
      const instanceRef = doc(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
      
      const instanceData: StageInstance = {
        transactionId,
        technicalStageId: stageDoc.id,
        code: stage.code,
        name: stage.name,
        description: stage.description || '',
        order: stage.order,
        isNumeric: stage.isNumeric,
        numericTarget: stage.numericTarget,
        currentCount: 0,
        isTimed: stage.isTimed,
        timeTargetDays: stage.timeTargetDays,
        isRequired: stage.isRequired,
        isEditable: stage.isEditable,
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

    // د. توثيق الجدول الزمني للمعاملة
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    const timelineEvent: TransactionTimelineEvent = {
      transactionId,
      type: 'system',
      content: `تم افتتاح المعاملة الفنية برقم ${transactionNumber} واستنساخ ${stagesSnap.size} مراحل تنفيذية.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    };
    batch.set(timelineRef, timelineEvent);

    // هـ. توثيق سجل تاريخ العميل
    const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, data.clientId)));
    const historyEvent: ClientHistory = {
      clientId: data.clientId,
      type: 'transaction_created',
      content: `تم فتح معاملة فنية جديدة برقم ${transactionNumber}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    };
    batch.set(historyRef, historyEvent);

    // 6. تنفيذ الـ Batch النهائي وإعادة المعرف
    return batch.commit().then(() => transactionId).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transRef.path,
        operation: 'write',
        requestResourceData: transactionData
      }));
      throw err;
    });
  }
}
