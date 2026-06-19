/**
 * @fileOverview تعريف هيكل المصفوفة للصلاحيات.
 * يتم تقسيم الصلاحيات إلى وحدات (Modules) وإجراءات (Actions).
 */

export interface PermissionModule {
  id: string;
  label: string;
  labelEn: string;
  actions: {
    view: string;
    create: string;
    edit: string;
    delete: string;
    advanced: string;
  };
}

export const MATRIX_MODULES = [
  {
    id: 'dashboard',
    label: 'لوحة المعلومات',
    labelEn: 'Dashboard',
    actions: {
      view: 'dashboard:view',
      create: '', // غير متاح للوحة المعلومات
      edit: '',
      delete: '',
      advanced: 'dashboard:export'
    }
  },
  {
    id: 'projects',
    label: 'إدارة المشاريع',
    labelEn: 'Projects',
    actions: {
      view: 'projects:view',
      create: 'projects:create',
      edit: 'projects:edit',
      delete: 'projects:delete',
      advanced: 'projects:archive'
    }
  },
  {
    id: 'crm',
    label: 'إدارة العملاء (CRM)',
    labelEn: 'CRM',
    actions: {
      view: 'crm:view',
      create: 'crm:create',
      edit: 'crm:edit',
      delete: 'crm:delete',
      advanced: 'crm:export'
    }
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    labelEn: 'Human Resources',
    actions: {
      view: 'hr:view',
      create: 'hr:create',
      edit: 'hr:edit',
      delete: 'hr:delete',
      advanced: 'hr:payroll'
    }
  },
  {
    id: 'accounting',
    label: 'المحاسبة والمالية',
    labelEn: 'Accounting',
    actions: {
      view: 'accounting:view',
      create: 'accounting:create',
      edit: 'accounting:edit',
      delete: 'accounting:delete',
      advanced: 'accounting:close_period'
    }
  },
  {
    id: 'inventory',
    label: 'المخزون والعهد',
    labelEn: 'Inventory',
    actions: {
      view: 'inventory:view',
      create: 'inventory:create',
      edit: 'inventory:edit',
      delete: 'inventory:delete',
      advanced: 'inventory:audit'
    }
  },
  {
    id: 'reference',
    label: 'تعريف المراحل والمرجعيات',
    labelEn: 'Ref & Stages',
    actions: {
      view: 'ref:view',
      create: 'ref:create',
      edit: 'ref:edit',
      delete: 'ref:delete',
      advanced: 'ref:seed'
    }
  }
];
