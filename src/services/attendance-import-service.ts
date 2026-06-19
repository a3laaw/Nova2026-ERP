'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp,
  getDocs,
  query
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { AttendanceRecord, Employee } from '@/types/hr';
import { WorkHoursSettings, DayOfWeek } from '@/types/work-hours';
import { parse, differenceInMinutes, format } from 'date-fns';

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

  /**
   * معالجة ملف الحضور ومطابقته مع الموظفين وإعدادات الدوام
   */
  async processImport(
    rows: RawAttendanceRow[], 
    employees: Employee[], 
    workSettings: WorkHoursSettings
  ): Promise<ImportPreviewResult> {
    const records: Partial<AttendanceRecord>[] = [];
    const errors: { row: number; message: string }[] = [];
    const summary = { total: rows.length, valid: 0, invalid: 0, present: 0, late: 0, holiday: 0 };

    rows.forEach((row, index) => {
      const emp = employees.find(e => e.employeeNumber === row.employeeNumber);
      
      if (!emp) {
        errors.push({ row: index + 1, message: `موظف غير معروف: ${row.employeeNumber}` });
        summary.invalid++;
        return;
      }

      // 1. تحديد نوع الدوام (معماري أو عام)
      const isArch = emp.departmentName?.toLowerCase().includes('arch') || false;
      const schedule = isArch ? workSettings.architectural : workSettings.general;
      
      // 2. التحقق من العطلات
      const dateObj = new Date(row.date);
      const dayName = format(dateObj, 'EEEE') as DayOfWeek;
      const isWeekend = workSettings.holidays.includes(dayName);
      const isPublicHoliday = workSettings.publicHolidays.some(h => h.date === row.date);

      let status: AttendanceRecord['status'] = 'present';
      let minutesLate = 0;
      let minutesEarlyLeave = 0;

      if (isPublicHoliday) {
        status = 'holiday';
        summary.holiday++;
      } else if (isWeekend) {
        status = 'weekend';
        summary.holiday++;
      } else {
        // حساب التأخير إذا كان هناك بصمة دخول
        if (row.checkIn) {
          const actualIn = parse(row.checkIn, 'HH:mm', new Date());
          const expectedIn = parse(schedule.morningStartTime, 'HH:mm', new Date());
          const diff = differenceInMinutes(actualIn, expectedIn);
          if (diff > schedule.bufferMinutes) {
            minutesLate = diff;
            status = 'late';
            summary.late++;
          }
        } else {
          status = 'absent';
        }

        // حساب الانصراف المبكر
        if (row.checkOut) {
          const actualOut = parse(row.checkOut, 'HH:mm', new Date());
          const expectedOut = parse(schedule.eveningEndTime, 'HH:mm', new Date());
          const diff = differenceInMinutes(expectedOut, actualOut);
          if (diff > 0) {
            minutesEarlyLeave = diff;
            if (status === 'present') status = 'early_leave';
          }
        }

        if (status === 'present') summary.present++;
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

  /**
   * حفظ السجلات في دفعات (Batches)
   */
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
