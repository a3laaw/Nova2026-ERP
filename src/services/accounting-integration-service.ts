
'use client';

import { PayrollBatch, PayrollRecord } from '@/types/payroll';
import { BOQItemExecutionEntry, BOQItem } from '@/types/documents';

/**
 * خدمة التكامل المحاسبي (Accounting Integration Service).
 * تم تحديثها لدعم تحويل الإنجاز الميداني المعتمد إلى قيود يومية (Progress Billing Entry).
 */
export class AccountingIntegrationService {
  
  /**
   * توليد قيد استحقاق إيراد بناءً على إنجاز ميداني معتمد
   * مدين: ذمم مدينة / عملاء (Accounts Receivable)
   * دائن: إيرادات عقود / مشاريع (Project Revenue)
   */
  static generateProgressBillingPayload(
    clientName: string,
    items: { title: string, amount: number }[]
  ) {
    const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);
    const narration = `استحقاق إيراد عن إنجاز ميداني - ${clientName}`;

    return {
      date: new Date().toISOString().split('T')[0],
      narration,
      sourceModule: 'PROGRESS_BILLING',
      lines: [
        {
          accountName: 'Accounts Receivable',
          debit: totalAmount,
          credit: 0,
        },
        {
          accountName: 'Project Revenue',
          debit: 0,
          credit: totalAmount,
        }
      ]
    };
  }

  /**
   * توليد مسودة قيد رواتب (Journal Entry Draft)
   */
  static generatePayrollJournalPayload(batch: PayrollBatch, records: PayrollRecord[]) {
    const description = `رواتب شهر ${batch.month}-${batch.year} لعدد ${batch.totalEmployees} موظف`;
    
    return {
      date: new Date().toISOString().split('T')[0],
      narration: description,
      sourceModule: 'HR_PAYROLL',
      sourceId: batch.id,
      lines: [
        {
          accountName: 'Site Labor Wages', 
          debit: batch.totalBasicSalary + batch.totalAllowances,
          credit: 0,
        },
        {
          accountName: 'Bank - Main Account',
          debit: 0,
          credit: batch.totalNetSalary,
        },
        {
          accountName: 'Other Income', 
          debit: 0,
          credit: batch.totalDeductions,
        }
      ]
    };
  }
}
