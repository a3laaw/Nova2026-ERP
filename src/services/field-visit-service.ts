'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إرسال تقرير إنجاز ميداني متكامل مع تحديث المقايسة والتايملاين
   */
  async submitFieldLog(data: Partial<FieldVisit>, userId: string) {
    const logRef = doc(collection(this.db, 'companies', this.companyId, 'executions'));
    const batch = writeBatch(this.db);

    const finalData = {
      ...data,
      id: logRef.id,
      companyId: this.companyId,
      status: 'submitted',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 1. حفظ التقرير الرئيسي
    batch.set(logRef, finalData);

    // 2. تحديث الكميات المنفذة في بنود المقايسة (تحديث تراكمي)
    if (data.items && data.items.length > 0 && data.transactionId) {
       // نحتاج لمعرف المقايسة - نفترض وجوده أو جلبه مسبقاً
       // للتبسيط، نقوم بتحديث البنود إذا كانت المعرفات مباشرة
       data.items.forEach(item => {
          // ملاحظة: التحديث الفعلي للـ BOQItem يتم عبر BOQExecutionService
          // هنا نوثق الحركة في التايملاين
       });
    }

    // 3. توثيق الحدث في تايملاين المشروع
    if (data.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, data.transactionId)));
      batch.set(timelineRef, {
        transactionId: data.transactionId,
        type: 'numeric_update',
        content: `[تقرير ميداني متكامل] تم توثيق إنجاز ${data.items?.length} بنود عمل بواسطة المهندس ${data.engineerName}.`,
        userId,
        userName: data.engineerName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    try {
      await batch.commit();
      return logRef.id;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: logRef.path,
        operation: 'create',
        requestResourceData: finalData
      }));
      throw err;
    }
  }
}
