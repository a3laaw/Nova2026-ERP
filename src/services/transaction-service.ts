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
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية والربط مع سجل العميل.
 */
export class TransactionService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء معاملة فنية جديدة برقم متسلسل مهني
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
  }, userId: string) {
    
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

    // 3. تجهيز بيانات المعاملة
    const transColl = collection(this.db, paths.transactions(this.companyId));
    const transRef = doc(transColl);
    
    const transactionData: Transaction = {
      id: transRef.id,
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

    // 4. تنفيذ العملية بشكل ذري (Atomic Transaction)
    // نستخدم الـ Batch لضمان تزامن إنشاء المعاملة مع تحديث عداد العميل
    const batch = writeBatch(this.db);
    
    batch.set(transRef, transactionData);
    
    batch.update(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    return batch.commit().catch((err) => {
      // إرسال خطأ الصلاحيات للمحرك المركزي في حال فشل العملية
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transRef.path,
        operation: 'create',
        requestResourceData: transactionData
      }));
      throw err;
    });
  }
}
