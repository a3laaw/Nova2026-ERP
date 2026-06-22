/**
 * @fileOverview خطاف الصلاحيات المطور.
 * يوفر دالة check المتطورة التي تعيد (can + scope).
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { hasResourceAccess, canViewModule, canPerformOnRecord } from '@/lib/permissions/engine';
import { Action } from '@/lib/permissions/types';

export function usePermissions() {
  const { roleData, globalUser, loading } = useAuthContext();
  
  const role = roleData as any;
  const isAdmin = globalUser?.role?.toLowerCase() === 'admin' || role?.code === 'ADMIN';

  // قائمة الصلاحيات التقليدية (للتوافق مع الخدمات القديمة)
  const permissions = useMemo(() => {
    if (isAdmin) return ['*'];
    return role?.permissions || [];
  }, [isAdmin, role]);

  /**
   * الفحص الأساسي (هل يملك الفعل؟ وما هو النطاق؟)
   */
  const check = useCallback((resourceId: string, action: Action = 'view') => {
    if (isAdmin) return { can: true, scope: 'all' as const };
    return hasResourceAccess(role, resourceId, action);
  }, [role, isAdmin]);

  /**
   * الفحص المتقدم (هل يحق له تنفيذ الفعل على هذا السجل المعين؟)
   */
  const checkRecord = useCallback((resourceId: string, action: Action, record: { userId?: string, departmentId?: string }) => {
    if (isAdmin) return true;
    const access = hasResourceAccess(role, resourceId, action);
    return canPerformOnRecord(access, { uid: globalUser?.uid || '', departmentId: (globalUser as any)?.departmentId }, record);
  }, [role, isAdmin, globalUser]);

  const canAccess = useCallback((resourceId: string) => {
    if (isAdmin) return true;
    return canViewModule(role, resourceId);
  }, [role, isAdmin]);

  return {
    isLoading: loading,
    isAdmin,
    permissions,
    check,
    checkRecord,
    canAccess,
    role
  };
}
