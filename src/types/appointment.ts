import { BaseReference } from './reference';

export type AppointmentType = 'client_meeting' | 'site_visit' | 'busy_blocked' | 'other';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment extends BaseReference {
  id: string;
  companyId: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  clientId: string;
  clientName: string;
  
  // الربط الفني بالمشاريع والمراحل
  transactionId?: string;      // معرف المعاملة (المشروع)
  transactionNumber?: string;  // رقم المعاملة للعرض
  stageId?: string;            // معرف المرحلة الفنية (StageInstance)
  stageName?: string;          // اسم المرحلة
  
  engineerId: string;
  engineerName: string;
  start: string; // ISO String
  end?: string;  // ISO String
  location?: string;
  notes?: string;
  visitCount?: number;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
