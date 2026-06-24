'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem } from '@/types/documents';
import { ensureActionPermission } from '@/lib/permissions';

export interface StageProgressResult {
  canComplete: boolean;
  reason?: string;
  linkedItemsCount: number;
  totalPlanned: number;
  totalExecuted: number;
  percentage: number;
}

/**
 * خدمة الربط التنفيذي بين المقايسات والمراحل (BOQ Execution Service).
 * مسؤولة عن التحقق من الإنجاز الفعلي للبنود المرتبطة بكل مرحلة فنية.
 */
export class BOQExecutionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * جلب كافة بنود المقايسة المرتبطة بمرحلة فنية معينة داخل معاملة واحدة.
   * يستخدم Collection Group Query برمجياً عبر الفلترة لتجنب تعقيد الفهارس.
   */
  async getBOQItemsByTechnicalStage(transactionId: string, technicalStageId: string): Promise<BOQItem[]> {
    // 1. البحث عن المقايسة النشطة للمعاملة
    const boqsRef = collection(this.db, paths.boqs(this.companyId));
    const boqQuery = query(boqsRef, where('transactionId', '==', transactionId), where('status', '==', 'active'));
    const boqSnap = await getDocs(boqQuery);
    
    // إذا لم توجد مقايسة نشطة، نبحث في المسودات
    let finalBoqId = '';
    if (!boqSnap.empty) {
      finalBoqId = boqSnap.docs[0].id;
    } else {
      const draftQuery = query(boqsRef, where('transactionId', '==', transactionId), where('status', '==', 'draft'));
      const draftSnap = await getDocs(draftQuery);
      if (draftSnap.empty) return [];
      finalBoqId = draftSnap.docs[0].id;
    }

    // 2. جلب البنود المرتبطة بالمرحلة الفنية المطلوبة
    const itemsRef = collection(this.db, paths.boqItems(this.companyId, finalBoqId));
    const itemsQuery = query(itemsRef, where('technicalStageId', '==', technicalStageId));
    const itemsSnap = await getDocs(itemsQuery);

    return itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
  }

  /**
   * محرك التحقق من إمكانية إكمال المرحلة بناءً على تقدم الـ BOQ.
   * يطبق منطق "التحقق الميداني" قبل السماح للمهندس بإغلاق المرحلة.
   */
  async canCompleteStageByBOQProgress(transactionId: string, technicalStageId: string): Promise<StageProgressResult> {
    const items = await this.getBOQItemsByTechnicalStage(transactionId, technicalStageId);
    
    if (items.length === 0) {
      return {
        canComplete: true, // مسموح بالإكمال إذا لم تكن هناك بنود مرتبطة (مرحلة إدارية مثلاً)
        linkedItemsCount: 0,
        totalPlanned: 0,
        totalExecuted: 0,
        percentage: 100
      };
    }

    const totalPlanned = items.reduce((sum, item) => sum + (item.plannedQuantity || 0), 0);
    const totalExecuted = items.reduce((sum, item) => sum + (item.executedQuantity || 0), 0);
    const percentage = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

    // منطق التحقق: لا يمكن الإكمال إذا لم يتم تنفيذ أي كمية في البنود المرتبطة
    const hasStartedExecution = totalExecuted > 0;
    
    return {
      canComplete: hasStartedExecution,
      reason: hasStartedExecution ? undefined : "لا يمكن إكمال المرحلة لعدم وجود إنجاز فعلي مسجل في بنود المقايسة المرتبطة بها.",
      linkedItemsCount: items.length,
      totalPlanned,
      totalExecuted,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  /**
   * توثيق حدث ربط أو تحقق في سجل المعاملة
   */
  async logBOQEvent(transactionId: string, content: string, userId: string, userName: string) {
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }
}
