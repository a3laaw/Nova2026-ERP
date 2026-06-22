/**
 * @fileOverview خطاف الصلاحيات المطور.
 * الجسر بين واجهة React ومحرك الصلاحيات.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, loading } = useAuthContext();
  
  const role = roleData as any;
  const isAdmin = globalUser?.role?.toLowerCase() === 'admin' || role?.code === 'ADMIN';

  /**
   * الفحص الأساسي (هل يملك الفعل؟ وما هو النطاق؟)
   */
  const check = useCallback((resourceId: string, action: Action = 'view') => {
    if (isAdmin) return { can: true, scope: 'all' as const };
    return hasResourceAccess(role, resourceId, action);
  }, [role, isAdmin]);

  /**
   * دالة التحقق للسايدبار
   */
  const canAccess = useCallback((resourceId: string) => {
    if (isAdmin) return true;
    return canViewModule(role, resourceId);
  }, [role, isAdmin]);

  return {
    isLoading: loading,
    isAdmin,
    check,
    canAccess,
    role
  };
}
