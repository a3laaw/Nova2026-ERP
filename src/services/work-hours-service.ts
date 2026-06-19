/**
 * @fileOverview خدمة التعامل مع Firestore لإعدادات مواعيد العمل.
 */

'use client';

import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { WorkHoursSettings } from '@/types/work-hours';
import { format } from 'date-fns';

export const WORK_HOURS_DOC_ID = 'work_hours';

export class WorkHoursService {
  constructor(private db: Firestore, private companyId: string) {}

  private getDocRef() {
    return doc(this.db, 'companies', this.companyId, 'settings', WORK_HOURS_DOC_ID);
  }

  async getSettings(): Promise<WorkHoursSettings | null> {
    const snap = await getDoc(this.getDocRef());
    if (snap.exists()) {
      return snap.data() as WorkHoursSettings;
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
   * إعدادات افتراضية للشركات الجديدة
   */
  getDefaultSettings(): Omit<WorkHoursSettings, 'companyId'> {
    return {
      general: {
        morningStartTime: "08:00",
        morningEndTime: "12:00",
        eveningStartTime: "13:00",
        eveningEndTime: "17:00",
        slotDurationMinutes: 30,
        bufferMinutes: 0
      },
      architectural: {
        morningStartTime: "08:00",
        morningEndTime: "12:00",
        eveningStartTime: "13:00",
        eveningEndTime: "17:00",
        slotDurationMinutes: 30,
        bufferMinutes: 0
      },
      holidays: ["Friday"],
      publicHolidays: [],
      halfDay: {
        day: "Thursday",
        mode: "morning_only",
        endTime: "13:00"
      },
      ramadan: {
        enabled: false,
        mode: "double",
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        morningStartTime: "09:00",
        morningEndTime: "14:00",
        eveningStartTime: "20:00",
        eveningEndTime: "23:00",
        slotDurationMinutes: 30,
        bufferMinutes: 0
      }
    };
  }
}
