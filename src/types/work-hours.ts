/**
 * @fileOverview تعريف واجهات البيانات لنظام مواعيد العمل الرسمي.
 */

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface DailySchedule {
  morningStartTime: string; // HH:mm
  morningEndTime: string;
  eveningStartTime: string;
  eveningEndTime: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
}

export interface HalfDayRule {
  day: DayOfWeek | '';
  mode: 'morning_only' | 'custom_end_time';
  endTime: string;
}

export interface RamadanSchedule {
  enabled: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  morningStartTime: string;
  morningEndTime: string;
  eveningStartTime: string;
  eveningEndTime: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
}

export interface WorkHoursSettings {
  general: DailySchedule;
  architectural: DailySchedule;
  holidays: DayOfWeek[];
  halfDay: HalfDayRule;
  ramadan: RamadanSchedule;
  companyId: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface TimeSlotsResult {
  morningSlots: string[];
  eveningSlots: string[];
  hasWorkHours: boolean;
  isHoliday: boolean;
  isHalfDay: boolean;
  isRamadan: boolean;
  slotDurationMinutes: number;
}
