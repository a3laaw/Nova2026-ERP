
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
import { BOQItem } from '@/types/documents';

/**
 * محرك السجلات الميدانية السيادي (Sovereign Field Documentation Engine).
 * يربط بين: التقرير اليومي -> المقايسة (BOQ) -> المسار الفني (Stages) -> المستحقات المالية.
 */
export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إرسال تقرير إنجاز ميداني مع معالجة الأثر المالي والهندسي الموحد.
   */
  async submitFieldLog(data: Partial<FieldVisit>, userId: string) {
    if (!this.db || !this.companyId) return;

    const batch = writeBatch(this.db);
    const logRef = doc(collection(this.db, paths.fieldVisits(this.companyId)));
    
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

    // 1. حفظ سجل الزيارة الرئيسي
    batch.set(logRef, finalData);

    // 2. معالجة بنود الإنجاز (BOQ Items) وتحديث مراحل التنفيذ
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        // تحديث الكمية المنفذة في المقايسة (BOQ)
        const boqItemRef = doc(this.db, paths.boqItems(this.companyId, item.boqId || ''), item.boqItemId);
        batch.update(boqItemRef, {
          executedQuantity: increment(item.quantity),
          updatedAt: serverTimestamp()
        });

        // تحديث عداد المرحلة الفنية (Stage Instance)
        if (data.activeStageId) {
          const stageRef = doc(this.db, paths.transactionStages(this.companyId, data.transactionId!), data.activeStageId);
          batch.update(stageRef, {
            currentCount: increment(item.quantity),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 3. توثيق الحدث في تايملاين المشروع (Operational Timeline)
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, data.transactionId!)));
    batch.set(timelineRef, {
      transactionId: data.transactionId,
      type: 'numeric_update',
      content: `[توثيق ميداني] تم تسجيل إنجاز جديد بواسطة ${data.engineerName}. شمل التقرير ${data.items?.length || 0} بند عمل و ${data.staffDetails?.length || 0} مورد بشري.`,
      userId,
      userName: data.engineerName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    // تنفيذ العملية الذرية (Atomic Commit)
    try {
      await batch.commit();
      
      // 4. إطلاق محرك الفوترة (Billing Trigger) - يتم استدعاؤه بعد التأكد من الحفظ
      // هذا الجزء يفحص إذا كان هناك مبالغ تستحق الصرف للمقاول أو المالك بناءً على الكميات الجديدة
      this.triggerFinancialChecks(data);

      return logRef.id;
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: logRef.path,
        operation: 'create',
        requestResourceData: finalData
      } satisfies SecurityRuleContext));
      throw serverError;
    }
  }

  /**
   * محرك الفحص المالي (Financial Integrity Check)
   * يقوم بمراجعة مستحقات المقاولين والمالك فور تسجيل الكميات.
   */
  private async triggerFinancialChecks(data: Partial<FieldVisit>) {
    // سيتم تنفيذ الربط مع BillingService هنا لضمان تحديث المستخلصات (Draft IPCs) آلياً
    // بناءً على الإنجاز الفعلي المحقق.
    console.log("Sovereign Billing Check Triggered for Transaction:", data.transactionId);
  }
}
