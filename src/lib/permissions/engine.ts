/**
 * @fileOverview محرك اتخاذ القرار الأمني (The Sovereign Auth Engine).
 */

import { RoleMatrix, Action, Scope } from './types';

/**
 * التحقق من صلاحية الوصول لمورد معين وفعل محدد
 */
export function hasResourceAccess(
  role: RoleMatrix | null,
  resourceId: string,
  action: Action = 'view'
): { can: boolean; scope: Scope } {
  
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
 * دالة السايدبار: هل الموظف مخول برؤية هذا الموديول؟
 */
export function canViewModule(role: RoleMatrix | null, resourceId: string): boolean {
  if (!resourceId) return false;

  // الأدمن يرى كل شيء
  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return true;
  }
  
  if (!role || !role.matrix) return false;

  // يرى الموديول إذا كان يملك أي صلاحية بداخله (حتى لو عرض فقط)
  return role.matrix.some(m => 
    m?.resourceId?.toLowerCase() === resourceId.toLowerCase() && 
    m.scope !== 'none'
  );
}
