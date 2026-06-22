/**
 * @fileOverview خطاف الصلاحيات الموحد لاستهلاك المحرك في واجهة المستخدم.
 */

'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action, Scope } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, loading } = useAuthContext();

  // تحويل roleData إلى النوع المتوقع للمحرك
  const role = roleData as any;

  const check = useCallback((resourceId: string, action: Action = 'view') => {
    return hasResourceAccess(role, resourceId, action);
  }, [role]);

  const canAccess = useCallback((resourceId: string) => {
    return canViewModule(role, resourceId);
  }, [role]);

  return {
    isLoading: loading,
    isAdmin: globalUser?.role === 'admin' || role?.code === 'ADMIN',
    check,
    canAccess,
    role
  };
}
