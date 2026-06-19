'use client';

import { useAuthContext } from '@/context/auth-context';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions, 
  canAccessModule,
  PermissionCode 
} from '@/lib/permissions';

/**
 * Hook مخصص لاستهلاك نظام الصلاحيات داخل مكونات React.
 */
export function usePermissions() {
  const { globalUser, roleData, loading } = useAuthContext();

  const userContext = {
    isDeveloper: globalUser?.isDeveloper,
    roleData: roleData
  };

  return {
    permissions: roleData?.permissions || [],
    isLoading: loading,
    // الدوال المساعدة
    check: (code: PermissionCode) => hasPermission(userContext, code),
    checkAny: (codes: PermissionCode[]) => hasAnyPermission(userContext, codes),
    checkAll: (codes: PermissionCode[]) => hasAllPermissions(userContext, codes),
    canAccess: (moduleKey: string) => canAccessModule(userContext, moduleKey),
    // حالات خاصة
    isAdmin: roleData?.permissions.includes('*') || globalUser?.isDeveloper
  };
}
