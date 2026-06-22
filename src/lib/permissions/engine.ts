/**
 * @fileOverview محرك اتخاذ القرار الأمني السيادي.
 * يقوم بالربط النهائي بين صلاحية الدور (Action) والسياق المكاني للموظف (Department ID).
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

  // 1. حالة الأدمن (Master Key) - تجاوز كامل لكافة القيود
  if (role?.code?.toUpperCase() === 'ADMIN' || role?.code?.toLowerCase() === 'system_admin') {
    return { can: true, scope: 'all' };
  }

  if (!role || !role.matrix) {
    return { can: false, scope: 'none' };
  }

  // 2. البحث في مصفوفة الصلاحيات (تقاطع المورد مع الفعل)
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
  const access = hasResourceAccess(role, resourceId, 'view');
  return access.can;
}

/**
 * دالة الإنفاذ الميداني (The Real Link):
 * تربط القسم المرجعي للموظف بالقسم المرجعي للسجل.
 */
export function canPerformOnRecord(
  access: AccessResult,
  currentUser: { uid: string; departmentId?: string },
  record: { createdBy?: string; departmentId?: string }
): boolean {
  if (!access.can) return false;
  
  // إذا كان النطاق "الكل": يسمح له بغض النظر عن الأقسام
  if (access.scope === 'all') return true;
  
  // إذا كان النطاق "القسم": نقارن الـ IDs المرجعية حصراً
  if (access.scope === 'dept') {
    // التحقق من أن الموظف والسجل يتبعان لنفس كود القسم المرجعي
    return !!(
      currentUser.departmentId && 
      record.departmentId && 
      currentUser.departmentId === record.departmentId
    );
  }

  // إذا كان النطاق "الموظف": يسمح له فقط بما أنشأه هو
  if (access.scope === 'own') {
    return !!(currentUser.uid && record.createdBy && currentUser.uid === record.createdBy);
  }

  return false;
}
