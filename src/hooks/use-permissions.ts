'use client';

import { useMemo } from 'react';
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

  const userContext = useMemo(() => ({
    isDeveloper: globalUser?.isDeveloper,
    globalRole: globalUser?.role,
    roleData: roleData
  }), [globalUser, roleData]);

  // مصفوفة الصلاحيات "الفعالة"
  // إذا كان مديراً عالمياً، نمنحه '*' لضمان عدم توقف العمليات الإدارية
  const effectivePermissions = useMemo(() => {
    if (globalUser?.isDeveloper || globalUser?.role === 'admin' || globalUser?.role === 'Admin') {
      return ['*'];
    }
    return roleData?.permissions || [];
  }, [globalUser, roleData]);

  return {
    permissions: effectivePermissions,
    isLoading: loading,
    // الدوال المساعدة
    check: (code: PermissionCode) => hasPermission(userContext, code),
    checkAny: (codes: PermissionCode[]) => hasAnyPermission(userContext, codes),
    checkAll: (codes: PermissionCode[]) => hasAllPermissions(userContext, codes),
    canAccess: (moduleKey: string) => canAccessModule(userContext, moduleKey),
    // حالات خاصة
    isAdmin: effectivePermissions.includes('*')
  };
}
