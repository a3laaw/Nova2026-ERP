'use client';

import { 
  differenceInMonths, 
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
 */
export class EndOfServiceCalculator {
  
  /**
   * حساب رصيد الإجازات السنوية المستحق
   */
  static calculateAnnualLeaveBalance(monthsServed: number, carried: number, used: number): number {
    const accrued = (monthsServed / 12) * 30;
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

    const dailyWage = lastSalary / 26;
    
    // 1. تحديد تاريخ الانتهاء الفعلي وتكلفة الإنذار
    let effectiveEndDate = noticeStartDate;
    let noticeIndemnity = 0;
    let noticeText = "";

    if (noticeType === 'worked') {
      const datePlus3Months = addMonths(parseISO(noticeStartDate), 3);
      effectiveEndDate = format(datePlus3Months, 'yyyy-MM-dd');
      noticeText = "فترة الإنذار: عمل فعلي (3 أشهر)";
    } else if (noticeType === 'indemnity') {
      noticeIndemnity = lastSalary * 3;
      noticeText = "بدل إنذار: صرف نقدي (3 أشهر)";
    } else {
      noticeText = "فترة الإنذار: تنازل متبادل";
    }

    // 2. حساب مدة الخدمة الكلية بالسنوات والشهور
    const hireDateObj = parseISO(input.hireDate);
    const endDateObj = parseISO(effectiveEndDate);
    
    const duration = intervalToDuration({ start: hireDateObj, end: endDateObj });
    const totalMonths = (duration.years || 0) * 12 + (duration.months || 0);
    const fractionalYears = (duration.years || 0) + (duration.months || 0) / 12 + (duration.days || 0) / 365;

    // 3. حساب المكافأة الأساسية (قاعدة 15/30)
    let baseGratuity = 0;
    if (fractionalYears <= 5) {
      baseGratuity = fractionalYears * (15 * dailyWage);
    } else {
      const first5 = 5 * (15 * dailyWage);
      const remainingYears = fractionalYears - 5;
      baseGratuity = first5 + (remainingYears * lastSalary);
    }

    // تطبيق الحد الأعلى (18 شهر)
    const maxGratuity = 1.5 * 12 * lastSalary;
    const isCapped = baseGratuity > maxGratuity;
    if (isCapped) baseGratuity = maxGratuity;

    // 4. تطبيق عامل الاستقالة (المادة 53)
    let resignationFactor = 1;
    if (input.terminationReason === 'resignation') {
      if (fractionalYears < 3) resignationFactor = 0;
      else if (fractionalYears < 5) resignationFactor = 0.5;
      else if (fractionalYears < 10) resignationFactor = 0.6666;
      else resignationFactor = 1;
    } else if (input.terminationReason === 'misconduct') {
      resignationFactor = 0;
    }

    const finalGratuity = baseGratuity * resignationFactor;

    // 5. حساب بدل الإجازات
    const leaveBalance = this.calculateAnnualLeaveBalance(totalMonths, input.carriedLeaveDays, input.annualLeaveUsed);
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
