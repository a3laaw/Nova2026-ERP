'use client';

import { 
  Firestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Contract } from '@/types/documents';
import { ContractMilestone } from '@/types/templates';
import { Voucher } from '@/types/accounting';

export interface MilestonePaymentStatus {
  milestone: ContractMilestone;
  milestoneAmount: number;
  paidToDate: number;
  remaining: number;
}

/**
 * خدمة إدارة دفعات العقود الذكية (Smart Contract Milestone Service).
 * تقوم بحساب الرصيد المتبقي لكل دفعة بناءً على سندات القبض التاريخية (FIFO).
 */
export class PaymentMilestoneService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب حالة سداد دفعات العقد بالتفصيل
   * تم تعديل الاستعلام ليعمل بدون الحاجة لفهرس (Index) خارجي
   */
  async getMilestonesStatus(contractId: string): Promise<MilestonePaymentStatus[]> {
    const contractRef = doc(this.db, paths.contracts(this.companyId), contractId);
    const contractSnap = await getDoc(contractRef);
    if (!contractSnap.exists()) throw new Error('CONTRACT_NOT_FOUND');
    
    const contract = contractSnap.data() as Contract;
    const milestones = contract.milestones || [];
    const totalAmount = contract.totalAmount || 0;

    // 1. جلب كافة سندات القبض المرتبطة بهذا العقد داخل نطاق المنشأة
    const vouchersQuery = query(
      collection(this.db, paths.vouchers(this.companyId)),
      where('contractId', '==', contractId),
      where('type', '==', 'receipt')
    );
    
    const vouchersSnap = await getDocs(vouchersQuery);
    
    // 2. فرز البيانات برمجياً (In-memory) لتجنب الحاجة لفهرس مركب في Firestore
    const allVouchers = vouchersSnap.docs
      .map(d => d.data() as Voucher)
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

    // 3. حساب إجمالي ما تم تحصيله
    let poolOfPaidMoney = allVouchers.reduce((acc, v) => acc + (v.amount || 0), 0);

    // 4. توزيع الرصيد على الدفعات بنظام FIFO
    return milestones.map((m) => {
      // حساب قيمة الدفعة (دعم النمطين: مبلغ ثابت أو نسبة)
      const mAmount = m.amount || (totalAmount * (m.percentage || 0)) / 100;
      
      // كم من "مجمع المال" يخص هذه الدفعة؟
      const paidToThis = Math.min(poolOfPaidMoney, mAmount);
      poolOfPaidMoney = Math.max(0, poolOfPaidMoney - paidToThis);

      return {
        milestone: m,
        milestoneAmount: mAmount,
        paidToDate: Math.round(paidToThis * 1000) / 1000,
        remaining: Math.round((mAmount - paidToThis) * 1000) / 1000
      };
    });
  }

  /**
   * توليد بيان سند القبض المقترح بناءً على المبلغ الجديد وتوزيع FIFO
   */
  generateReceiptDescription(
    milestonesStatus: MilestonePaymentStatus[],
    newAmount: number
  ): {
    description: string;
    breakdown: { milestoneName: string; appliedAmount: number; fullyPaid: boolean }[];
  } {
    let remainingNewMoney = newAmount;
    const breakdown: { milestoneName: string; appliedAmount: number; fullyPaid: boolean }[] = [];
    
    for (const status of milestonesStatus) {
      if (remainingNewMoney <= 0) break;
      if (status.remaining <= 0) continue;

      const applied = Math.min(remainingNewMoney, status.remaining);
      const isFullyPaid = Math.abs(applied - status.remaining) < 0.001;

      breakdown.push({
        milestoneName: status.milestone.name,
        appliedAmount: applied,
        fullyPaid: isFullyPaid
      });

      remainingNewMoney -= applied;
    }

    // بناء النص العربي للبيان المحاسبي
    let description = "";
    if (breakdown.length === 0) {
       description = `تم استلام مبلغ إضافي بقيمة ${newAmount} د.ك فائض عن قيمة العقد.`;
    } 
    else if (breakdown.length === 1) {
       const b = breakdown[0];
       if (b.fullyPaid) {
          description = `تم سداد ${b.milestoneName} بالكامل.`;
       } else {
          const mStatus = milestonesStatus.find(s => s.milestone.name === b.milestoneName);
          const left = (mStatus?.remaining || 0) - b.appliedAmount;
          description = `تم سداد جزء من ${b.milestoneName}، المتبقي منها ${left.toLocaleString()} د.ك.`;
       }
    } 
    else {
       const fulls = breakdown.filter(x => x.fullyPaid);
       const last = breakdown[breakdown.length - 1];
       
       if (fulls.length > 1) {
          description = `تم سداد الدفعات (${fulls.map(f => f.milestoneName).join(' و ')}) بالكامل`;
       } else if (fulls.length === 1) {
          description = `تم سداد ${fulls[0].milestoneName} بالكامل`;
       } else {
          description = `تم سداد أجزاء من عدة دفعات`;
       }

       if (!last.fullyPaid) {
          description += `، وجزء من ${last.milestoneName} بقيمة ${last.appliedAmount.toLocaleString()} د.ك.`;
       }
    }

    if (remainingNewMoney > 0.01) {
       description += ` (يوجد مبلغ زائد قدره ${remainingNewMoney.toLocaleString()} د.ك يتطلب مراجعة)`;
    }

    return { description, breakdown };
  }
}
