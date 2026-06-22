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
import { Transaction } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خدمة إدارة المعاملات الفنية (Technical Transactions Service).
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية والربط مع سجل العميل والجدول الزمني.
 */
export class TransactionService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء معاملة فنية جديدة مع توثيق الأحداث في السجل الزمني وسجل العميل
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
    
    // 2. توليد الرقم المتسلسل المهني (رقم الملف - تسلسل المعاملة)
    const currentCounter = client.transactionCounter || 0;
    const nextCounter = currentCounter + 1;
    const transactionNumber = `${client.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

    // 3. تجهيز مراجع المستندات
    const batch = writeBatch(this.db);
    const transRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const transactionId = transRef.id;

    // أ. بيانات المعاملة الأساسية
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

    // ب. إضافة حدث في الجدول الزمني للمعاملة (Timeline Event)
    const timelineRef = doc(collection(this.db, `${paths.transactions(this.companyId)}/${transactionId}/timeline`));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم افتتاح المعاملة الفنية بنجاح وبدء المسار التشغيلي لخدمة: ${data.subServiceName}`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

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

    // 4. تنفيذ العملية بشكل ذري (Atomic Transaction)
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
