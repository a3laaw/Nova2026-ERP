/**
 * @fileOverview تعريف الأنواع الأساسية لنظام الصلاحيات المطور.
 */

export type Action = 
  | 'view' | 'create' | 'edit' | 'delete' 
  | 'post' | 'unpost' | 'approve' | 'archive' 
  | 'transfer' | 'print' | 'export' | 'seed';

export type Scope = 'none' | 'own' | 'dept' | 'branch' | 'all';

export interface PermissionRule {
  resourceId: string;
  action: Action;
  scope: Scope;
}

export interface SystemResource {
  id: string; // المعرف الموحد للموديول (e.g. 'accounting')
  labelAr: string;
  labelEn: string;
  module: string; // تصنيف وظيفي
  allowedActions: Action[]; // الأفعال المخصصة لطبيعة هذا المورد
}

export interface RoleMatrix {
  id?: string;
  code: string;
  name: string;
  nameEn: string;
  matrix: PermissionRule[];
  isActive: boolean;
  isSystemRole: boolean;
  order: number;
}
