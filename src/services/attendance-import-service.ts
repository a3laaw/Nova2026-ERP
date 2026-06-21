'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { AttendanceRecord, Employee } from '@/types/hr';
import { WorkHoursSettings, DayOfWeek } from '@/types/work-hours';
import { parse, differenceInMinutes, format, isValid, parseISO, getMonth, getYear, startOfYear, addYears } from 'date-fns';

export interface RawAttendanceRow {
  employeeNumber: string;
  date: string; 
  checkIn?: string; 
  checkOut?: string; 
  checkIn2?: string; 
  checkOut2?: string;
}

export interface ImportPreviewResult {
  records: Partial<AttendanceRecord>[];
  errors: { row: number; message: string }[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    present: number;
    late: number;
    holiday: number;
  };
}

export class AttendanceImportService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تحويل النصوص والأرقام إلى تاريخ موحد بصيغة YYYY-MM-DD
   * تم تحسينه لمعالجة السنوات المكونة من رقمين (مثل 26 لتصبح 2026)
   */
  private normalizeDate(input: string): string | null {
    if (!input) return null;
    let clean = input.trim();
    
    // 1. معالجة تنسيق إكسيل التسلسلي (Excel Serial Number)
    const num = Number(clean);
    if (!isNaN(num) && num > 30000) { // التواريخ الحديثة في إكسيل تكون أرقاماً كبيرة
      // إكسيل يبدأ من 30 ديسمبر 1899
      const excelBaseDate = new Date(1899, 11, 30);
      const date = new Date(excelBaseDate.getTime() + num * 86400000);
      if (isValid(date)) return format(date, 'yyyy-MM-dd');
    }

    // 2. معالجة التواريخ المكتوبة برقمين للسنة (مثل 01/01/26)
    // نبحث عن نمط ينتهي بـ /26 أو -26
    if (/(^|[/-])26$/.test(clean)) {
        clean = clean.replace(/26$/, '2026');
    }

    // 3. محاولة التنسيقات الشائعة
    const commonFormats = [
        'yyyy-MM-dd', 
        'dd/MM/yyyy', 
        'MM/dd/yyyy', 
        'dd-MM-yyyy', 
        'yyyy/MM/dd',
        'd/M/yyyy',
        'yyyy-M-d'
    ];

    for (const f of commonFormats) {
      try {
        const p = parse(clean, f, new Date());
        if (isValid(p)) {
            // ضمان أن السنة ليست في القرن الأول (مثل 0026)
            if (p.getFullYear() < 100) {
                p.setFullYear(p.getFullYear() + 2000);
            }
            return format(p, 'yyyy-MM-dd');
        }
      } catch(e) {}
    }

    // 4. محاولة أخيرة باستخدام parseISO
    const parsed = parseISO(clean);
    if (isValid(parsed)) {
        if (parsed.getFullYear() < 100) {
            parsed.setFullYear(parsed.getFullYear() + 2000);
        }
        return format(parsed, 'yyyy-MM-dd');
    }

    return null;
  }

  private parseFlexibleTime(timeStr: string | undefined): Date | null {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) return null;
    const cleanTime = timeStr.trim();
    
    // معالجة وقت إكسيل العشري (مثل 0.333 يعادل 08:00)
    const num = Number(cleanTime);
    if (!isNaN(num) && num >= 0 && num < 1) {
      const totalSeconds = Math.round(num * 86400);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }

    const formats = ['HH:mm', 'H:mm', 'HH:mm:ss', 'H:mm:ss', 'hh:mm a', 'h:mm a', 'hh:mm:ss a'];
    for (const f of formats) {
      try {
        const parsed = parse(cleanTime, f, new Date());
        if (isValid(parsed)) return parsed;
      } catch(e) {}
    }
    return null;
  }

  async processImport(
    rows: RawAttendanceRow[], 
    employees: Employee[], 
    workSettings: WorkHoursSettings,
    targetMonth?: number, // 1-indexed
    targetYear?: number
  ): Promise<ImportPreviewResult> {
    const records: Partial<AttendanceRecord>[] = [];
    const errors: { row: number; message: string }[] = [];
    const summary = { total: rows.length, valid: 0, invalid: 0, present: 0, late: 0, holiday: 0 };

    rows.forEach((row, index) => {
      const normalizedDate = this.normalizeDate(row.date);
      
      if (!row.employeeNumber || !normalizedDate) {
        errors.push({ row: index + 2, message: `تاريخ غير صالح أو رقم موظف مفقود: ${row.date || '---'}` });
        summary.invalid++;
        return;
      }

      const dateObj = parseISO(normalizedDate);
      
      // التحقق من مطابقة الفترة المختارة
      if (targetMonth && targetYear) {
        const rowMonth = getMonth(dateObj) + 1;
        const rowYear = getYear(dateObj);
        if (rowMonth !== targetMonth || rowYear !== targetYear) {
          errors.push({ row: index + 2, message: `التاريخ ${normalizedDate} خارج الفترة المحددة (${targetMonth}/${targetYear}).` });
          summary.invalid++;
          return;
        }
      }

      const emp = employees.find(e => e.employeeNumber === String(row.employeeNumber).trim());
      if (!emp) {
        errors.push({ row: index + 2, message: `موظف غير معرف في النظام: ${row.employeeNumber}` });
        summary.invalid++;
        return;
      }

      const isArch = emp.departmentName?.toLowerCase().includes('arch') || false;
      const schedule = isArch ? workSettings.architectural : workSettings.general;
      const dayName = format(dateObj, 'EEEE') as DayOfWeek;
      const isWeekend = workSettings.holidays.includes(dayName);
      const isPublicHoliday = workSettings.publicHolidays.some(h => h.date === normalizedDate);

      let status: AttendanceRecord['status'] = 'present';
      let totalMinutesLate = 0;

      const actualIn1 = this.parseFlexibleTime(row.checkIn);
      const actualIn2 = this.parseFlexibleTime(row.checkIn2);

      if (isPublicHoliday || isWeekend) {
        status = isPublicHoliday ? 'holiday' : 'weekend';
        summary.holiday++;
      } else {
        const isDoubleShift = !!schedule.eveningStartTime && schedule.eveningStartTime !== "00:00" && schedule.eveningStartTime !== "";

        if (isDoubleShift) {
          if (actualIn1) {
            const expectedIn1 = this.parseFlexibleTime(schedule.morningStartTime)!;
            const diff = differenceInMinutes(actualIn1, expectedIn1);
            if (diff > (schedule.bufferMinutes || 0)) totalMinutesLate += diff;
          }
          if (actualIn2) {
            const expectedIn2 = this.parseFlexibleTime(schedule.eveningStartTime)!;
            const diff = differenceInMinutes(actualIn2, expectedIn2);
            if (diff > (schedule.bufferMinutes || 0)) totalMinutesLate += diff;
          }
          if (!actualIn1 && !actualIn2) status = 'absent';
        } else {
          const bestEntry = actualIn1 || actualIn2;
          if (bestEntry) {
            const expectedIn = this.parseFlexibleTime(schedule.morningStartTime)!;
            const diff = differenceInMinutes(bestEntry, expectedIn);
            if (diff > (schedule.bufferMinutes || 0)) totalMinutesLate += diff;
          } else {
            status = 'absent';
          }
        }

        if (status !== 'absent') {
          if (totalMinutesLate > 0) {
            status = 'late';
            summary.late++;
          } else {
            summary.present++;
          }
        }
      }

      records.push({
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeNumber: emp.employeeNumber,
        date: normalizedDate,
        checkIn: row.checkIn || '',
        checkOut: row.checkOut || '',
        checkIn2: row.checkIn2 || '',
        checkOut2: row.checkOut2 || '',
        status,
        minutesLate: totalMinutesLate,
        isHoliday: isPublicHoliday,
        isWeekend,
        companyId: this.companyId
      });

      summary.valid++;
    });

    return { records, errors, summary };
  }

  async saveRecords(records: Partial<AttendanceRecord>[]) {
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, paths.attendance(this.companyId));

    records.forEach(record => {
      const docRef = doc(collectionRef);
      batch.set(docRef, {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}