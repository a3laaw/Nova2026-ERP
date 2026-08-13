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
  limit,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { BillingService } from './billing-service';

/**
 * خدمة السجلات الميدانية السيادية - محرك المطابقة المزدوجة.
 */
export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

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
      status: 'approved', 
      isVerified: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(logRef, finalData);

    // 1. محرك تحديث المقايسة والمسار الفني (The Technical Core Update)
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (!item.boqId || !item.boqItemId) continue;

        const boqItemRef = doc(this.db, paths.boqItems(this.companyId, item.boqId), item.boqItemId);
        batch.update(boqItemRef, {
          executedQuantity: increment(Number(item.quantity) || 0),
          updatedAt: serverTimestamp()
        });

        if (data.activeStageId) {
          const stageRef = doc(this.db, paths.transactionStages(this.companyId, data.transactionId), data.activeStageId);
          batch.update(stageRef, {
            currentCount: increment(Number(item.quantity) || 0),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 2. توثيق الحدث في تايملاين المعاملة
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, data.transactionId)));
    batch.set(timelineRef, {
      transactionId: data.transactionId,
      type: 'numeric_update',
      content: `[إنجاز ميداني] تم تسجيل كميات جديدة لـ ${data.items?.length || 0} بند. تم تحديث المقايسة المعتمدة آلياً.`,
      userId,
      userName: data.engineerName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
      
      // 3. المحرك المالي: فحص المطالبات المرتبطة بـ "أثناء التنفيذ"
      if (data.activeStageId) {
        const stageInstanceSnap = await getDoc(doc(this.db, paths.transactionStages(this.companyId, data.transactionId), data.activeStageId));
        if (stageInstanceSnap.exists()) {
           const techStageId = stageInstanceSnap.data().technicalStageId;
           const billing = new BillingService(this.db, this.companyId);
           // تفعيل زناد المطالبة المالية (أثناء التنفيذ)
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
