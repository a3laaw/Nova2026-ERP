/**
 * @fileOverview محرك حساب مواعيد العمل (Work Hours Engine) المطور لدعم الراحة بين المواعيد ونصف الدوام الذكي.
 */

import { format, parse, addMinutes, startOfDay, isValid } from 'date-fns';
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

    if (!isValid(current) || !isValid(end) || duration <= 0) return [];

    while (current < end) {
      const slotEnd = addMinutes(current, duration);
      if (slotEnd > end) break;
      
      slots.push(format(current, 'HH:mm'));
      
      // الانتقال للموعد التالي: مدة الموعد + مدة الراحة
      current = addMinutes(slotEnd, rest);
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
 * المحرك الرئيسي: بناء خانات اليوم بناءً على التخصص والراحة وقواعد نصف الدوام
 */
export function buildDaySlots(
  date: Date, 
  settings: WorkHoursSettings, 
  scope: keyof Pick<WorkHoursSettings, 'architectural' | 'meetingRooms' | 'fieldWork'>
): TimeSlotsResult {
  
  const duration = settings[scope].slotDurationMinutes || 60;
  const rest = settings[scope].restDurationMinutes || 0;

  if (isHoliday(date, settings)) {
    return {
      morningSlots: [],
      eveningSlots: [],
      hasWorkHours: false,
      isHoliday: true,
      isHalfDay: false,
      isRamadan: false,
      slotDurationMinutes: duration,
      restDurationMinutes: rest
    };
  }

  const inRamadan = isWithinRamadan(date, settings.ramadan);
  const inHalfDay = isHalfDay(date, settings.halfDay);
  
  let morningSlots: string[] = [];
  let eveningSlots: string[] = [];

  // 1. حالة رمضان (لها أولوية عليا)
  if (inRamadan) {
    const r = settings.ramadan;
    morningSlots = generateTimeSlots(r.morningStartTime, r.morningEndTime, r.slotDurationMinutes, r.restDurationMinutes);
    if (r.mode === 'double') {
      eveningSlots = generateTimeSlots(r.eveningStartTime, r.eveningEndTime, r.slotDurationMinutes, r.restDurationMinutes);
    }
    return {
      morningSlots,
      eveningSlots,
      hasWorkHours: morningSlots.length > 0 || eveningSlots.length > 0,
      isHoliday: false,
      isHalfDay: false,
      isRamadan: true,
      slotDurationMinutes: r.slotDurationMinutes,
      restDurationMinutes: r.restDurationMinutes
    };
  }

  let schedule: DailySchedule = { ...settings[scope] };

  // 2. حالة نصف الدوام (تعديل النطاق الزمني للمسارات)
  if (inHalfDay) {
    const rule = settings.halfDay;
    if (rule.mode === 'morning_only') {
      morningSlots = generateTimeSlots(schedule.morningStartTime, schedule.morningEndTime, duration, rest);
      eveningSlots = [];
    } 
    else if (rule.mode === 'evening_only') {
      morningSlots = [];
      eveningSlots = generateTimeSlots(schedule.eveningStartTime, schedule.eveningEndTime, duration, rest);
    } 
    else {
      // Custom Cut-off (e.g. Stop at 2 PM)
      // We fill morning first, then evening if it fits before the cut-off
      morningSlots = generateTimeSlots(schedule.morningStartTime, rule.endTime, duration, rest);
      
      if (rule.endTime > schedule.eveningStartTime) {
        eveningSlots = generateTimeSlots(schedule.eveningStartTime, rule.endTime, duration, rest);
      }
    }
  } 
  // 3. حالة الدوام الاعتيادي
  else {
    morningSlots = generateTimeSlots(schedule.morningStartTime, schedule.morningEndTime, duration, rest);
    if (schedule.mode === 'double') {
      eveningSlots = generateTimeSlots(schedule.eveningStartTime, schedule.eveningEndTime, duration, rest);
    }
  }

  return {
    morningSlots,
    eveningSlots,
    hasWorkHours: morningSlots.length > 0 || eveningSlots.length > 0,
    isHoliday: false,
    isHalfDay: inHalfDay,
    isRamadan: false,
    slotDurationMinutes: duration,
    restDurationMinutes: rest
  };
}
