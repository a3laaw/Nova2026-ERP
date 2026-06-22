'use client';

import { useCallback, useMemo } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, user, loading } = useAuthContext();
  
  const role = roleData as any;
  
  const isAdmin = useMemo(() => {
    return globalUser?.role?.toLowerCase() === 'admin' || 
           globalUser?.roleCode === 'ADMIN' || 
           globalUser?.isDeveloper === true;
  }, [globalUser]);

  const effectivePermissions = useMemo(() => {
    if (isAdmin) return ['*'];
    return role?.permissions || [];
  }, [isAdmin, role]);

  const check = useCallback((resourceId: string, action: Action = 'view') => {
    if (isAdmin) return { can: true, scope: 'all' as const };
    
    const access = hasResourceAccess(role, resourceId, action);
    
    return {
      ...access,
      userContext: {
        uid: user?.uid || '', // استخدام user.uid الفعلي من Firebase
        departmentId: globalUser?.departmentId || ''
      }
    };
  }, [role, isAdmin, user, globalUser]);

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
      uid: user?.uid,
      departmentId: globalUser?.departmentId
    },
    role
  };
}
