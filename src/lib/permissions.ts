/**
 * @fileOverview محرك التحقق من الصلاحيات (Permission Engine).
 * يدعم الـ Wildcards (*) للمدراء والمطورين.
 */

export type PermissionCode = string;

export interface RoleData {
  permissions: string[];
  isSystemRole?: boolean;
}

export interface UserContextData {
  isDeveloper?: boolean;
  roleData?: RoleData | null;
}

/**
 * التحقق من امتلاك المستخدم لصلاحية معينة
 */
export function hasPermission(user: UserContextData | null, code: PermissionCode): boolean {
  if (!user) return false;
  if (user.isDeveloper) return true;
  if (!user.roleData?.permissions) return false;

  const perms = user.roleData.permissions;
  
  // إذا كان يملك صلاحية النجمة (كل شيء)
  if (perms.includes('*')) return true;
  
  return perms.includes(code);
}

/**
 * التحقق من امتلاك أي من الصلاحيات المطلوبة
 */
export function hasAnyPermission(user: UserContextData | null, codes: PermissionCode[]): boolean {
  return codes.some(code => hasPermission(user, code));
}

/**
 * التحقق من امتلاك كافة الصلاحيات المطلوبة
 */
export function hasAllPermissions(user: UserContextData | null, codes: PermissionCode[]): boolean {
  return codes.every(code => hasPermission(user, code));
}

/**
 * التحقق من صلاحية الوصول لموديول كامل (عادة عبر صلاحية العرض :view)
 */
export function canAccessModule(user: UserContextData | null, moduleKey: string): boolean {
  return hasPermission(user, `${moduleKey}:view`);
}
