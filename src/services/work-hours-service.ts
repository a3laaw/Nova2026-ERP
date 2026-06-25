/**
 * @fileOverview خدمة التعامل مع Firestore لإعدادات مواعيد العمل التخصصية.
 */

'use client';

import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { WorkHoursSettings, DailySchedule } from '@/types/work-hours';
import { format } from 'date-fns';

export const WORK_HOURS_DOC_ID = 'work_hours';

export class WorkHoursService {
  constructor(private db: Firestore, private companyId: string) {}

  private getDocRef() {
    return doc(this.db, 'companies', this.companyId, 'settings', WORK_HOURS_DOC_ID);
  }

  async getSettings(): Promise<WorkHoursSettings | null> {
    const snap = await getDoc(this.getDocRef());
    const defaults = this.getDefaultSettings();

    if (snap.exists()) {
      const data = snap.data() as WorkHoursSettings;
      // ضمان وجود كافة التخصصات والحقول الجديدة (Migration Support)
      return {
        ...defaults,
        ...data,
        architectural: { ...defaults.architectural, ...data.architectural },
        meetingRooms: { ...defaults.meetingRooms, ...data.meetingRooms },
        fieldWork: { ...defaults.fieldWork, ...data.fieldWork },
      } as WorkHoursSettings;
    }
    return null;
  }

  async saveSettings(settings: Partial<WorkHoursSettings>, userId: string) {
    const ref = this.getDocRef();
    await setDoc(ref, {
      ...settings,
      companyId: this.companyId,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }, { merge: true });
  }

  /**
   * إعدادات افتراضية للشركات الجديدة تشمل التخصصات الثلاثة والوضع المرن
   */
  getDefaultSettings(): Omit<WorkHoursSettings, 'companyId'> {
    const commonSchedule: DailySchedule = {
      mode: 'single',
      morningStartTime: "08:00",
      morningEndTime: "13:00",
      eveningStartTime: "14:00",
      eveningEndTime: "17:00",
      slotDurationMinutes: 60,
      restDurationMinutes: 15,
      bufferMinutes: 15
    };

    return {
      architectural: { ...commonSchedule }, // افتراضي فترة واحدة للمكتب
      meetingRooms: { ...commonSchedule, slotDurationMinutes: 30, restDurationMinutes: 5 },
      fieldWork: { ...commonSchedule, mode: 'double', restDurationMinutes: 30 }, // افتراضي فترتين للميدان
      holidays: ["Friday"],
      publicHolidays: [],
      halfDay: {
        day: "Thursday",
        mode: "morning_only",
        endTime: "13:00"
      },
      ramadan: {
        enabled: false,
        mode: "single",
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        morningStartTime: "09:00",
        morningEndTime: "14:00",
        eveningStartTime: "20:00",
        eveningEndTime: "23:00",
        slotDurationMinutes: 30,
        restDurationMinutes: 0,
        bufferMinutes: 0
      }
    };
  }
}
