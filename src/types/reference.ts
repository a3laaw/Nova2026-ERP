/**
 * @fileOverview تعريف واجهات البيانات المرجعية لنظام Nova ERP.
 * يضمن هذا الملف توحيد هيكل البيانات عبر كافة موديولات النظام.
 */

export type ControlType = 'TimeBased' | 'Numeric' | 'Hybrid';

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
  name: string;
  serviceTypeId: string;
  departmentIds: string[];
}

export interface SubService extends BaseReference {
  name: string;
  parentId: string;
}

export interface TechnicalStage extends BaseReference {
  name: string;
  order: number;
  controlType: ControlType;
  controlValue: {
    time?: string;
    numeric?: number;
  };
  nextStageIds: string[];
  isEditable: boolean;
}
