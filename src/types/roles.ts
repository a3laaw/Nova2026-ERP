/**
 * @fileOverview تعريف واجهات البيانات لنظام الصلاحيات والأدوار المطور.
 */

import { BaseReference } from './reference';
import { PermissionRule } from '@/lib/permissions/types';

export interface Role extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  description?: string;
  permissions: string[]; // الصلاحيات الكلاسيكية (للتوافق)
  matrix: PermissionRule[]; // المصفوفة الذكية الجديدة
  isActive: boolean;
  isSystemRole: boolean;
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
