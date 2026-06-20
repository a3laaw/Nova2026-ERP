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
import { WorkHoursSettings, DayOfWeek, DailySchedule } from '@/types/work-hours';
import { parse, differenceInMinutes, format, isValid } from 'date-fns';

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

  private parseFlexibleTime(timeStr: string | undefined): Date | null {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) return null;
    const cleanTime = timeStr.trim();
    const formats = ['HH:mm', 'H:mm', 'HH:mm:ss', 'H:mm:ss'];
    for (const f of formats) {
      const parsed = parse(cleanTime, f, new Date());
      if (isValid(parsed)) return parsed;
    }
    return null;
  }

  async processImport(
    rows: RawAttendanceRow[], 
    employees: Employee[], 
    workSettings: WorkHoursSettings
  ): Promise<ImportPreviewResult> {
    const records: Partial<AttendanceRecord>[] = [];
    const errors: { row: number; message: string }[] = [];
    const summary = { total: rows.length, valid: 0, invalid: 0, present: 0, late: 0, holiday: 0 };

    rows.forEach((row, index) => {
      if (!row.employeeNumber || !row.date) return;

      const emp = employees.find(e => e.employeeNumber === row.employeeNumber);
      if (!emp) {
        errors.push({ row: index + 2, message: `موظف غير موجود: ${row.employeeNumber || '---'}` });
        summary.invalid++;
        return;
      }

      const dateObj = new Date(row.date);
      if (isNaN(dateObj.getTime())) {
        errors.push({ row: index + 2, message: `تاريخ غير صالح: ${row.date || '---'}` });
        summary.invalid++;
        return;
      }

      const isArch = emp.departmentName?.toLowerCase().includes('arch') || false;
      const schedule = isArch ? workSettings.architectural : workSettings.general;
      const dayName = format(dateObj, 'EEEE') as DayOfWeek;
      const isWeekend = workSettings.holidays.includes(dayName);
      const isPublicHoliday = workSettings.publicHolidays.some(h => h.date === row.date);

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
          // ذكاء الفترتين: فحص كل فترة على حدة
          if (actualIn1) {
            const expectedIn1 = this.parseFlexibleTime(schedule.morningStartTime)!;
            const diff = differenceInMinutes(actualIn1, expectedIn1);
            if (diff > (schedule.bufferMinutes || 0)) totalMinutesLate += diff;
          } else {
            // غياب جزئي عن الفترة الأولى
          }

          if (actualIn2) {
            const expectedIn2 = this.parseFlexibleTime(schedule.eveningStartTime)!;
            const diff = differenceInMinutes(actualIn2, expectedIn2);
            if (diff > (schedule.bufferMinutes || 0)) totalMinutesLate += diff;
          }
        } else {
          // ذكاء الفترة الواحدة: البحث عن أي بصمة دخول متاحة
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
        date: row.date,
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
