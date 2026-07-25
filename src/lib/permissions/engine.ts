/**
 * @fileOverview محرك اتخاذ القرار الأمني السيادي الموحد.
 * تم تحديثه لمنح "الأدمن" صلاحية مطلقة (Master Key) حتى في غياب سجل الموظف.
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
  action: Action = 'view',
  userEmail?: string
): AccessResult {
  
  if (!resourceId) return { can: false, scope: 'none' };

  // 1. حالة الأدمن (Sovereign Master Key)
  // التجاوز المطلق للأدمن الرئيسي أو أي دور يحمل كود ADMIN
  if (
    userEmail === 'admin@novaflow.com' || 
    role?.code?.toUpperCase() === 'ADMIN' || 
    role?.code?.toLowerCase() === 'system_admin' || 
    role?.matrix?.some(m => m.resourceId === '*')
  ) {
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
export function canViewModule(role: RoleMatrix | null, resourceId: string, userEmail?: string): boolean {
  if (!resourceId) return false;
  const access = hasResourceAccess(role, resourceId, 'view', userEmail);
  return access.can;
}

/**
 * دالة الإنفاذ (Enforcement): ترمي خطأ إذا لم تتوفر الصلاحية.
 */
export function ensureActionPermission(permissions: string[], requiredCode: string) {
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  if (!permissions.includes(requiredCode)) {
    throw new Error(`UNAUTHORIZED_ACTION: Missing required permission [${requiredCode}]`);
  }
  return true;
}

/**
 * دالة الإنفاذ الميداني (The Real Link):
 */
export function canPerformOnRecord(
  access: AccessResult,
  currentUser: { uid: string; departmentId?: string; isDeveloper?: boolean },
  record: { createdBy?: string; departmentId?: string }
): boolean {
  if (!access.can) return false;
  
  // الأدمن والمطور يملكون حق الوصول لكافة السجلات دائماً
  if (access.scope === 'all' || currentUser.isDeveloper) return true;
  
  // إذا كان النطاق "القسم": نقارن الـ IDs المرجعية حصراً
  if (access.scope === 'dept') {
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
