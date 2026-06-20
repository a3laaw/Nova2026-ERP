'use client';

import { 
  differenceInDays, 
  parseISO, 
  addMonths, 
  format,
  intervalToDuration
} from 'date-fns';
import { 
  EmployeeSettlementInput, 
  NoticeType, 
  SettlementResult, 
  TerminationReason 
} from '@/types/settlement';

/**
 * خدمة حساب مستحقات نهاية الخدمة وفق قانون العمل الكويتي وNova ERP.
 * تلتزم بقاعدة (الأجر اليومي للتصفية والخصم = الراتب الشامل / 26).
 */
export class EndOfServiceCalculator {
  
  /**
   * حساب رصيد الإجازات السنوية المستحق بناءً على معدل 2.5 يوم/شهر.
   * المادة 70 و 72 من قانون العمل.
   */
  static calculateAnnualLeaveBalance(totalDaysServed: number, carried: number, used: number): number {
    const accrued = (totalDaysServed / 365.25) * 30;
    const balance = accrued + carried - used;
    return Math.max(0, Math.round(balance * 100) / 100);
  }

  /**
   * المحرك الرئيسي لبناء التسوية النهائية
   */
  static buildSettlementResult(
    input: EmployeeSettlementInput,
    noticeStartDate: string,
    noticeType: NoticeType
  ): SettlementResult {
    const lastSalary = input.basicSalary + input.housingAllowance + input.transportAllowance + (input.otherAllowances || 0);
    
    if (lastSalary <= 0) {
      throw new Error('SALARY_ZERO: يجب أن يكون الراتب أكبر من صفر.');
    }

    /**
     * قاعدة الـ 26 يوماً (قانون العمل الكويتي):
     * تُستخدم فقط لاحتساب قيمة اليوم الواحد عند التصفية النقدي أو الخصم.
     * مثال: راتب 650 / 26 = 25 دينار لليوم.
     * رصيد 30 يوماً عند التصفية = 30 * 25 = 750 دينار (أعلى من الراتب الشهري).
     */
    const dailyWage = lastSalary / 26;
    
    let effectiveEndDate = noticeStartDate;
    let noticeIndemnity = 0;
    let noticeText = "";

    if (noticeType === 'worked') {
      const datePlus3Months = addMonths(parseISO(noticeStartDate), 3);
      effectiveEndDate = format(datePlus3Months, 'yyyy-MM-dd');
      noticeText = "استيفاء فترة الإنذار (عمل فعلي 90 يوماً)";
    } else if (noticeType === 'indemnity') {
      noticeIndemnity = lastSalary * 3; // راتب 3 أشهر كاملة
      noticeText = "إنهاء فوري (استحقاق بدل إنذار 3 أشهر)";
    } else {
      noticeText = "تنازل متبادل عن مدة الإنذار";
    }

    const hireDateObj = parseISO(input.hireDate);
    const endDateObj = parseISO(effectiveEndDate);
    
    const totalDaysCount = differenceInDays(endDateObj, hireDateObj);
    const duration = intervalToDuration({ start: hireDateObj, end: endDateObj });
    const serviceYears = totalDaysCount / 365.25;

    // حساب المكافأة الأساسية (المادة 51)
    let baseGratuity = 0;
    if (serviceYears <= 5) {
      baseGratuity = serviceYears * (15 * dailyWage);
    } else {
      const first5 = 5 * (15 * dailyWage);
      const remainingYears = serviceYears - 5;
      baseGratuity = first5 + (remainingYears * lastSalary);
    }

    const maxGratuity = 1.5 * 12 * lastSalary;
    const isCapped = baseGratuity > maxGratuity;
    if (isCapped) baseGratuity = maxGratuity;

    // تطبيق عامل الاستقالة (المادة 53)
    let resignationFactor = 1;
    if (input.terminationReason === 'resignation') {
      if (serviceYears < 3) resignationFactor = 0;
      else if (serviceYears < 5) resignationFactor = 0.5;
      else if (serviceYears < 10) resignationFactor = 0.6666;
      else resignationFactor = 1;
    } else if (input.terminationReason === 'misconduct') {
      resignationFactor = 0;
    }

    const finalGratuity = baseGratuity * resignationFactor;

    // البديل النقدي للإجازات (المادة 72) - يُحسب بقاعدة الـ 26
    const leaveBalance = this.calculateAnnualLeaveBalance(totalDaysCount, input.carriedLeaveDays, input.annualLeaveUsed);
    const leaveBalancePay = leaveBalance * dailyWage;

    return {
      gratuity: Math.round(finalGratuity * 1000) / 1000,
      leaveBalancePay: Math.round(leaveBalancePay * 1000) / 1000,
      noticeIndemnity: Math.round(noticeIndemnity * 1000) / 1000,
      total: Math.round((finalGratuity + leaveBalancePay + noticeIndemnity) * 1000) / 1000,
      notice: noticeText,
      yearsOfService: duration.years || 0,
      monthsOfService: duration.months || 0,
      lastSalary,
      leaveBalance,
      dailyWage,
      baseGratuityBeforeFactor: baseGratuity,
      resignationFactor,
      effectiveEndDate,
      isCapped
    };
  }
}