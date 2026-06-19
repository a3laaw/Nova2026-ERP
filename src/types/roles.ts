/**
 * @fileOverview تعريف واجهات البيانات لنظام الصلاحيات والأدوار.
 */

import { BaseReference } from './reference';

export interface Role extends BaseReference {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  isActive: boolean;
  order: number;
}

export interface PermissionGroup {
  id: string;
  label: string;
  labelEn: string;
  permissions: PermissionItem[];
}

export interface PermissionItem {
  code: string;
  label: string;
  labelEn: string;
}

export interface UserRoleBinding {
  roleId: string;
  roleCode: string;
  isActive: boolean;
  companyId: string;
}
