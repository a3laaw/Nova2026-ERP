/**
 * @fileOverview محرك اتخاذ القرار الأمني السيادي.
 * يدعم التحقق من الصلاحية مع النطاق (Scope) ومعطيات السجل.
 */

import { RoleMatrix, Action, Scope } from './types';

export interface AccessResult {
  can: boolean;
  scope: Scope;
}

/**
 * التحقق من صلاحية الوصول لمورد معين وفعل محدد
 */
export function hasResourceAccess(
  role: RoleMatrix | null,
  resourceId: string,
  action: Action = 'view'
): AccessResult {
  
  if (!resourceId) return { can: false, scope: 'none' };

  // 1. حالة الأدمن (Master Key)
  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return { can: true, scope: 'all' };
  }

  if (!role || !role.matrix) {
    return { can: false, scope: 'none' };
  }

  // 2. البحث في المصفوفة مع معالجة الأخطاء المحتملة
  const rule = role.matrix.find(m => 
    m?.resourceId?.toLowerCase() === resourceId.toLowerCase() && 
    m.action === action
  );

  if (rule && rule.scope !== 'none') {
    return { can: true, scope: rule.scope };
  }

  return { can: false, scope: 'none' };
}

/**
 * التحقق مما إذا كان المستخدم يملك صلاحية رؤية الموديول (السايدبار)
 */
export function canViewModule(role: RoleMatrix | null, resourceId: string): boolean {
  if (!resourceId) return false;

  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return true;
  }
  
  if (!role || !role.matrix) return false;

  // يظهر الموديول إذا كان لديه أي صلاحية (View) بنطاق غير none
  return role.matrix.some(m => 
    m?.resourceId?.toLowerCase() === resourceId.toLowerCase() && 
    m.action === 'view' &&
    m.scope !== 'none'
  );
}

/**
 * التحقق من ملكية السجل (Row Level Security)
 */
export function canPerformOnRecord(
  access: AccessResult,
  user: { uid: string; departmentId?: string },
  record: { userId?: string; departmentId?: string }
): boolean {
  if (!access.can) return false;
  if (access.scope === 'all') return true;
  
  if (access.scope === 'dept') {
    return !!(user.departmentId && record.departmentId && user.departmentId === record.departmentId);
  }

  if (access.scope === 'own') {
    return !!(user.uid && record.userId && user.uid === record.userId);
  }

  return false;
}
