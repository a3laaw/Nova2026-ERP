'use client';

import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { WorkHoursSettings, DayOfWeek } from '@/types/work-hours';

/**
 * محرك حساب أيام العمل الفعلية.
 * يستبعد العطلات الأسبوعية والرسمية المسجلة في إعدادات الشركة.
 */
export class WorkingDaysService {
  constructor(private settings: WorkHoursSettings) {}

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
   * تحليل الإجازة المرضية حسب قانون العمل الكويتي
   * 15 يوم (راتب كامل) -> 10 أيام (75%) -> 10 أيام (50%) -> 10 أيام (25%) -> 30 يوم (بدون)
   */
  calculateSickLeaveBreakdown(days: number, usedBefore: number) {
    const totalPossible = days;
    let remaining = days;
    let currentUsed = usedBefore;

    const tiers = {
      fullPay: 0,
      threeQuarterPay: 0,
      halfPay: 0,
      quarterPay: 0,
      noPay: 0
    };

    // الشريحة 1: 15 يوم راتب كامل
    if (currentUsed < 15) {
      const available = 15 - currentUsed;
      const take = Math.min(remaining, available);
      tiers.fullPay = take;
      remaining -= take;
      currentUsed += take;
    }

    // الشريحة 2: 10 أيام 75%
    if (remaining > 0 && currentUsed < 25) {
      const available = 25 - currentUsed;
      const take = Math.min(remaining, available);
      tiers.threeQuarterPay = take;
      remaining -= take;
      currentUsed += take;
    }

    // الشريحة 3: 10 أيام 50%
    if (remaining > 0 && currentUsed < 35) {
      const available = 35 - currentUsed;
      const take = Math.min(remaining, available);
      tiers.halfPay = take;
      remaining -= take;
      currentUsed += take;
    }

    // الشريحة 4: 10 أيام 25%
    if (remaining > 0 && currentUsed < 45) {
      const available = 45 - currentUsed;
      const take = Math.min(remaining, available);
      tiers.quarterPay = take;
      remaining -= take;
      currentUsed += take;
    }

    // الشريحة 5: ما زاد عن ذلك حتى 75 يوم إجمالي (بدون راتب)
    if (remaining > 0) {
      tiers.noPay = remaining;
    }

    return tiers;
  }
}
