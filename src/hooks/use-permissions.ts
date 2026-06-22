/**
 * @fileOverview خطاف الصلاحيات للاستهلاك في واجهات React.
 * تم تحسينه ليعيد مصفوفة الصلاحيات (string[]) للتوافق مع الخدمات.
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

  // استخراج الصلاحيات النصية (للتوافق مع دالة ensureActionPermission)
  const permissions = useMemo(() => {
    if (isAdmin) return ['*'];
    return role?.permissions || [];
  }, [isAdmin, role]);

  const check = useCallback((resourceId: string, action: Action = 'view') => {
    // الأدمن يملك كل شيء
    if (isAdmin) return { can: true, scope: 'all' as any };
    return hasResourceAccess(role, resourceId, action);
  }, [role, isAdmin]);

  const canAccess = useCallback((resourceId: string) => {
    if (isAdmin) return true;
    return canViewModule(role, resourceId);
  }, [role, isAdmin]);

  return {
    isLoading: loading,
    isAdmin,
    permissions,
    check,
    canAccess,
    role
  };
}
