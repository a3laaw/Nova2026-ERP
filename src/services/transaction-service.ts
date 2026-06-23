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
    
    // 1. إنفاذ الصلاحيات الميدانية (Security Enforcement)
    ensureActionPermission(this.permissions, 'projects:create');

    // 2. التحقق من وجود العميل واستخراج العداد
    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND: العميل غير موجود في النظام.');
    }

    // 3. قراءة المراحل الفنية المرجعية (Template Stages)
    const stagesPath = paths.technicalStages(this.companyId, data.activityTypeId, data.serviceId, data.subServiceId);
    // جلب كافة المراحل
    const stagesSnap = await getDocs(collection(this.db, stagesPath));

    // معالجة واضحة في حال عدم وجود مراحل (Process Guard)
    if (stagesSnap.empty) {
      throw new Error('لا يمكن فتح المعاملة لعدم وجود مراحل عمل معرّفة لهذا المسار في مركز المراجع. يرجى إضافة مراحل للخدمة الفرعية أولاً.');
    }

    // ترتيب المراحل برمجياً لضمان المرونة
    const sortedStages = stagesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as TechnicalStage))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const clientData = clientSnap.data();
    const currentCounter = clientData.transactionCounter || 0;
    const nextCounter = currentCounter + 1;

    // 4. توليد الرقم المتسلسل المهني (رقم الملف - تسلسل المعاملة)
    const transactionNumber = `${clientData.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

    // 5. تجهيز العملية الذرية (Atomic Batch)
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

    // استنساخ المراحل المرتبة مع تطهير البيانات من قيم undefined
    sortedStages.forEach(stage => {
      const instanceRef = doc(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
      
      // تأمين البيانات من قيم undefined التي ترفضها فايربيز
      const instanceData: StageInstance = {
        transactionId,
        technicalStageId: stage.id!,
        code: stage.code || (stage.nameEn || stage.name || 'STAGE').toUpperCase().replace(/\s+/g, '_'),
        name: stage.name || '',
        description: stage.description || '',
        order: stage.order || 0,
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

    // تسجيل في الجدول الزمني
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم افتتاح المعاملة الفنية بنجاح واستنساخ ${sortedStages.length} مراحل تنفيذية من المسار المرجعي.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // تسجيل في تاريخ العميل
    const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, data.clientId)));
    batch.set(historyRef, {
      clientId: data.clientId,
      type: 'transaction_created',
      content: `تم فتح معاملة فنية جديدة برقم ${transactionNumber}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
      return transactionId;
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: transRef.path,
          operation: 'write',
          requestResourceData: transactionData
        }));
      }
      throw err;
    }
  }
}