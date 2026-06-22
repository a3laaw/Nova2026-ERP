/**
 * @fileOverview محرك اتخاذ القرار (The Authorization Engine).
 * يطبق منطق الصلاحيات بناءً على المصفوفة والنطاقات.
 */

import { RoleMatrix, Action, Scope } from './types';

export function hasResourceAccess(
  role: RoleMatrix | null,
  resourceId: string,
  action: Action = 'view'
): { can: boolean; scope: Scope } {
  // 1. حالة الأدمن (Master Key)
  if (role?.code === 'ADMIN' || role?.code === 'admin') {
    return { can: true, scope: 'all' };
  }

  if (!role || !role.matrix) {
    return { can: false, scope: 'none' };
  }

  // 2. البحث في المصفوفة (Case-Insensitive لضمان عدم حدوث فجوات)
  const rule = role.matrix.find(m => 
    m.resourceId?.toLowerCase() === resourceId?.toLowerCase() && 
    m.action === action
  );

  if (rule && rule.scope !== 'none') {
    return { can: true, scope: rule.scope };
  }

  return { can: false, scope: 'none' };
}

/**
 * دالة مبسطة للسايدبار: هل يرى الموظف هذا الموديول أصلاً؟
 * يراه إذا كان يملك أي صلاحية (حتى لو عرض فقط) داخل المورد.
 */
export function canViewModule(role: RoleMatrix | null, resourceId: string): boolean {
  if (role?.code === 'ADMIN' || role?.code === 'admin') return true;
  
  return role?.matrix?.some(m => 
    m.resourceId?.toLowerCase() === resourceId?.toLowerCase() && 
    m.scope !== 'none'
  ) || false;
}
