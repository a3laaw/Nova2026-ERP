'use client';

import { differenceInDays, parseISO, intervalToDuration } from 'date-fns';

export type TerminationReason = 'resignation' | 'termination' | 'retirement' | 'misconduct';
export type NoticeType = 'served' | 'not_served_by_employer' | 'not_served_by_employee';

export interface GratuityCalculationInput {
  hireDate: string;
  endDate: string;
  totalSalary: number;
  reason: TerminationReason;
  noticeType: NoticeType;
  remainingLeaveDays: number;
}

export interface GratuityResult {
  serviceDuration: {
    years: number;
    months: number;
    days: number;
    totalDays: number;
  };
  dailyWage: number;
  baseGratuity: number;
  resignationFactor: number;
  finalGratuity: number;
  leaveBalancePay: number;
  noticeIndemnity: number;
  totalEntitlement: number;
  isCapped: boolean;
}

/**
 * محرك احتساب مكافأة نهاية الخدمة - قانون العمل الكويتي
 */
export class GratuityService {
  static calculate(input: GratuityCalculationInput): GratuityResult {
    const { hireDate, endDate, totalSalary, reason, noticeType, remainingLeaveDays } = input;
    
    const start = parseISO(hireDate);
    const end = parseISO(endDate);
    const totalDays = Math.max(0, differenceInDays(end, start));
    const duration = intervalToDuration({ start, end });
    const serviceYears = (duration.years || 0) + (duration.months || 0) / 12 + (duration.days || 0) / 365;

    // 1. الأجر اليومي (راتب / 26)
    const dailyWage = totalSalary / 26;

    // 2. احتساب المكافأة الأساسية (Accrued Gratuity)
    // أول 5 سنوات: 15 يوم عن كل سنة
    // ما بعد 5 سنوات: 30 يوم (شهر) عن كل سنة
    let baseGratuity = 0;
    if (serviceYears <= 5) {
      baseGratuity = serviceYears * (dailyWage * 15);
    } else {
      const firstFiveYears = 5 * (dailyWage * 15);
      const remainingYears = (serviceYears - 5) * totalSalary;
      baseGratuity = firstFiveYears + remainingYears;
    }

    // 3. تطبيق سقف المكافأة (لا تتجاوز راتب 18 شهر)
    const cap = totalSalary * 18;
    const isCapped = baseGratuity > cap;
    if (isCapped) baseGratuity = cap;

    // 4. تطبيق عامل الاستقالة (Resignation Tiers)
    let resignationFactor = 1;
    if (reason === 'resignation') {
      if (serviceYears < 3) resignationFactor = 0;
      else if (serviceYears < 5) resignationFactor = 0.5; // 1/2
      else if (serviceYears < 10) resignationFactor = 0.666; // 2/3
      else resignationFactor = 1;
    } else if (reason === 'misconduct') {
      resignationFactor = 0; // حرمان من المكافأة في حالات المادة 41
    }

    const finalGratuity = baseGratuity * resignationFactor;

    // 5. احتساب بدل الإجازات (رصيد الأيام * الأجر اليومي)
    const leaveBalancePay = remainingLeaveDays * dailyWage;

    // 6. بدل الإنذار (إذا لم يلتزم صاحب العمل بفترة الإنذار - شهر عادة)
    let noticeIndemnity = 0;
    if (noticeType === 'not_served_by_employer') {
      noticeIndemnity = totalSalary; // تعويض شهر كامل
    } else if (noticeType === 'not_served_by_employee') {
      noticeIndemnity = -totalSalary; // خصم شهر من مستحقات الموظف
    }

    const totalEntitlement = finalGratuity + leaveBalancePay + (noticeIndemnity > 0 ? noticeIndemnity : 0);

    return {
      serviceDuration: {
        years: duration.years || 0,
        months: duration.months || 0,
        days: duration.days || 0,
        totalDays
      },
      dailyWage,
      baseGratuity,
      resignationFactor,
      finalGratuity,
      leaveBalancePay,
      noticeIndemnity,
      totalEntitlement,
      isCapped
    };
  }
}
