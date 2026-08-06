import { BaseReference } from './reference';
import { LaborDetail, EquipmentUsed } from './documents';

export type FieldVisitStatus = 'draft' | 'submitted' | 'approved' | 'verified';

export type WorkItemExecutionStatus = 'completed' | 'partial' | 'not_completed';

export interface WorkItemLog {
  boqItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes: string;
  photoUrls: string[];
  executionStatus: WorkItemExecutionStatus; // الحالة الفنية لكل بند
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

  // الإنجاز التفصيلي (الجدول)
  items: WorkItemLog[];
  
  // الموارد المستخدمة
  laborSelectionMode: 'group' | 'individual';
  workGroupId?: string;
  workGroupName?: string;
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
  clonedFromId?: string; // مرجع في حال تم النسخ من تقرير سابق
}
