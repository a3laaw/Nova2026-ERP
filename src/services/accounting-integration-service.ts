'use client';

import { InterimPaymentCertificate, BOQItemExecutionEntry } from '@/types/documents';

/**
 * خدمة التكامل المحاسبي (Accounting Integration Service).
 * تقوم بتوليد قيود اليومية المؤتمتة بناءً على منهجية Cost Recovery.
 */
export class AccountingIntegrationService {
  
  /**
   * توليد قيد التكلفة (WIP) عند تنفيذ الزيارة
   * مدين: أعمال تحت التنفيذ (WIP) | دائن: مستحقات عمالة / مخزون
   */
  static generateWIPEntry(execution: BOQItemExecutionEntry) {
    let totalLaborCost = execution.laborDetails.reduce((acc, l) => acc + (l.actualCost * l.hours), 0);
    let totalEquipCost = execution.equipmentUsed.reduce((acc, e) => acc + (e.actualCost * e.hours), 0);
    const totalCost = totalLaborCost + totalEquipCost;

    return {
      date: new Date().toISOString().split('T')[0],
      narration: `إثبات تكاليف ميدانية - بند BOQ ID: ${execution.boqItemId}`,
      lines: [
        { accountName: 'Work In Progress (WIP)', debit: totalCost, credit: 0 },
        { accountName: 'Accrued Labor & Equip', debit: 0, credit: totalCost }
      ]
    };
  }

  /**
   * توليد قيد الإيراد من مستخلص معتمد (Official Revenue Recognition)
   */
  static generateIPCEntry(ipc: InterimPaymentCertificate) {
    return {
      date: new Date().toISOString().split('T')[0],
      narration: `إثبات مستخلص رقم ${ipc.ipcNumber} - العقد ID: ${ipc.contractId}`,
      sourceModule: 'BILLING',
      sourceId: ipc.id,
      lines: [
        { accountName: 'Accounts Receivable', debit: ipc.netPayable, credit: 0 },
        { accountName: 'Retention Receivable', debit: ipc.retentionAmount, credit: 0 },
        { accountName: 'Advanced Payment Contra', debit: ipc.advanceRecovery, credit: 0 },
        { accountName: 'Project Revenue', debit: 0, credit: ipc.grossAmount }
      ]
    };
  }
}
