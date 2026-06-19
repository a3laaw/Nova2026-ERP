/**
 * @fileOverview محرك حساب مواعيد العمل (Work Hours Engine).
 * يحتوي على المنطق البرمجي لتوليد الخانات الزمنية بناءً على القواعد المرجعية.
 */

import { format, parse, addMinutes, startOfDay } from 'date-fns';
import { 
  WorkHoursSettings, 
  DailySchedule, 
  TimeSlotsResult, 
  DayOfWeek 
} from '@/types/work-hours';

/**
 * توليد خانات زمنية بين وقتين
 */
export function generateTimeSlots(
  startTime: string, 
  endTime: string, 
  duration: number, 
  buffer: number
): string[] {
  if (!startTime || !endTime || startTime === endTime) return [];
  
  const slots: string[] = [];
  try {
    let current = parse(startTime, 'HH:mm', new Date());
    const end = parse(endTime, 'HH:mm', new Date());

    if (duration <= 0) return [];

    while (current < end) {
      slots.push(format(current, 'HH:mm'));
      current = addMinutes(current, duration + buffer);
      
      if (addMinutes(current, 0) > end) break;
    }
  } catch (e) {
    return [];
  }

  return slots;
}

/**
 * التحقق مما إذا كان التاريخ يقع ضمن فترة رمضان
 */
export function isWithinRamadan(date: Date, config: WorkHoursSettings['ramadan']): boolean {
  if (!config.enabled || !config.startDate || !config.endDate) return false;
  
  try {
    const target = startOfDay(date);
    const start = startOfDay(new Date(config.startDate));
    const end = startOfDay(new Date(config.endDate));
    return target >= start && target <= end;
  } catch (e) {
    return false;
  }
}

/**
 * التحقق من العطلة الأسبوعية
 */
export function isHoliday(date: Date, holidays: DayOfWeek[]): boolean {
  const dayName = format(date, 'EEEE') as DayOfWeek;
  return holidays.includes(dayName);
}

/**
 * التحقق من نصف الدوام
 */
export function isHalfDay(date: Date, rule: WorkHoursSettings['halfDay']): boolean {
  return format(date, 'EEEE') === rule.day;
}

/**
 * المحرك الرئيسي: بناء خانات اليوم
 */
export function buildDaySlots(
  date: Date, 
  settings: WorkHoursSettings, 
  scope: 'general' | 'architectural'
): TimeSlotsResult {
  const dayName = format(date, 'EEEE') as DayOfWeek;
  
  // 1. فحص العطلة
  if (settings.holidays.includes(dayName)) {
    return {
      morningSlots: [],
      eveningSlots: [],
      hasWorkHours: false,
      isHoliday: true,
      isHalfDay: false,
      isRamadan: false,
      slotDurationMinutes: settings[scope].slotDurationMinutes
    };
  }

  const inRamadan = isWithinRamadan(date, settings.ramadan);
  const inHalfDay = isHalfDay(date, settings.halfDay);
  
  let morningSlots: string[] = [];
  let eveningSlots: string[] = [];

  // 2. تطبيق منطق رمضان (أولوية قصوى)
  if (inRamadan) {
    morningSlots = generateTimeSlots(
      settings.ramadan.morningStartTime,
      settings.ramadan.morningEndTime,
      settings.ramadan.slotDurationMinutes,
      settings.ramadan.bufferMinutes
    );
    
    // توليد الفترة الثانية فقط إذا كان الوضع "فترتين"
    if (settings.ramadan.mode === 'double') {
      eveningSlots = generateTimeSlots(
        settings.ramadan.eveningStartTime,
        settings.ramadan.eveningEndTime,
        settings.ramadan.slotDurationMinutes,
        settings.ramadan.bufferMinutes
      );
    }
    
    return {
      morningSlots,
      eveningSlots,
      hasWorkHours: morningSlots.length > 0 || eveningSlots.length > 0,
      isHoliday: false,
      isHalfDay: false,
      isRamadan: true,
      slotDurationMinutes: settings.ramadan.slotDurationMinutes
    };
  }

  // 3. تحديد المواعيد الخام (Default)
  let schedule: Partial<DailySchedule> = { ...settings[scope] };

  // 4. تطبيق منطق نصف الدوام
  if (inHalfDay) {
    if (settings.halfDay.mode === 'morning_only') {
      morningSlots = generateTimeSlots(
        schedule.morningStartTime!,
        schedule.morningEndTime!,
        schedule.slotDurationMinutes!,
        schedule.bufferMinutes!
      );
      eveningSlots = [];
    } else {
      const customEnd = settings.halfDay.endTime;
      
      const mEnd = customEnd < schedule.morningEndTime! ? customEnd : schedule.morningEndTime!;
      morningSlots = generateTimeSlots(
        schedule.morningStartTime!,
        mEnd,
        schedule.slotDurationMinutes!,
        schedule.bufferMinutes!
      );

      if (customEnd > schedule.eveningStartTime!) {
        eveningSlots = generateTimeSlots(
          schedule.eveningStartTime!,
          customEnd,
          schedule.slotDurationMinutes!,
          schedule.bufferMinutes!
        );
      }
    }
  } else {
    // 5. دوام كامل عادي
    morningSlots = generateTimeSlots(
      schedule.morningStartTime!,
      schedule.morningEndTime!,
      schedule.slotDurationMinutes!,
      schedule.bufferMinutes!
    );
    eveningSlots = generateTimeSlots(
      schedule.eveningStartTime!,
      schedule.eveningEndTime!,
      schedule.slotDurationMinutes!,
      schedule.bufferMinutes!
    );
  }

  return {
    morningSlots,
    eveningSlots,
    hasWorkHours: morningSlots.length > 0 || eveningSlots.length > 0,
    isHoliday: false,
    isHalfDay: inHalfDay,
    isRamadan: false,
    slotDurationMinutes: schedule.slotDurationMinutes!
  };
}
