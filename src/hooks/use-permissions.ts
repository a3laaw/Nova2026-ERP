'use client';

import { useCallback, useMemo } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { hasResourceAccess, canViewModule } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, user, loading } = useAuthContext();
  const { company } = useCompanyContext();
  
  const role = roleData as any;
  
  const isAdmin = useMemo(() => {
    if (loading) return false;

    // السيادة المعلوماتية:
    // 1. حالة المطور (وصول مطلق دائماً)
    const isDev = globalUser?.isDeveloper === true || user?.email === 'admin@novaflow.com';
    if (isDev) return true;

    // 2. إذا كان المالك المسجل في وثيقة الشركة
    const isOwner = company && globalUser && company.ownerUid === globalUser.uid;
    
    // 3. إذا كان يحمل كود ADMIN بشكل قطعي (Case-Insensitive)
    const isExplicitAdmin = globalUser?.roleCode?.toUpperCase() === 'ADMIN' || 
                           globalUser?.role?.toUpperCase() === 'ADMIN';

    return isOwner || isExplicitAdmin;
  }, [globalUser, company, user, loading]);

  const effectivePermissions = useMemo(() => {
    if (isAdmin) return ['*'];
    return role?.permissions || [];
  }, [isAdmin, role]);

  const check = useCallback((resourceId: string, action: Action = 'view') => {
    // تجاوز فوري للأدمن في الواجهة الأمامية لضمان عدم ظهور رسائل الخطأ
    if (isAdmin) return { can: true, scope: 'all' as const };
    
    const access = hasResourceAccess(role, resourceId, action, user?.email || '');
    
    return {
      ...access,
      userContext: {
        uid: user?.uid || '',
        departmentId: globalUser?.departmentId || ''
      }
    };
  }, [role, isAdmin, user, globalUser]);

  const canAccess = useCallback((resourceId: string) => {
    if (isAdmin) return true;
    return canViewModule(role, resourceId, user?.email || '');
  }, [role, isAdmin, user]);

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