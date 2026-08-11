/**
 * @fileOverview تعريف واجهات البيانات المرجعية لنظام Nova ERP.
 */

export interface BaseReference {
  id?: string;
  companyId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface BaseReferenceList extends BaseReference {
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  isSystem: boolean;
  isEditable: boolean;
  isActive: boolean;
  order: number;
  createdBy?: string;
  updatedBy?: string;
  
  // حقول عمولات البنوك المضافة
  feePercentage?: number;   // نسبة العمولة (مثلاً 0.005 للـ كي نت)
  feeFixedAmount?: number;  // مبلغ ثابت (مثلاً 0.100 د.ك)
}

export interface UnitType extends BaseReferenceList {
  symbol?: string;
  category?: string; 
}

export interface Governorate extends BaseReference {
  name: string;
  nameEn: string;
  order: number;
  isActive: boolean;
}

export interface Area extends BaseReference {
  governorateId: string;
  name: string;
  nameEn: string;
  order: number;
  isActive: boolean;
}

export interface MeetingRoom extends BaseReference {
  id: string;
  name: string;
  nameEn: string;
  capacity?: number;
  isActive: boolean;
  order: number;
}

export interface ActivityType extends BaseReference {
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Service extends BaseReference {
  activityTypeId: string;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface SubService extends BaseReference {
  activityTypeId: string;
  serviceId: string;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface TechnicalStage extends BaseReference {
  activityTypeId: string;
  serviceId: string;
  subServiceId: string;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  fullPathName?: string;
  order: number;
  isNumeric: boolean;
  numericTarget?: number | null;
  isTimed: boolean;
  timeTargetDays?: number | null;
  isRequired: boolean;
  isEditable: boolean;
  nextStageIds: string[];
  allowedDepartmentIds?: string[];
  isActive: boolean;
}

export interface Department extends BaseReference {
  name: string;
  nameEn: string;
  description?: string;
  order: number;
  isActive: boolean;
  color?: string;
}

export interface Job extends BaseReference {
  departmentId: string;
  departmentName?: string;
  name: string;
  nameEn: string;
  roleId?: string;
  roleName?: string;
  roleCode?: string;
  hourlyCost?: number;
  order: number;
  isActive: boolean;
}

export type BOQNodeRole = 'group' | 'work_item';

export interface BOQReferenceNode extends BaseReference {
  code: string;
  title: string;
  description?: string;
  parentId: string | null;
  order: number;
  childrenCount: number;
  depth: number;
  ancestorIds: string[];
  nodeRole: BOQNodeRole;
  isExecutable: boolean;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  activityTypeId?: string;
  activityTypeName?: string;
  serviceId?: string;
  serviceName?: string;
  subServiceId?: string;
  subServiceName?: string;
  inheritServices?: boolean;
  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;
  technicalStageIds?: string[];
  estimatedRate?: number;
  billingTriggerGroup?: string;
  allowedItemCategoryIds?: string[];
  allowedServiceIds?: string[];
  allowedServiceNames?: string[];
  allowedActivityTypeIds?: string[];
  allowedActivityTypeNames?: string[];
}
