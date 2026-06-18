/**
 * @fileOverview تعريف واجهات البيانات المرجعية لنظام Nova ERP.
 * يضمن هذا الملف توحيد هيكل البيانات عبر كافة موديولات النظام.
 */

export type ControlType = 'TimeBased' | 'Numeric' | 'Hybrid';
export type StageType = 'Internal' | 'ClientReview' | 'Permit' | 'Execution' | 'Financial' | 'Closing';
export type TrackingType = 'Manual' | 'AutoByDeliverable' | 'ExternalSystem';

export interface BaseReference {
  id?: string;
  createdAt?: any;
  updatedAt?: any;
  companyId: string;
}

export interface Department extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  activityTypes: string[];
  isActive: boolean;
  order: number;
}

export interface Job extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  departmentId: string;
  departmentCode: string;
  isActive: boolean;
  order: number;
}

export interface Governorate extends BaseReference {
  name: string;
  nameEn: string;
  isActive: boolean;
  order: number;
}

export interface Area extends BaseReference {
  name: string;
  nameEn: string;
  governorateId: string;
  isActive: boolean;
  order: number;
}

export interface ServiceType extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  description?: string;
  moduleScope?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

export interface TransactionType extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  serviceTypeId: string;
  serviceTypeCode?: string;
  departmentIds: string[];
  isActive: boolean;
  order: number;
}

export interface SubService extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  transactionTypeId: string;
  transactionTypeCode: string;
  departmentIds: string[];
  departmentCodes?: string[];
  outputType?: 'Drawing' | 'Report' | 'Permit' | 'Physical' | 'Other';
  isCore: boolean;
  isBillable: boolean;
  requiresTechnicalStages: boolean;
  allowParallelExecution: boolean;
  clientVisible: boolean;
  order: number;
  isActive: boolean;
}

export interface TechnicalStage extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  transactionTypeId: string;
  subServiceId: string;
  stageType: StageType;
  controlType: ControlType;
  controlValue: {
    time?: string;
    numeric?: number;
  };
  trackingType: TrackingType;
  expectedDurationDays: number;
  maxOccurrences: number;
  isEditable: boolean;
  isRequired: boolean;
  allowParallel: boolean;
  nextStageIds: string[];
  blockedByStageIds: string[];
  defaultAssigneeDepartmentIds: string[];
  defaultAssigneeJobIds: string[];
  billableTrigger: boolean;
  milestoneKey: string;
  clientVisible: boolean;
  sortGroup?: string;
  order: number;
  isActive: boolean;
}
