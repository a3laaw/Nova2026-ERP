import { BaseReference } from './reference';

export type AppointmentType = 'client_meeting' | 'site_visit' | 'busy_blocked' | 'hall_meeting' | 'other';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment extends BaseReference {
  id: string;
  companyId: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  clientId: string;
  clientName: string;
  
  // الربط اللوجستي بالقاعات والأقسام
  hallId?: string;
  hallName?: string;
  departmentId?: string;
  departmentName?: string;
  departmentColor?: string;

  // الربط الفني بالمشاريع والمراحل
  transactionId?: string;      
  transactionNumber?: string;  
  stageId?: string;            
  stageName?: string;          
  
  // دعم المهندسين المتعددين (لورش العمل المشتركة)
  engineerId: string; // المهندس الرئيسي (للتوافق)
  engineerName: string;
  additionalEngineerIds?: string[]; 
  additionalEngineerNames?: string[];
  
  start: string; // ISO String
  end?: string;  // ISO String
  location?: string;
  notes?: string;
  visitCount?: number;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
