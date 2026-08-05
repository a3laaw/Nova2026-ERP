import { BaseReference } from './reference';
import { LaborDetail, EquipmentUsed } from './documents';

export type FieldVisitStatus = 'draft' | 'submitted' | 'approved' | 'verified';

export interface WorkItemLog {
  boqItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes: string;
  photoUrls: string[];
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
  laborDetails: LaborDetail[];
  
  equipmentUsed: EquipmentUsed[];
  
  overallProgress?: number;
  generalNotes?: string;
  status: FieldVisitStatus;
  
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}
