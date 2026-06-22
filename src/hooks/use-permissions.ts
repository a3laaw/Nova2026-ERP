/**
 * @fileOverview خطاف الصلاحيات للاستهلاك في واجهات React.
 */

'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, loading } = useAuthContext();
  
  // تحويل roleData للنوع المتوقع للمحرك
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
