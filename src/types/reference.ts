
/**
 * @fileOverview تعريف واجهات البيانات المرجعية والتشغيلية لنظام Nova ERP.
 * تم تحديثه لضمان الاتساق الكامل بين القوالب المرجعية والنسخ التنفيذية.
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

// --- المرجعيات الأساسية (The Foundation) ---

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

// --- المسار الفني: القوالب المرجعية (Technical Path Templates) ---

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

/**
 * TechnicalStage - القالب المرجعي للمرحلة
 */
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

// --- الكيانات التشغيلية (Operational Entities) ---

export interface ContractMilestone {
  id: string;
  title: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'due' | 'paid';
  linkedStageInstanceId?: string; // ربط بنسخة تنفيذية محددة
  linkedMilestoneKey?: string; // ربط بمفتاح مرحلة (مثلاً M1)
}

export interface Contract extends BaseReference {
  projectId: string;
  title: string;
  totalAmount: number;
  currency: string;
  status: 'draft' | 'active' | 'completed' | 'terminated';
  milestones: ContractMilestone[];
}

/**
 * StageInstance - نسخة تنفيذية حية من المرحلة المرجعية
 */
export interface StageInstance extends BaseReference {
  projectId: string;
  templateStageId: string; // الرابط للقالب المرجعي TechnicalStage
  subServiceId: string; // السياق التشغيلي
  name: string;
  code: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  billableTrigger: boolean;
  milestoneKey: string;
  order: number;
  startedAt?: any;
  completedAt?: any;
  completedBy?: string;
}
