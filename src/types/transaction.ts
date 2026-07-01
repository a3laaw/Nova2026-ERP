import { BaseReference } from './reference';

export type TransactionStatus = 'new' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Transaction extends BaseReference {
  id: string;
  transactionNumber: string; 
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
  stageId?: string; 
  technicalStageId?: string; 
  type: 'system' | 'stage_start' | 'stage_complete' | 'stage_reopen' | 'comment' | 'numeric_update' | 'admin_override';
  content: string;
  userId: string;
  userName: string;
  isArchived?: boolean; 
  archivedAt?: any;
}

export type CommentType = 'general' | 'note' | 'warning' | 'instruction';

export interface TransactionComment extends BaseReference {
  id?: string;
  transactionId: string;
  stageInstanceId?: string | null; 
  stageName?: string; 
  content: string;
  commentType: CommentType;
  createdBy: string;
  createdByName: string;
  isEdited?: boolean;
  isPinned?: boolean;
  isArchived?: boolean; 
  archivedAt?: any;
  parentCommentId?: string | null;
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
  startedAt?: any;
  completedAt?: any;
  completedBy?: string;
  updatedBy?: string;
  isTemporary?: boolean;
  isComplementary?: boolean; // NEW: flag to allow parallel execution without blocking the main path
  createdFromVO?: boolean;
  originType?: 'temporary_vo' | 'manual_injection';
  isManuallyActivated?: boolean; 
}
