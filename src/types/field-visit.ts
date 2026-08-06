import { BaseReference } from './reference';
import { LaborDetail, EquipmentUsed } from './documents';

export type FieldVisitStatus = 'draft' | 'submitted' | 'approved' | 'verified';

/**
 * حالات الإنجاز الفني (رد المهندس المسؤول - يتم تحديدها بعد التقرير)
 */
export type WorkItemExecutionStatus = 'pending' | 'completed' | 'partial' | 'not_completed';

export interface WorkItemLog {
  boqItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes: string;           // ملاحظات المهندس الميداني/المراقب
  photoUrls: string[];
  executionStatus?: WorkItemExecutionStatus; // رد المهندس المسؤول (الحالة)
  engineerResponseNote?: string;             // رد المهندس المسؤول (نصي)
}

export interface FieldVisit extends BaseReference {
  id: string;
  companyId: string;
  transactionId: string;
  transactionNumber: string;
  clientId: string;
  clientName: string;
  engineerId: string;
  engineerName: string;
  visitDate: string; // YYYY-MM-DD
  
  // الموقع الموثق
  locationUrl?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
  } | null;

  // الإنجاز التفصيلي (الجدول مع رد المسؤول)
  items: WorkItemLog[];
  
  // الموارد المستخدمة
  laborDetails: any[];
  equipmentUsed: any[];
  
  overallProgress?: number;
  generalNotes?: string;
  status: FieldVisitStatus;
  isVerified?: boolean;
  
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  updatedByName?: string;
  isEdited?: boolean;
  clonedFromId?: string; 
}
