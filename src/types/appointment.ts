import { BaseReference } from './reference';

export type AppointmentType = 'client_meeting' | 'site_visit' | 'other';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment extends BaseReference {
  id: string;
  companyId: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  clientId?: string;
  clientName?: string;
  projectId?: string; // Links to Transaction ID
  projectNumber?: string;
  engineerId?: string;
  engineerName?: string;
  start: string; // ISO String
  end?: string;  // ISO String
  location?: string;
  notes?: string;
  visitCount?: number;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
