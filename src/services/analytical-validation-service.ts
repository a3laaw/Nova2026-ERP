'use client';
/**
 * @fileOverview خدمة التحقق التحليلي (Analytical Validation Service).
 * تقوم بفرض القواعد المالية والتشغيلية على أسطر القيود لضمان سلامة مراكز التكلفة.
 */

import { JournalEntryLine, Account } from '@/types/accounting';
import { CostCenter, ProfitCenter } from '@/types/cost-profit-centers';

export class AnalyticalValidationService {
  /**
   * التحقق من صحة سطر واحد في القيد المحاسبي
   */
  validateLine(
    line: JournalEntryLine,
    account: Account,
    costCenters: CostCenter[],
    profitCenters: ProfitCenter[]
  ): { valid: boolean; error?: string } {
    const config = account.analyticalConfig;
    if (!config) return { valid: true };

    // 1. التحقق من إلزامية مركز التكلفة
    if (config.costCenter === 'required' && !line.costCenterId) {
      return { 
        valid: false, 
        error: `[مركز التكلفة مطلوب] الحساب "${account.nameAr}" يتطلب تحديد مركز تكلفة.` 
      };
    }

    // 2. التحقق من إلزامية مركز الربحية
    if (config.profitCenter === 'required' && !line.profitCenterId) {
      return { 
        valid: false, 
        error: `[مركز الربحية مطلوب] الحساب "${account.nameAr}" يتطلب تحديد مركز ربحية.` 
      };
    }

    // 3. منع مراكز التكلفة غير المسموحة (مثلاً للحسابات الإدارية الصرفة)
    if (config.costCenter === 'not_allowed' && line.costCenterId) {
      return { 
        valid: false, 
        error: `[خطأ في البعد] الحساب "${account.nameAr}" لا يقبل مراكز تكلفة.` 
      };
    }

    // 4. فحص مطابقة المشروع (Project Guard)
    // منع تحميل مشروع بمصاريف مركز تكلفة مرتبط بمشروع آخر
    if (line.costCenterId) {
      const center = costCenters.find(c => c.id === line.costCenterId);
      if (center && center.projectId && center.projectId !== line.projectId) {
        return { 
          valid: false, 
          error: `[تداخل مشاريع] مركز التكلفة "${center.name}" مرتبط بمشروع مختلف عن المختار في السطر.` 
        };
      }
    }

    return { valid: true };
  }
}
