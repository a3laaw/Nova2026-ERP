
import { BaseReference } from './reference';

export type TransactionStatus = 'new' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
export type StageInstanceStatus = 'pending' | 'blocked' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Transaction extends BaseReference {
  transactionNumber: string;
  clientId: string;
  clientName?: string;
  activityTypeId: string;
  activityTypeName?: string;
  serviceId: string;
  serviceName?: string;
  subServiceId: string;
  subServiceName?: string;
  assignedEngineerId?: string;
  assignedEngineerName?: string;
  description?: string;
  status: TransactionStatus;
  createdBy?: string;
  updatedBy?: string;
}

export interface TransactionTimelineEvent extends BaseReference {
  transactionId: string;
  type: 'system' | 'update' | 'note' | 'status_change' | 'stage_start' | 'stage_complete' | 'numeric_update';
  content: string;
  userId?: string;
  userName?: string;
}

export interface StageInstance extends BaseReference {
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
  status: StageInstanceStatus;
  activityTypeId: string;
  serviceId: string;
  subServiceId: string;
  startDate?: any;
  endDate?: any;
  startedAt?: any;
  completedAt?: any;
  completedBy?: string;
}
