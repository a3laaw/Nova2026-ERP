/**
 * @fileOverview خطاف الصلاحيات المطور.
 * يقوم بتغذية المحرك ببيانات المستخدم الحالي (القسم والـ ID).
 */

'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, loading } = useAuthContext();
  
  const role = roleData as any;
  const isAdmin = globalUser?.role?.toLowerCase() === 'admin' || role?.code === 'ADMIN';

  /**
   * الفحص الأساسي مع تمرير سياق المستخدم (User Context)
   */
  const check = useCallback((resourceId: string, action: Action = 'view') => {
    if (isAdmin) return { can: true, scope: 'all' as const };
    
    const access = hasResourceAccess(role, resourceId, action);
    
    // إرجاع الصلاحية مع تزويد الواجهة ببيانات الموظف للفلترة
    return {
      ...access,
      userContext: {
        uid: globalUser?.uid || '',
        departmentId: globalUser?.departmentId || '' // القسم القادم من المراجع
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
    check,
    canAccess,
    userContext: {
      uid: globalUser?.uid,
      departmentId: globalUser?.departmentId
    },
    role
  };
}
