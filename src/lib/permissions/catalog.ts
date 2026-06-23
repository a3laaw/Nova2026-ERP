/**
 * @fileOverview القاموس المركزي للموارد (Single Source of Truth).
 * هذا الملف هو "عقل" النظام؛ أي مورد يضاف هنا يظهر تلقائياً في الإعدادات وفي السايدبار.
 */

import { SystemResource, Action } from './types';

export const ACTION_LABELS: Record<Action, { ar: string; en: string }> = {
  view: { ar: 'عرض', en: 'View' },
  create: { ar: 'إضافة', en: 'Create' },
  edit: { ar: 'تعديل', en: 'Edit' },
  delete: { ar: 'حذف', en: 'Delete' },
  post: { ar: 'ترحيل', en: 'Post' },
  unpost: { ar: 'إلغاء ترحيل', en: 'Unpost' },
  approve: { ar: 'اعتماد', en: 'Approve' },
  archive: { ar: 'أرشفة', en: 'Archive' },
  transfer: { ar: 'تحويل مخزني', en: 'Transfer' },
  print: { ar: 'طباعة', en: 'Print' },
  export: { ar: 'تصدير', en: 'Export' },
  seed: { ar: 'تهيئة', en: 'Seed' },
};

export const SYSTEM_RESOURCES: SystemResource[] = [
  {
    id: 'dashboard',
    labelAr: 'لوحة التحكم',
    labelEn: 'Dashboard',
    module: 'Core',
    allowedActions: ['view', 'export']
  },
  {
    id: 'crm',
    labelAr: 'العملاء والفرص',
    labelEn: 'CRM',
    module: 'Sales',
    allowedActions: ['view', 'create', 'edit', 'delete', 'export']
  },
  {
    id: 'projects',
    labelAr: 'إدارة المشاريع',
    labelEn: 'Projects',
    module: 'Operations',
    allowedActions: ['view', 'create', 'edit', 'archive', 'print']
  },
  {
    id: 'hr',
    labelAr: 'الموارد البشرية',
    labelEn: 'HR',
    module: 'HCM',
    allowedActions: ['view', 'create', 'edit', 'delete', 'approve', 'print']
  },
  {
    id: 'accounting',
    labelAr: 'المحاسبة والمالية',
    labelEn: 'Accounting',
    module: 'Finance',
    allowedActions: ['view', 'create', 'post', 'unpost', 'export']
  },
  {
    id: 'procurement',
    labelAr: 'المشتريات والتوريد',
    labelEn: 'Procurement',
    module: 'Supply Chain',
    allowedActions: ['view', 'create', 'approve', 'export']
  },
  {
    id: 'inventory',
    labelAr: 'المخازن والعهد',
    labelEn: 'Inventory',
    module: 'Supply Chain',
    allowedActions: ['view', 'create', 'transfer', 'export']
  },
  {
    id: 'templates',
    labelAr: 'مكتبة القوالب',
    labelEn: 'Template Library',
    module: 'Operations',
    allowedActions: ['view', 'create', 'edit', 'delete']
  },
  {
    id: 'settings',
    labelAr: 'إعدادات النظام',
    labelEn: 'Settings',
    module: 'Admin',
    allowedActions: ['view', 'edit', 'seed']
  }
];
