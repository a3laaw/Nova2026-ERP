/**
 * @fileOverview تعريف واجهات البيانات المرجعية لنظام Nova ERP (الهيكل الرباعي الجديد).
 */

export interface BaseReference {
  id?: string;
  companyId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ActivityType extends BaseReference {
  code: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Service extends BaseReference {
  activityTypeId: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface SubService extends BaseReference {
  activityTypeId: string;
  serviceId: string;
  code: string;
  name: string;
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
  description?: string;
  order: number;
  isNumeric: boolean;
  numericTarget?: number | null;
  isTimed: boolean;
  timeTargetDays?: number | null;
  isRequired: boolean;
  isEditable: boolean;
  nextStageIds: string[]; // يجب أن تكون داخل نفس الـ subService
  isActive: boolean;
}

export interface Department extends BaseReference {
  name: string;
  nameEn: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Job extends BaseReference {
  departmentId: string;
  name: string;
  nameEn: string;
  roleId?: string;     // الربط الذكي مع مصفوفة الصلاحيات
  roleName?: string;
  order: number;
  isActive: boolean;
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
