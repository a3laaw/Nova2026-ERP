'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  writeBatch,
  increment,
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { BillingService } from './billing-service';

/**
 * @fileOverview محرك السجلات الميدانية السيادي المطور (V3).
 * يقوم هذا المحرك بربط الميدان بالمركز المالي والهندسي ذرياً.
 */
export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إرسال تقرير إنجاز ميداني مع معالجة الأثر المالي والهندسي الموحد.
   * يضمن هذا التحديث انعكاس الكميات في المقايسة والمسار الفني فوراً.
   */
  async submitFieldLog(data: Partial<FieldVisit>, userId: string) {
    if (!this.db || !this.companyId || !data.transactionId) {
       throw new Error("MISSING_CONTEXT: بيانات المعاملة غير مكتملة.");
    }

    const batch = writeBatch(this.db);
    const logRef = doc(collection(this.db, paths.fieldVisits(this.companyId)));
    
    const finalData = {
      ...data,
      id: logRef.id,
      companyId: this.companyId,
      status: 'approved', // السجلات الميدانية للمهندس المعتمد تعتبر معتمدة فوراً
      isVerified: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 1. حفظ سجل الزيارة الرئيسي (The Master Log)
    batch.set(logRef, finalData);

    // 2. محرك التحديث المتوازي (BOQ & Technical Path Sync)
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (!item.boqId || !item.boqItemId) continue;

        // تحديث الكمية المنفذة في بند المقايسة (BOQ Item)
        const boqItemRef = doc(this.db, paths.boqItems(this.companyId, item.boqId), item.boqItemId);
        batch.update(boqItemRef, {
          executedQuantity: increment(Number(item.quantity) || 0),
          updatedAt: serverTimestamp()
        });

        // تحديث عداد الإنجاز في المرحلة الفنية النشطة (Stage Instance)
        if (data.activeStageId) {
          const stageRef = doc(this.db, paths.transactionStages(this.companyId, data.transactionId), data.activeStageId);
          batch.update(stageRef, {
            currentCount: increment(Number(item.quantity) || 0),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 3. توثيق الحدث في تايملاين العمليات (Sovereign Timeline)
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, data.transactionId)));
    batch.set(timelineRef, {
      transactionId: data.transactionId,
      type: 'numeric_update',
      content: `[إنجاز موثق] قام ${data.engineerName} بتسجيل إنجاز ميداني لـ ${data.items?.length || 0} بند. تم تحديث المقايسة والمسار الفني آلياً.`,
      userId,
      userName: data.engineerName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
      
      // 4. إطلاق محرك الفوترة الذكي (Billing Trigger)
      // يقوم بفحص إذا كان هذا الإنجاز يستوجب إصدار مطالبة مالية للمالك (IPC)
      const billing = new BillingService(this.db, this.companyId);
      // فحص المطالبات المعتمدة على "أثناء التنفيذ"
      if (data.activeStageId) {
        // نستخدم معرف المرحلة الفنية الأصلي (TechnicalStageId) للربط مع العقد
        const stageSnap = await getDocs(query(
           collection(this.db, paths.transactionStages(this.companyId, data.transactionId)),
           where('id', '==', data.activeStageId),
           limit(1)
        ));
        
        if (!stageSnap.empty) {
           const techStageId = stageSnap.docs[0].data().technicalStageId;
           await billing.triggerMilestoneBilling(data.transactionId, techStageId, 'during', userId, data.engineerName || 'System');
        }
      }

      return logRef.id;
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: logRef.path,
        operation: 'write',
        requestResourceData: finalData
      } satisfies SecurityRuleContext));
      throw serverError;
    }
  }
}
