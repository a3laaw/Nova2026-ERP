import { BaseReference } from './reference';

export type TransactionStatus = 'new' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Transaction extends BaseReference {
  id: string;
  transactionNumber: string; // الرقم المتسلسل المهني (مثل C-1001-01)
  clientId: string;
  clientName: string;
  activityTypeId: string;
  activityTypeName: string;
  serviceId: string;
  serviceName: string;
  subServiceId: string;
  subServiceName: string;
  assignedEngineerId: string;
  assignedEngineerName: string;
  description: string;
  status: TransactionStatus;
  companyId: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  updatedBy: string;
}

export interface TransactionTimelineEvent extends BaseReference {
  id?: string;
  transactionId: string;
  type: 'system' | 'stage_start' | 'stage_complete' | 'comment';
  content: string;
  userId: string;
  userName: string;
}

export interface StageInstance extends BaseReference {
  id?: string;
  transactionId: string;
  technicalStageId: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  isNumeric: boolean;
  numericTarget?: number | null;
  currentCount: number;
  isTimed: boolean;
  timeTargetDays?: number | null;
  isRequired: boolean;
  isEditable: boolean;
  nextStageIds: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  activityTypeId: string;
  serviceId: string;
  subServiceId: string;
}
