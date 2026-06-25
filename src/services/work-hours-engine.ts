/**
 * @fileOverview محرك حساب مواعيد العمل (Work Hours Engine) المطور لدعم الراحة بين المواعيد.
 */

import { format, parse, addMinutes, startOfDay } from 'date-fns';
import { 
  WorkHoursSettings, 
  DailySchedule, 
  TimeSlotsResult, 
  DayOfWeek 
} from '@/types/work-hours';

/**
 * توليد خانات زمنية بين وقتين مع احتساب مدة الموعد وفترة الراحة
 */
export function generateTimeSlots(
  startTime: string, 
  endTime: string, 
  duration: number, 
  rest: number
): string[] {
  if (!startTime || !endTime || startTime === endTime) return [];
  
  const slots: string[] = [];
  try {
    let current = parse(startTime, 'HH:mm', new Date());
    const end = parse(endTime, 'HH:mm', new Date());

    if (duration <= 0) return [];

    while (current < end) {
      slots.push(format(current, 'HH:mm'));
      
      // الانتقال للموعد التالي: مدة الموعد + مدة الراحة
      current = addMinutes(current, duration + rest);
      
      // التوقف إذا تجاوزنا وقت نهاية الدوام
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
 * التحقق من العطلة (أسبوعية أو رسمية محددة بتاريخ)
 */
export function isHoliday(date: Date, settings: WorkHoursSettings): boolean {
  const dayName = format(date, 'EEEE') as DayOfWeek;
  if (settings.holidays.includes(dayName)) return true;

  const dateStr = format(date, 'yyyy-MM-dd');
  return settings.publicHolidays?.some(ph => ph.date === dateStr) || false;
}

/**
 * التحقق من نصف الدوام
 */
export function isHalfDay(date: Date, rule: WorkHoursSettings['halfDay']): boolean {
  return format(date, 'EEEE') === rule.day;
}

/**
 * المحرك الرئيسي: بناء خانات اليوم بناءً على التخصص والراحة
 */
export function buildDaySlots(
  date: Date, 
  settings: WorkHoursSettings, 
  scope: keyof Pick<WorkHoursSettings, 'architectural' | 'meetingRooms' | 'fieldWork'>
): TimeSlotsResult {
  
  if (isHoliday(date, settings)) {
    return {
      morningSlots: [],
      eveningSlots: [],
      hasWorkHours: false,
      isHoliday: true,
      isHalfDay: false,
      isRamadan: false,
      slotDurationMinutes: settings[scope].slotDurationMinutes,
      restDurationMinutes: settings[scope].restDurationMinutes
    };
  }

  const inRamadan = isWithinRamadan(date, settings.ramadan);
  const inHalfDay = isHalfDay(date, settings.halfDay);
  
  let morningSlots: string[] = [];
  let eveningSlots: string[] = [];

  if (inRamadan) {
    morningSlots = generateTimeSlots(
      settings.ramadan.morningStartTime,
      settings.ramadan.morningEndTime,
      settings.ramadan.slotDurationMinutes,
      settings.ramadan.restDurationMinutes
    );
    
    if (settings.ramadan.mode === 'double') {
      eveningSlots = generateTimeSlots(
        settings.ramadan.eveningStartTime,
        settings.ramadan.eveningEndTime,
        settings.ramadan.slotDurationMinutes,
        settings.ramadan.restDurationMinutes
      );
    }
    
    return {
      morningSlots,
      eveningSlots,
      hasWorkHours: morningSlots.length > 0 || eveningSlots.length > 0,
      isHoliday: false,
      isHalfDay: false,
      isRamadan: true,
      slotDurationMinutes: settings.ramadan.slotDurationMinutes,
      restDurationMinutes: settings.ramadan.restDurationMinutes
    };
  }

  let schedule: DailySchedule = { ...settings[scope] };

  if (inHalfDay) {
    if (settings.halfDay.mode === 'morning_only') {
      morningSlots = generateTimeSlots(
        schedule.morningStartTime,
        schedule.morningEndTime,
        schedule.slotDurationMinutes,
        schedule.restDurationMinutes
      );
      eveningSlots = [];
    } else {
      const customEnd = settings.halfDay.endTime;
      const mEnd = customEnd < schedule.morningEndTime ? customEnd : schedule.morningEndTime;
      
      morningSlots = generateTimeSlots(
        schedule.morningStartTime,
        mEnd,
        schedule.slotDurationMinutes,
        schedule.restDurationMinutes
      );

      if (customEnd > schedule.eveningStartTime) {
        eveningSlots = generateTimeSlots(
          schedule.eveningStartTime,
          customEnd,
          schedule.slotDurationMinutes,
          schedule.restDurationMinutes
        );
      }
    }
  } else {
    morningSlots = generateTimeSlots(
      schedule.morningStartTime,
      schedule.morningEndTime,
      schedule.slotDurationMinutes,
      schedule.restDurationMinutes
    );
    
    if (schedule.mode === 'double') {
      eveningSlots = generateTimeSlots(
        schedule.eveningStartTime,
        schedule.eveningEndTime,
        schedule.slotDurationMinutes,
        schedule.restDurationMinutes
      );
    }
  }

  return {
    morningSlots,
    eveningSlots,
    hasWorkHours: morningSlots.length > 0 || eveningSlots.length > 0,
    isHoliday: false,
    isHalfDay: inHalfDay,
    isRamadan: false,
    slotDurationMinutes: schedule.slotDurationMinutes,
    restDurationMinutes: schedule.restDurationMinutes
  };
}
