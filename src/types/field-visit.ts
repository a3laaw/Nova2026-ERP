import { BaseReference } from './reference';
import { LaborDetail, EquipmentUsed } from './documents';

export type FieldVisitStatus = 'draft' | 'submitted' | 'approved' | 'verified';

export type WorkItemExecutionStatus = 'pending' | 'completed' | 'partial' | 'not_completed';

export interface WorkItemLog {
  boqItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes: string;
  photoUrls: string[];
  executionStatus?: WorkItemExecutionStatus;
  engineerResponseNote?: string;
}

export interface MaterialLog {
  type: string;
  unit: string;
  quantity: number;
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
  visitDate: string; 
  
  activeStageId?: string;
  activeStageName?: string;

  locationUrl?: string;
  
  // الإنجاز الفني (BOQ)
  items: WorkItemLog[];
  
  // الموارد (الشبكة الرباعية)
  staffDetails: any[];      // الموظفون (Position, No)
  laborDetails: any[];      // العمالة (Trade, Area, No)
  equipmentUsed: any[];     // المعدات (Type, No, Hours)
  materialsDelivered: MaterialLog[]; // المواد (Type, Unit, Qty)
  
  status: FieldVisitStatus;
  isVerified?: boolean;
  
  createdAt: any;
  updatedAt: any;
}
