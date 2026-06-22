
/**
 * @fileOverview خطاف الصلاحيات المطور.
 * تم تحسينه لضمان أن الأدمن يملك صلاحية النجمة (*) دائماً لتجنب أخطاء الحفظ.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, loading } = useAuthContext();
  
  const role = roleData as any;
  
  // التحقق السيادي من هوية الأدمن أو المطور
  const isAdmin = useMemo(() => {
    return globalUser?.role?.toLowerCase() === 'admin' || 
           globalUser?.roleCode === 'ADMIN' || 
           globalUser?.isDeveloper === true;
  }, [globalUser]);

  /**
   * الصلاحيات الفعلية المستخلصة.
   * للأدمن، نعيد دائماً النجمة لضمان تجاوز فحوصات الخدمة (Service checks).
   */
  const effectivePermissions = useMemo(() => {
    if (isAdmin) return ['*'];
    return role?.permissions || [];
  }, [isAdmin, role]);

  /**
   * الفحص الأساسي مع تمرير سياق المستخدم (User Context)
   */
  const check = useCallback((resourceId: string, action: Action = 'view') => {
    if (isAdmin) return { can: true, scope: 'all' as const };
    
    const access = hasResourceAccess(role, resourceId, action);
    
    return {
      ...access,
      userContext: {
        uid: globalUser?.uid || '',
        departmentId: globalUser?.departmentId || ''
      }
    };
  }, [role, isAdmin, globalUser]);

  const canAccess = useCallback((resourceId: string) => {
    if (isAdmin) return true;
    return canViewModule(role, resourceId);
  }, [role, isAdmin]);

  return {
    isLoading: loading,
    isAdmin,
    permissions: effectivePermissions,
    check,
    canAccess,
    userContext: {
      uid: globalUser?.uid,
      departmentId: globalUser?.departmentId
    },
    role
  };
}
