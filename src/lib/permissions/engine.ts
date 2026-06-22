/**
 * @fileOverview محرك اتخاذ القرار الأمني (The Sovereign Auth Engine).
 * يدعم التحقق من الصلاحية مع النطاق (Scope) ومعطيات السجل (Record Data).
 */

import { RoleMatrix, Action, Scope } from './types';

/**
 * النتيجة التفصيلية لعملية التحقق
 */
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

  // 1. حالة الأدمن (Master Key) - يتجاوز المصفوفة تماماً
  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return { can: true, scope: 'all' };
  }

  if (!role || !role.matrix) {
    return { can: false, scope: 'none' };
  }

  // 2. البحث الدقيق في المصفوفة (Case-insensitive)
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
 * دالة التحقق "الميداني" (Field Validation):
 * هل يحق لهذا المستخدم تنفيذ هذا الفعل على هذا السجل (Record) تحديداً؟
 */
export function canPerformOnRecord(
  access: AccessResult,
  user: { uid: string; departmentId?: string },
  record: { userId?: string; departmentId?: string }
): boolean {
  if (!access.can) return false;
  if (access.scope === 'all') return true; // يرى كل شيء في المنشأة (حتى لو من خارج القسم)
  
  if (access.scope === 'dept') {
    // يحق له إذا كان السجل يخص نفس قسمه فقط
    return !!(user.departmentId && record.departmentId && user.departmentId === record.departmentId);
  }

  if (access.scope === 'own') {
    // يحق له إذا كان هو صاحب السجل فقط
    return !!(user.uid && record.userId && user.uid === record.userId);
  }

  return false;
}

/**
 * دالة السايدبار: هل الموظف مخول برؤية هذا الموديول؟
 * يظهر الموديول إذا كان يملك صلاحية View بأي نطاق غير none
 */
export function canViewModule(role: RoleMatrix | null, resourceId: string): boolean {
  if (!resourceId) return false;

  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return true;
  }
  
  if (!role || !role.matrix) return false;

  return role.matrix.some(m => 
    m?.resourceId?.toLowerCase() === resourceId.toLowerCase() && 
    m.action === 'view' &&
    m.scope !== 'none'
  );
}
