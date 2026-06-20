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
   * حساب رصيد الإجازات السنوية المستحق (Accrued)
   * القاعدة: 30 يوماً سنوياً = 2.5 يوم عن كل شهر عمل.
   */
  calculateAccruedLeave(hireDate: string, targetDate: string = format(new Date(), 'yyyy-MM-dd')): number {
    const start = parseISO(hireDate);
    const end = parseISO(targetDate);
    
    // حساب الفرق بالشهور والكسور لضمان الدقة
    const totalDays = Math.max(0, differenceInDays(end, start));
    const totalMonths = totalDays / 30.44; // متوسط أيام الشهر
    
    const accrued = totalMonths * 2.5;
    return Math.round(accrued * 100) / 100;
  }

  /**
   * التحقق من أهلية القيام بالإجازة (قاعدة الـ 6 أشهر)
   */
  isEligibleForLeave(hireDate: string, startDate: string): { eligible: boolean; months: number } {
    const start = parseISO(hireDate);
    const leaveStart = parseISO(startDate);
    const months = differenceInMonths(leaveStart, start);
    
    return {
      eligible: months >= 6,
      months
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
