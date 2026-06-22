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
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المعاملات الفنية (Technical Transactions Service).
 * مسؤولة عن الدورة المستندية لفتح المسارات الفنية والترقيم المهني.
 */
export class TransactionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إنشاء معاملة فنية جديدة.
   * يتم التحقق من الصلاحيات وتوليد رقم متسلسل مهني مرتبط بالعميل.
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
    
    // 1. إنفاذ الصلاحيات: التحقق من امتلاك المستخدم لصلاحية إنشاء العمليات
    // نستخدم 'projects:create' كونه المورد العملياتي المتاح في المصفوفة الحالية
    ensureActionPermission(this.permissions, 'projects:create');

    // 2. قراءة بيانات العميل لاستخراج العداد الحالي ورقم الملف
    const clientRef = doc(this.db, paths.clients(this.companyId), data.clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      throw new Error('CLIENT_NOT_FOUND: العميل غير موجود.');
    }

    const clientData = clientSnap.data();
    const currentCounter = clientData.transactionCounter || 0;
    const nextCounter = currentCounter + 1;

    // 3. توليد الرقم المتسلسل المهني (رقم الملف - تسلسل المعاملة)
    // مثال: إذا كان رقم الملف C-0001/2026، تصبح المعاملة الأولى C-0001/2026-01
    const transactionNumber = `${clientData.fileNumber}-${nextCounter.toString().padStart(2, '0')}`;

    // 4. تجهيز العملية الذرية (Atomic Batch) لضمان سلامة البيانات
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

    // 5. تنفيذ الـ Batch مع معالجة أخطاء الصلاحيات السياقية
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
