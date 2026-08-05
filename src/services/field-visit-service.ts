
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  writeBatch,
  increment,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خدمة إدارة الزيارات الميدانية وتقارير الموقع المتقدمة.
 */
export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إرسال تقرير إنجاز ميداني متكامل (The Sovereign Field Log).
   * يتم الحفظ في مجموعة executions المركزية لضمان الظهور في كافة الرادارات.
   */
  async submitFieldLog(data: Partial<FieldVisit>, userId: string) {
    if (!this.db || !this.companyId) return;

    // استخدام مسار executions المركزي لضمان التوافق مع محرك التقارير
    const logsCollRef = collection(this.db, 'companies', this.companyId, 'executions');
    const logRef = doc(logsCollRef);
    
    const finalData = {
      ...data,
      id: logRef.id,
      companyId: this.companyId,
      status: 'submitted',
      isVerified: false,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // تنفيذ الكتابة دون await (Pattern 1) لضمان تجربة مستخدم سلسة
    setDoc(logRef, finalData)
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: logRef.path,
          operation: 'create',
          requestResourceData: finalData
        } satisfies SecurityRuleContext));
      });

    // توثيق في تايملاين المشروع بشكل متوازي
    if (data.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, data.transactionId)));
      const timelineData = {
        transactionId: data.transactionId,
        type: 'numeric_update',
        content: `[تقرير ميداني متكامل] تم توثيق إنجاز ${data.items?.length} بنود عمل بواسطة المهندس ${data.engineerName}.`,
        userId,
        userName: data.engineerName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      };
      
      setDoc(timelineRef, timelineData).catch(() => {});
    }

    return logRef.id;
  }
}

