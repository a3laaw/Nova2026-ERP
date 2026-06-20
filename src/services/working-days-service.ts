'use client';

import { format, eachDayOfInterval, parseISO, differenceInMonths, differenceInDays } from 'date-fns';
import { WorkHoursSettings, DayOfWeek } from '@/types/work-hours';

/**
 * محرك حساب أيام العمل الفعلية والاستحقاقات القانونية.
 * يطبق قواعد قانون العمل الكويتي (مادة 69، 70، 72).
 */
export class WorkingDaysService {
  constructor(private settings: WorkHoursSettings) {}

  /**
   * حساب أيام العمل الفعلية بين تاريخين (استبعاد الجمعة والعطلات)
   * يستخدم هذا لحساب عدد الأيام التي سيتم خصمها فعلياً من رصيد الموظف عند قيامه بإجازة.
   */
  calculateWorkingDays(startDate: string, endDate: string): number {
    try {
      const interval = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      let workingDays = 0;
      const publicHolidayDates = new Set(this.settings.publicHolidays.map(h => h.date));
      const weeklyHolidays = new Set(this.settings.holidays);

      interval.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayName = format(day, 'EEEE') as DayOfWeek;

        const isPublicHoliday = publicHolidayDates.has(dateStr);
        const isWeeklyHoliday = weeklyHolidays.has(dayName);

        // المادة 70: لا تحسب ضمن الإجازة أيام الراحة الأسبوعية أو العطلات الرسمية
        if (!isPublicHoliday && !isWeeklyHoliday) {
          workingDays++;
        }
      });

      return workingDays;
    } catch (e) {
      return 0;
    }
  }

  /**
   * حساب رصيد الإجازات السنوية المستحق (Accrued Leave)
   * المادة 70: يستحق العامل إجازة سنوية مدتها 30 يوماً عن كل سنة كاملة من الخدمة.
   * القاعدة الرقمية: 30 يوماً / 12 شهراً = 2.5 يوم عن كل شهر عمل فعلي.
   */
  calculateAccruedLeave(hireDate: string, targetDate: string = format(new Date(), 'yyyy-MM-dd')): number {
    try {
      const start = parseISO(hireDate);
      const end = parseISO(targetDate);
      
      if (end < start) return 0;

      // حساب إجمالي الأيام بين التاريخين
      const totalDays = differenceInDays(end, start);
      
      // القاعدة: كل 365 يوم تمنح 30 يوم إجازة
      // أو: كل شهر (30.44 يوم تقريباً) يمنح 2.5 يوم
      const accrued = (totalDays / 365.25) * 30;
      
      return Math.round(accrued * 100) / 100;
    } catch (e) {
      return 0;
    }
  }

  /**
   * التحقق من أهلية القيام بالإجازة (قاعدة الـ 6 أشهر)
   * لا يجوز القيام بالإجازة السنوية إلا بعد قضاء 6 أشهر متصلة في الخدمة.
   */
  isEligibleForLeave(hireDate: string, startDate: string): { eligible: boolean; months: number } {
    const start = parseISO(hireDate);
    const leaveStart = parseISO(startDate);
    const months = (differenceInDays(leaveStart, start)) / 30.44;
    
    return {
      eligible: months >= 6,
      months: Math.round(months * 10) / 10
    };
  }

  /**
   * تحليل الإجازة المرضية حسب قانون العمل الكويتي (المادة 69)
   */
  calculateSickLeaveBreakdown(days: number, usedBefore: number) {
    let remaining = days;
    let currentUsed = usedBefore;

    const tiers = {
      fullPay: 0,
      threeQuarterPay: 0,
      halfPay: 0,
      quarterPay: 0,
      noPay: 0
    };

    if (currentUsed < 15) {
      const take = Math.min(remaining, 15 - currentUsed);
      tiers.fullPay = take;
      remaining -= take;
      currentUsed += take;
    }

    if (remaining > 0 && currentUsed < 25) {
      const take = Math.min(remaining, 25 - currentUsed);
      tiers.threeQuarterPay = take;
      remaining -= take;
      currentUsed += take;
    }

    if (remaining > 0 && currentUsed < 35) {
      const take = Math.min(remaining, 35 - currentUsed);
      tiers.halfPay = take;
      remaining -= take;
      currentUsed += take;
    }

    if (remaining > 0 && currentUsed < 45) {
      const take = Math.min(remaining, 45 - currentUsed);
      tiers.quarterPay = take;
      remaining -= take;
      currentUsed += take;
    }

    if (remaining > 0) {
      tiers.noPay = remaining;
    }

    return tiers;
  }
}
