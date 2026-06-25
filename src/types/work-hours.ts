/**
 * @fileOverview تعريف واجهات البيانات لنظام مواعيد العمل الرسمي المطور.
 */

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface DailySchedule {
  mode: 'single' | 'double'; 
  morningStartTime: string; // HH:mm
  morningEndTime: string;
  eveningStartTime: string;
  eveningEndTime: string;
  slotDurationMinutes: number; // مدة الموعد/البند
  restDurationMinutes: number; // مدة الراحة بين المواعيد (جديد)
  bufferMinutes: number; // فترة السماح في البصمة
}

export interface HalfDayRule {
  day: DayOfWeek | '';
  mode: 'morning_only' | 'custom_end_time';
  endTime: string;
}

export interface RamadanSchedule {
  enabled: boolean;
  mode: 'single' | 'double';
  startDate: string; // YYYY-MM-DD
  endDate: string;
  morningStartTime: string;
  morningEndTime: string;
  eveningStartTime: string;
  eveningEndTime: string;
  slotDurationMinutes: number;
  restDurationMinutes: number;
  bufferMinutes: number;
}

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  nameEn: string;
}

export interface WorkHoursSettings {
  architectural: DailySchedule; // المعماري
  meetingRooms: DailySchedule;   // قاعات الاجتماعات
  fieldWork: DailySchedule;      // العمل الميداني
  holidays: DayOfWeek[];
  publicHolidays: PublicHoliday[];
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
  restDurationMinutes: number;
}
