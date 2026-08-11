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
   */
  async getMilestonesStatus(contractId: string): Promise<MilestonePaymentStatus[]> {
    const contractRef = doc(this.db, paths.contracts(this.companyId), contractId);
    const contractSnap = await getDoc(contractRef);
    if (!contractSnap.exists()) throw new Error('CONTRACT_NOT_FOUND');
    
    const contract = contractSnap.data() as Contract;
    const milestones = contract.milestones || [];
    const totalAmount = contract.totalAmount || 0;

    const vouchersQuery = query(
      collection(this.db, paths.vouchers(this.companyId)),
      where('contractId', '==', contractId),
      where('type', '==', 'receipt')
    );
    
    const vouchersSnap = await getDocs(vouchersQuery);
    
    const allVouchers = vouchersSnap.docs
      .map(d => d.data() as Voucher)
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

    let poolOfPaidMoney = allVouchers.reduce((acc, v) => acc + (v.amount || 0), 0);

    return milestones.map((m) => {
      const mAmount = m.amount || (totalAmount * (m.percentage || 0)) / 100;
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
   * توليد بيان سند القبض المطور (Sovereign Narrative Engine)
   * تم التحديث لحساب المتبقي من الدفعة وإجمالي العقد.
   */
  generateReceiptDescription(
    milestonesStatus: MilestonePaymentStatus[],
    newAmount: number
  ): {
    description: string;
    breakdown: { milestoneName: string; appliedAmount: number; fullyPaid: boolean }[];
  } {
    let remainingNewMoney = newAmount;
    const breakdown: { milestoneName: string; appliedAmount: number; fullyPaid: boolean; remainingAfter: number }[] = [];
    
    // حساب إجماليات العقد
    const totalContractValue = milestonesStatus.reduce((acc, s) => acc + s.milestoneAmount, 0);
    const totalPaidBefore = milestonesStatus.reduce((acc, s) => acc + s.paidToDate, 0);
    const totalRemainingAfter = Math.max(0, totalContractValue - (totalPaidBefore + newAmount));

    for (const status of milestonesStatus) {
      if (remainingNewMoney <= 0) break;
      if (status.remaining <= 0) continue;

      const applied = Math.min(remainingNewMoney, status.remaining);
      const isFullyPaid = Math.abs(applied - status.remaining) < 0.001;
      const mRemainingAfter = Math.max(0, status.remaining - applied);

      breakdown.push({
        milestoneName: status.milestone.name,
        appliedAmount: applied,
        fullyPaid: isFullyPaid,
        remainingAfter: mRemainingAfter
      });

      remainingNewMoney -= applied;
    }

    let description = "";
    if (breakdown.length === 0) {
       description = `تم استلام مبلغ إضافي بقيمة ${newAmount.toLocaleString()} د.ك فائض عن قيمة العقد.`;
    } 
    else {
       const fulls = breakdown.filter(x => x.fullyPaid);
       const partial = breakdown.find(x => !x.fullyPaid);
       
       let parts = "";
       if (fulls.length > 0) {
          const names = fulls.map(f => f.milestoneName).join(' و ');
          parts = fulls.length > 1 ? `تم سداد الدفعات (${names}) بالكامل` : `تم سداد ${names} بالكامل`;
       }
       
       if (partial) {
          const prefix = fulls.length > 0 ? "، و" : "تم سداد ";
          parts += `${prefix}جزء من ${partial.milestoneName} بقيمة ${partial.appliedAmount.toLocaleString()} د.ك (المتبقي من هذه الدفعة ${partial.remainingAfter.toLocaleString()} د.ك)`;
       }

       description = parts + ".";
       description += ` إجمالي المتبقي من العقد: ${totalRemainingAfter.toLocaleString()} د.ك.`;
    }

    if (remainingNewMoney > 0.01) {
       description += ` (يوجد مبلغ زائد قدره ${remainingNewMoney.toLocaleString()} د.ك يتطلب مراجعة)`;
    }

    return { description, breakdown: breakdown as any };
  }
}
