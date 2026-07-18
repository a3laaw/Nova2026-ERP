import { BaseReference } from './reference';

export type FieldVisitStatus = 'draft' | 'submitted' | 'approved';

export interface FieldVisit extends BaseReference {
  id: string;
  companyId: string;
  projectId: string; // Transaction ID
  transactionId?: string;
  boqItemId?: string;
  boqItemName?: string;
  technicalStageId?: string;
  engineerId?: string;
  engineerName?: string;
  visitDate: string; // YYYY-MM-DD
  gpsLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  progressPercentage?: number;
  workersCount?: number;
  completedWork?: string;
  issues?: string;
  photoUrls?: string[];
  status: FieldVisitStatus;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
