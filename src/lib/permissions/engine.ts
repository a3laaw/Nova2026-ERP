/**
 * @fileOverview محرك اتخاذ القرار (The Authorization Engine).
 * تم تعزيزه بفحوصات دفاعية ضد قيم undefined.
 */

import { RoleMatrix, Action, Scope } from './types';

/**
 * التحقق من صلاحية الوصول لمورد معين وفعل محدد مع النطاق
 */
export function hasResourceAccess(
  role: RoleMatrix | null,
  resourceId: string,
  action: Action = 'view'
): { can: boolean; scope: Scope } {
  
  if (!resourceId) return { can: false, scope: 'none' };

  // 1. حالة الأدمن (Master Key)
  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return { can: true, scope: 'all' };
  }

  if (!role || !role.matrix) {
    return { can: false, scope: 'none' };
  }

  // 2. البحث في المصفوفة مع فحص الأمان
  const rule = role.matrix.find(m => 
    m?.resourceId && 
    m.resourceId.toLowerCase() === resourceId.toLowerCase() && 
    m.action === action
  );

  if (rule && rule.scope !== 'none') {
    return { can: true, scope: rule.scope };
  }

  return { can: false, scope: 'none' };
}

/**
 * دالة مبسطة للسايدبار: هل يرى الموظف هذا المورد أصلاً؟
 * يراه إذا كان يملك أي صلاحية (حتى لو عرض فقط) داخل المورد بنطاق غير "none"
 */
export function canViewModule(role: RoleMatrix | null, resourceId: string): boolean {
  if (!resourceId) return false;

  // الأدمن يرى كل شيء دائماً
  if (role?.code?.toLowerCase() === 'admin' || role?.code?.toLowerCase() === 'system_admin') {
    return true;
  }
  
  if (!role || !role.matrix) return false;

  // البحث عن أي قاعدة تسمح بالوصول لهذا المورد
  return role.matrix.some(m => 
    m?.resourceId && 
    m.resourceId.toLowerCase() === resourceId.toLowerCase() && 
    m.scope !== 'none'
  );
}
