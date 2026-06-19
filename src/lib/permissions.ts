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
  globalRole?: string; // الدور العالمي المخزن في global_users
  roleData?: RoleData | null;
}

/**
 * التحقق من امتلاك المستخدم لصلاحية معينة
 */
export function hasPermission(user: UserContextData | null, code: PermissionCode): boolean {
  if (!user) return false;
  
  // 1. صلاحيات المطور (وصول مطلق)
  if (user.isDeveloper) return true;
  
  // 2. معالجة حالة المدير العالمي (للتهيئة الأولية للنظام)
  // إذا كان المستخدم مسجلاً كـ admin في السجل العالمي، يمنح صلاحية النجمة تلقائياً
  if (user.globalRole === 'admin' || user.globalRole === 'Admin') return true;

  // 3. التحقق من مصفوفة الصلاحيات المرتبطة بالدور
  if (!user.roleData?.permissions) return false;

  const perms = user.roleData.permissions;
  
  // إذا كان يملك صلاحية النجمة في دوره (مدير محلي)
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

/**
 * دالة الإنفاذ (Enforcement): ترمي خطأ إذا لم تتوفر الصلاحية
 */
export function ensureActionPermission(permissions: string[], requiredCode: PermissionCode) {
  if (permissions.includes('*')) return true;
  if (!permissions.includes(requiredCode)) {
    throw new Error(`UNAUTHORIZED_ACTION: Missing required permission [${requiredCode}]`);
  }
  return true;
}
