'use client';

import { PayrollBatch, PayrollRecord } from '@/types/payroll';

/**
 * خدمة التكامل المحاسبي (Accounting Integration Service).
 * مسؤولة عن تحويل بيانات الرواتب إلى مسودات قيود يومية (Journal Entries).
 */
export class AccountingIntegrationService {
  /**
   * توليد مسودة قيد رواتب (Journal Entry Draft)
   * مدين: حساب رواتب وأجور الموظفين (إجمالي المستحق)
   * دائن: حساب البنك/الخزينة (صافي الراتب)
   * دائن: حساب الخصومات/الجزاءات (إجمالي الخصومات)
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
          accountName: 'Site Labor Wages', // من دليل الحسابات الافتراضي
          debit: batch.totalBasicSalary + batch.totalAllowances,
          credit: 0,
        },
        {
          accountName: 'Bank - Main Account',
          debit: 0,
          credit: batch.totalNetSalary,
        },
        {
          accountName: 'Other Income', // الخصومات تعتبر دخل للمنشأة أو تسوية
          debit: 0,
          credit: batch.totalDeductions,
        }
      ]
    };
  }
}
