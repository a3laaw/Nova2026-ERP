'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc, 
  serverTimestamp,
  writeBatch,
  increment,
  getDocs,
  query,
  where,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
import { AccountingService } from './accounting-service';

/**
 * خدمة السجلات الميدانية السيادية - تم التحديث لدعم الاعتماد المالي والترحيل للـ WIP.
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
      status: 'submitted', 
      isVerified: false,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(logRef, finalData);

    // تحديث المقايسة
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (!item.boqId || !item.boqItemId) continue;
        const boqItemRef = doc(this.db, paths.boqItems(this.companyId, item.boqId), item.boqItemId);
        batch.update(boqItemRef, {
          executedQuantity: increment(Number(item.quantity) || 0),
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
    return logRef.id;
  }

  /**
   * الاعتماد الإداري والترحيل المالي للزيارة (Financial Approval & WIP Allocation)
   */
  async approveFieldVisitForBilling(visitId: string, approverId: string) {
    const visitRef = doc(this.db, paths.fieldVisits(this.companyId), visitId);
    const visitSnap = await getDoc(visitRef);
    if (!visitSnap.exists()) throw new Error("VISIT_NOT_FOUND");
    const visit = visitSnap.data() as FieldVisit;

    // 1. حساب إجمالي التكاليف المباشرة من الزيارة
    let totalLaborCost = 0;
    (visit.staffDetails || []).forEach((s: any) => {
       totalLaborCost += (Number(s.count) || 0) * (Number(s.hours) || 8) * (Number(s.hourlyCostRef) || 0);
    });

    let totalEquipCost = 0;
    (visit.equipmentUsed || []).forEach((e: any) => {
       totalEquipCost += (Number(e.count) || 1) * (Number(e.hours) || 8) * (Number(e.hourlyRateRef) || 0);
    });

    const totalVisitCost = totalLaborCost + totalEquipCost;

    const batch = writeBatch(this.db);
    
    // 2. تحديث حالة الزيارة
    batch.update(visitRef, {
       status: 'approved_for_billing',
       isVerified: true,
       billingApprovedAt: serverTimestamp(),
       billingApprovedBy: approverId,
       totalAllocatedCost: totalVisitCost
    });

    // 3. توليد قيد اليومية (WIP Entry)
    if (totalVisitCost > 0) {
       const accService = new AccountingService(this.db, this.companyId);
       
       // البحث عن حساب WIP المرتبط بالمشروع
       const wipAccId = await accService.createAutomaticSubAccount('1205', visit.transactionId, `${visit.clientName} - WIP`, 'asset');
       const accruedAccId = await accService.ensureControlAccount('2204', 'مستحقات رواتب وأجور', 'Accrued Salaries', 'liability');

       // البحث عن مراكز التكلفة والربحية للمشروع
       const ccId = `cc_${visit.transactionId}`;
       const pcId = `pc_${visit.transactionId}`;

       const jvData = {
          date: visit.visitDate,
          description: `ترحيل تكاليف الزيارة الميدانية #${visit.id?.slice(-6)} - مشروع: ${visit.transactionName}`,
          lines: [
             { 
               accountId: wipAccId, 
               accountName: 'أعمال تحت التنفيذ', 
               debit: totalVisitCost, 
               credit: 0, 
               projectId: visit.transactionId, 
               costCenterId: ccId, 
               profitCenterId: pcId 
             },
             { 
               accountId: accruedAccId, 
               accountName: 'مستحقات عمالة ومعدات (خصوم)', 
               debit: 0, 
               credit: totalVisitCost, 
               profitCenterId: pcId 
             }
          ]
       };

       await accService.createJournalEntry(jvData, approverId);
    }

    await batch.commit();
  }
}