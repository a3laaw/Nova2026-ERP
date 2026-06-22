/**
 * @fileOverview محرك اتخاذ القرار الأمني السيادي.
 * يدعم التحقق من الصلاحية مع النطاق (Scope) ومعطيات السجل.
 */

import { RoleMatrix, Action, Scope } from './types';

export interface AccessResult {
  can: boolean;
  scope: Scope;
}

/**
 * التحقق من صلاحية الوصول لمورد معين وفعل محدد
 * هذا المحرك هو الذي يقرر: هل يظهر الزر؟ هل تفتح الشاشة؟
 */
export function hasResourceAccess(
  role: RoleMatrix | null,
  resourceId: string,
  action: Action = 'view'
): AccessResult {
  
  if (!resourceId) return { can: false, scope: 'none' };

  // 1. حالة الأدمن (Master Key) - يملك كل شيء دائماً
  if (role?.code?.toUpperCase() === 'ADMIN' || role?.code?.toLowerCase() === 'system_admin') {
    return { can: true, scope: 'all' };
  }

  if (!role || !role.matrix) {
    return { can: false, scope: 'none' };
  }

  // 2. البحث في مصفوفة الصلاحيات (Resource-Action Match)
  const rule = role.matrix.find(m => 
    m?.resourceId?.toLowerCase() === resourceId.toLowerCase() && 
    m.action === action
  );

  // إذا وجدنا القاعدة والنطاق ليس "None"، نسمح بالإجراء ونعيد النطاق
  if (rule && rule.scope !== 'none') {
    return { can: true, scope: rule.scope };
  }

  return { can: false, scope: 'none' };
}

/**
 * التحقق مما إذا كان المستخدم يملك صلاحية رؤية الموديول (السايدبار)
 */
export function canViewModule(role: RoleMatrix | null, resourceId: string): boolean {
  if (!resourceId) return false;
  const access = hasResourceAccess(role, resourceId, 'view');
  return access.can;
}

/**
 * التحقق من ملكية السجل (Row Level Security - RLS)
 * تستخدم هذه الدالة في الواجهة لفلترة المصفوفات: هل هذا السجل يخص قسمي؟ هل هو سجلي؟
 */
export function canPerformOnRecord(
  access: AccessResult,
  currentUser: { uid: string; departmentId?: string },
  record: { createdBy?: string; departmentId?: string }
): boolean {
  if (!access.can) return false;
  if (access.scope === 'all') return true; // المنشأة كاملة: يرى كل شيء
  
  if (access.scope === 'dept') {
    // نطاق القسم: يجب أن يتطابق قسم المستخدم مع قسم السجل
    return !!(currentUser.departmentId && record.departmentId && currentUser.departmentId === record.departmentId);
  }

  if (access.scope === 'own') {
    // خاص بالموظف: يجب أن يكون هو من أنشأ السجل
    return !!(currentUser.uid && record.createdBy && currentUser.uid === record.createdBy);
  }

  return false;
}
