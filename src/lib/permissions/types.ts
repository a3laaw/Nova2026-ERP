/**
 * @fileOverview تعريف الأنواع الأساسية لنظام الصلاحيات المطور.
 * تم تحديث النطاقات لتشمل مستويات أكثر دقة.
 */

export type Action = 
  | 'view' | 'create' | 'edit' | 'delete' 
  | 'post' | 'unpost' | 'approve' | 'archive' 
  | 'transfer' | 'print' | 'export' | 'seed';

/**
 * نطاقات الوصول (Access Scopes):
 * - none: لا يوجد وصول
 * - own: السجلات الخاصة بالمستخدم فقط
 * - dept: سجلات القسم التابع له المستخدم
 * - all: كافة سجلات المنشأة
 */
export type Scope = 'none' | 'own' | 'dept' | 'all';

export interface PermissionRule {
  resourceId: string;
  action: Action;
  scope: Scope;
}

export interface SystemResource {
  id: string;
  labelAr: string;
  labelEn: string;
  module: string;
  allowedActions: Action[];
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
