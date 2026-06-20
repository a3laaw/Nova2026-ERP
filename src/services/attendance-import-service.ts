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
import { parse, differenceInMinutes, format, isValid, isBefore, isAfter } from 'date-fns';

export interface RawAttendanceRow {
  employeeNumber: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // HH:mm
  checkOut?: string; // HH:mm
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
      if (!row.employeeNumber && !row.date) return;

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
      let minutesLate = 0;
      let minutesEarlyLeave = 0;

      const actualIn = this.parseFlexibleTime(row.checkIn);
      const actualOut = this.parseFlexibleTime(row.checkOut);

      if (isPublicHoliday) {
        status = 'holiday';
        summary.holiday++;
      } else if (isWeekend) {
        status = 'weekend';
        summary.holiday++;
      } else {
        if (actualIn) {
          // ذكاء تحديد الفترة في حال الدوام المزدوج (Double Shift)
          let expectedInStr = schedule.morningStartTime;
          
          if (schedule.mode === 'double') {
            const morningStart = this.parseFlexibleTime(schedule.morningStartTime)!;
            const eveningStart = this.parseFlexibleTime(schedule.eveningStartTime)!;
            
            // إذا كان الدخول أقرب للفترة المسائية، قارن بها
            if (isAfter(actualIn, eveningStart) || differenceInMinutes(eveningStart, actualIn) < differenceInMinutes(actualIn, morningStart)) {
              expectedInStr = schedule.eveningStartTime;
            }
          }

          const expectedIn = this.parseFlexibleTime(expectedInStr)!;
          const diff = differenceInMinutes(actualIn, expectedIn);
          if (diff > (schedule.bufferMinutes || 0)) {
            minutesLate = diff;
            status = 'late';
            summary.late++;
          } else {
            summary.present++;
          }
        } else {
          status = 'absent';
        }

        if (actualOut) {
          let expectedOutStr = schedule.eveningEndTime;
          
          if (schedule.mode === 'double') {
             // في حال الشفتين، قد يكون الخروج من الشفت الصباحي
             const morningEnd = this.parseFlexibleTime(schedule.morningEndTime)!;
             const eveningEnd = this.parseFlexibleTime(schedule.eveningEndTime)!;
             
             if (isBefore(actualOut, morningEnd) || (differenceInMinutes(morningEnd, actualOut) < differenceInMinutes(actualOut, eveningEnd) && isBefore(actualOut, this.parseFlexibleTime(schedule.eveningStartTime)!))) {
                expectedOutStr = schedule.morningEndTime;
             }
          }

          const expectedOut = this.parseFlexibleTime(expectedOutStr)!;
          const diff = differenceInMinutes(expectedOut, actualOut);
          if (diff > 0) {
            minutesEarlyLeave = diff;
            if (status === 'present') status = 'early_leave';
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
        status,
        minutesLate,
        minutesEarlyLeave,
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
