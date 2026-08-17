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
  accruedLeaveDays: number;
  noticeIndemnity: number;
  totalEntitlement: number;
  isCapped: boolean;
  legalNotes: string[];
}

/**
 * محرك احتساب مكافأة نهاية الخدمة المطور - قانون العمل الكويتي.
 * يطبق قاعدة الـ 26 يوماً لتصفية الإجازات والإنذار بشكل سيادي.
 */
export class GratuityService {
  static calculate(input: GratuityCalculationInput): GratuityResult {
    const { hireDate, endDate, totalSalary, reason, noticeType, remainingLeaveDays } = input;
    
    const start = parseISO(hireDate);
    const end = parseISO(endDate);
    const totalDaysCount = Math.max(0, differenceInDays(end, start));
    const duration = intervalToDuration({ start, end });
    
    const serviceYears = totalDaysCount / 365.25;
    
    // القاعدة السيادية (مادة 70): الأجر اليومي = الراتب الشامل ÷ 26
    const dailyWage = totalSalary / 26;
    const legalNotes: string[] = [];

    // 1. احتساب المكافأة الأساسية (المادة 51)
    let baseGratuity = 0;
    if (serviceYears <= 5) {
      baseGratuity = serviceYears * (dailyWage * 15);
    } else {
      const firstFiveYears = 5 * (dailyWage * 15);
      const remainingYears = serviceYears - 5;
      baseGratuity = firstFiveYears + (remainingYears * totalSalary); 
    }

    // 2. تطبيق سقف الـ 18 شهراً
    const cap = totalSalary * 18;
    const isCapped = baseGratuity > cap;
    if (isCapped) {
      baseGratuity = cap;
      legalNotes.push("تم تطبيق سقف الـ 18 شهراً للمكافأة وفق القانون.");
    }

    // 3. تطبيق تدرج الاستحقاق حسب سبب الانتهاء (المادة 53)
    let resignationFactor = 1;
    if (reason === 'resignation') {
      if (serviceYears < 3) {
        resignationFactor = 0;
        legalNotes.push("لا يستحق الموظف مكافأة لأن مدة خدمته أقل من 3 سنوات (المادة 53).");
      } else if (serviceYears < 5) {
        resignationFactor = 0.5;
        legalNotes.push("استحقاق 1/2 المكافأة (خدمة بين 3-5 سنوات).");
      } else if (serviceYears < 10) {
        resignationFactor = 0.6666; 
        legalNotes.push("استحقاق 2/3 المكافأة (خدمة بين 5-10 سنوات).");
      } else {
        resignationFactor = 1;
        legalNotes.push("استحقاق المكافأة كاملة (خدمة تزيد عن 10 سنوات).");
      }
    } else if (reason === 'misconduct') {
      resignationFactor = 0;
      legalNotes.push("حرمان من المكافأة بسبب الفصل التأديبي (المادة 41).");
    }

    const finalGratuity = baseGratuity * resignationFactor;

    // 4. مقابل رصيد الإجازات (الاحتساب النقدي)
    // القانون: الرصيد المتبقي × (الراتب ÷ 26)
    const validRemainingLeaves = Math.max(0, remainingLeaveDays ?? 0);
    const leaveBalancePay = Math.round(validRemainingLeaves * dailyWage * 1000) / 1000;
    legalNotes.push(`تم احتساب مقابل رصيد الإجازات عن ${validRemainingLeaves} يوم (الأجر اليومي = الراتب ÷ 26).`);

    // 5. بدل الإنذار (المادة 44)
    let noticeIndemnity = 0;
    if (noticeType === 'not_served_by_employer') {
      noticeIndemnity = totalSalary * 3; 
      legalNotes.push("إضافة بدل إنذار يعادل راتب 3 أشهر.");
    } else if (noticeType === 'not_served_by_employee') {
      noticeIndemnity = -(totalSalary * 3); 
      legalNotes.push("خصم بدل إنذار يعادل راتب 3 أشهر.");
    }

    const totalEntitlement = Math.round((finalGratuity + leaveBalancePay + noticeIndemnity) * 1000) / 1000;

    return {
      serviceDuration: {
        years: duration.years || 0,
        months: duration.months || 0,
        days: duration.days || 0,
        totalDays: totalDaysCount
      },
      dailyWage,
      baseGratuity,
      resignationFactor,
      finalGratuity,
      leaveBalancePay,
      accruedLeaveDays: validRemainingLeaves,
      noticeIndemnity,
      totalEntitlement,
      isCapped,
      legalNotes
    };
  }
}
