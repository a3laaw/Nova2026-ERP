'use client';

import { 
  Firestore, 
  doc, 
  getDoc, 
  writeBatch, 
  serverTimestamp, 
  increment, 
  collection
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent } from '@/types/transaction';
import { ClientHistory } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المعاملات الفنية (Technical Transactions Service).
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية والترقيم المهني والتوثيق التاريخي.
 */
export class TransactionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إنشاء معاملة فنية جديدة مع التوثيق الكامل في سجلات العميل والزمن.
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
    
    // 1. إنفاذ الصلاحيات الميدانية
    ensureActionPermission(this.permissions, 'projects:create');

    // 2. قراءة بيانات العميل لاستخراج العداد الحالي
    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND: العميل غير موجود.');
    }

    const clientData = clientSnap.data();
    const currentCounter = clientData.transactionCounter || 0;
    const nextCounter = currentCounter + 1;

    // 3. توليد الرقم المتسلسل المهني (رقم الملف - تسلسل المعاملة)
    const transactionNumber = `${clientData.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

    // 4. تجهيز العملية الذرية (Atomic Batch) لضمان سلامة التوثيق
    const batch = writeBatch(this.db);
    const transRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const transactionId = transRef.id;

    const transactionData: Transaction = {
      id: transactionId,
      transactionNumber,
      clientId: data.clientId,
      clientName: clientData.nameAr || '',
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

    // أ. إنشاء سجل المعاملة
    batch.set(transRef, transactionData);

    // ب. تحديث عداد المعاملات في ملف العميل
    batch.update(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    // ج. إضافة حدث Timeline للمعاملة (التوثيق الزمني للمعاملة)
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    const timelineEvent: TransactionTimelineEvent = {
      transactionId,
      type: 'system',
      content: `تم افتتاح المعاملة الفنية برقم ${transactionNumber}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    };
    batch.set(timelineRef, timelineEvent);

    // د. إضافة حدث History لملف العميل (أرشفة المعاملة في سجل العميل التجاري)
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

    // 5. تنفيذ الـ Batch النهائي
    return batch.commit().catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transRef.path,
        operation: 'write',
        requestResourceData: transactionData
      }));
      throw err;
    });
  }
}
