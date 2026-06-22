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

export interface ResourceActionDefinition {
  action: Action;
  labelAr: string;
  labelEn: string;
}

export interface SystemResource {
  id: string; // المعرف الموحد (مثل 'crm', 'hr')
  labelAr: string;
  labelEn: string;
  module: string;
  allowedActions: Action[]; // الأفعال المخصصة لهذا المورد
}

export interface RoleMatrix {
  matrix: PermissionRule[];
  code: string;
  name: string;
  nameEn: string;
}
