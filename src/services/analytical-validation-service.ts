'use client';
/**
 * @fileOverview خدمة التحقق والرقابة التحليلية (Analytical Validation Service).
 * تفرض قواعد صارمة على قيود اليومية لضمان سلامة التقارير المالية.
 */

import { JournalEntryLine, Account } from '@/types/accounting';

export class AnalyticalValidationService {
  /**
   * التحقق من صحة القيد المحاسبي بالكامل قبل الترحيل
   */
  validateJournalEntry(lines: JournalEntryLine[], accounts: Account[]): { valid: boolean; error?: string } {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const account = accounts.find(a => a.id === line.accountId);
      const lineNum = i + 1;

      if (!account) {
        return { valid: false, error: `السطر ${lineNum}: الحساب غير موجود في الدليل.` };
      }

      // 1. ترفض القيد إذا كان الحساب حساب مجموعة
      if (account.isGroup) {
        return { valid: false, error: `السطر ${lineNum}: لا يمكن تسجيل قيود على حساب رئيسي (مجموعة): ${account.nameAr}.` };
      }

      // 2. إذا كان نوع الحساب مصروف (expense)
      if (account.type === 'expense') {
        if (!line.costCenterId || !line.profitCenterId || !line.projectId) {
          return { 
            valid: false, 
            error: `السطر ${lineNum}: حساب المصروف "${account.nameAr}" يتطلب تحديد (مركز تكلفة، مركز ربحية، ومشروع) للامتثال المالي.` 
          };
        }
      }

      // 3. إذا كان نوع الحساب إيراد (revenue)
      if (account.type === 'revenue') {
        if (!line.profitCenterId || !line.projectId) {
          return { 
            valid: false, 
            error: `السطر ${lineNum}: حساب الإيراد "${account.nameAr}" يتطلب تحديد (مركز ربحية ومشروع).` 
          };
        }
      }

      // 4. إذا كان أصول أو خصوم (asset / liability)
      if (account.type === 'asset' || account.type === 'liability') {
        if (!line.profitCenterId) {
          return { 
            valid: false, 
            error: `السطر ${lineNum}: الحساب "${account.nameAr}" يتطلب تحديد مركز ربحية لمطابقة البعد التشغيلي.` 
          };
        }
      }
    }

    return { valid: true };
  }
}