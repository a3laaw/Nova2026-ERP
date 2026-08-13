'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خدمة إدارة الزيارات الميدانية وتقارير الموقع المتقدمة.
 * تم توحيد المسار لضمان الربط مع الأرشيف والمركز المالي.
 */
export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إرسال تقرير إنجاز ميداني متكامل (The Sovereign Field Log).
   */
  async submitFieldLog(data: Partial<FieldVisit>, userId: string) {
    if (!this.db || !this.companyId) return;

    // توحيد المسار ليتطابق مع شاشة العرض (Site Reports Archive)
    const logsCollPath = paths.fieldVisits(this.companyId);
    const logRef = doc(collection(this.db, logsCollPath));
    
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

    // تنفيذ الكتابة مع معالجة الأخطاء السيادية
    await setDoc(logRef, finalData)
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: logRef.path,
          operation: 'create',
          requestResourceData: finalData
        } satisfies SecurityRuleContext));
        throw serverError;
      });

    // توثيق في تايملاين المشروع بشكل متوازي لتعزيز الشفافية
    if (data.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, data.transactionId)));
      const timelineData = {
        transactionId: data.transactionId,
        type: 'numeric_update',
        content: `[تقرير ميداني] تم توثيق إنجاز ميداني بواسطة ${data.engineerName}. الموارد: ${data.staffDetails?.length || 0} طاقم/مقاول.`,
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
