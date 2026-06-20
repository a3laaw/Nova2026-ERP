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
 * تلتزم بقاعدة (الأجر اليومي = الراتب الشامل / 26).
 */
export class EndOfServiceCalculator {
  
  /**
   * حساب رصيد الإجازات السنوية المستحق بناءً على معدل 2.5 يوم/شهر.
   * المادة 70 و 72 من قانون العمل.
   */
  static calculateAnnualLeaveBalance(totalDaysServed: number, carried: number, used: number): number {
    // القاعدة القانونية: 30 يوماً لكل 365 يوماً من الخدمة
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
    // 1. الراتب الشامل والأجر اليومي (قاعدة 26 يوماً)
    const lastSalary = input.basicSalary + input.housingAllowance + input.transportAllowance + (input.otherAllowances || 0);
    
    if (lastSalary <= 0) {
      throw new Error('SALARY_ZERO: يجب أن يكون الراتب أكبر من صفر.');
    }

    const dailyWage = lastSalary / 26;
    
    // 2. تحديد تاريخ الانتهاء الفعلي ومدة الإنذار (المادة 44)
    let effectiveEndDate = noticeStartDate;
    let noticeIndemnity = 0;
    let noticeText = "";

    if (noticeType === 'worked') {
      const datePlus3Months = addMonths(parseISO(noticeStartDate), 3);
      effectiveEndDate = format(datePlus3Months, 'yyyy-MM-dd');
      noticeText = "فترة الإنذار: استيفاء فترة الإنذار (عمل فعلي 90 يوماً)";
    } else if (noticeType === 'indemnity') {
      noticeIndemnity = lastSalary * 3; // راتب 3 أشهر كاملة
      noticeText = "فترة الإنذار: إنهاء فوري (استحقاق بدل إنذار 3 أشهر)";
    } else {
      noticeText = "فترة الإنذار: تنازل متبادل عن المدة";
    }

    // 3. حساب مدة الخدمة الكلية بدقة (بالأيام والسنوات)
    const hireDateObj = parseISO(input.hireDate);
    const endDateObj = parseISO(effectiveEndDate);
    
    const totalDaysCount = differenceInDays(endDateObj, hireDateObj);
    const duration = intervalToDuration({ start: hireDateObj, end: endDateObj });
    const serviceYears = totalDaysCount / 365.25;

    // 4. حساب المكافأة الأساسية (المادة 51)
    let baseGratuity = 0;
    if (serviceYears <= 5) {
      // 15 يوماً عن كل سنة لأول 5 سنوات
      baseGratuity = serviceYears * (15 * dailyWage);
    } else {
      // 15 يوماً عن أول 5 سنوات + شهر كامل عن كل سنة تالية
      const first5 = 5 * (15 * dailyWage);
      const remainingYears = serviceYears - 5;
      baseGratuity = first5 + (remainingYears * lastSalary);
    }

    // تطبيق الحد الأعلى (أجر 18 شهراً)
    const maxGratuity = 1.5 * 12 * lastSalary;
    const isCapped = baseGratuity > maxGratuity;
    if (isCapped) baseGratuity = maxGratuity;

    // 5. تطبيق عامل الاستقالة (المادة 53)
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

    // 6. حساب بدل رصيد الإجازات المتبقي (المادة 72)
    // يُحسب بناءً على مدة الخدمة الفعلية بمعدل 2.5 يوم/شهر
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
