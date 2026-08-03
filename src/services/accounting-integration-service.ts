
'use client';

import { InterimPaymentCertificate } from '@/types/documents';

/**
 * خدمة التكامل المحاسبي (Accounting Integration Service).
 * تقوم بتحويل المستندات المالية المعتمدة إلى قيود يومية (Journal Entries).
 */
export class AccountingIntegrationService {
  
  /**
   * توليد قيد استحقاق من مستخلص معتمد (Progress Billing Entry)
   * مدين: العملاء (AR) | دائن: الإيرادات (Revenue)
   */
  static generateIPCEntry(ipc: InterimPaymentCertificate) {
    return {
      date: new Date().toISOString().split('T')[0],
      narration: `إثبات مستخلص إنجاز رقم ${ipc.ipcNumber} - عميل: ${ipc.clientName}`,
      sourceModule: 'PROGRESS_BILLING',
      sourceId: ipc.id,
      lines: [
        {
          accountName: 'Accounts Receivable',
          debit: ipc.netPayable,
          credit: 0,
        },
        {
          accountName: 'Retainage Receivable', // حجز 10% في الأصول المتداولة
          debit: ipc.retentionAmount,
          credit: 0,
        },
        {
          accountName: 'Project Revenue',
          debit: 0,
          credit: ipc.totalCurrentClaim,
        }
      ]
    };
  }
}
