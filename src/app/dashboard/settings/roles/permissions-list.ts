import { PermissionGroup } from "@/types/roles";

export const AVAILABLE_PERMISSIONS: PermissionGroup[] = [
  {
    id: 'reference',
    label: 'المرجعيات والقواعد',
    labelEn: 'Reference & Config',
    permissions: [
      { code: 'manage_reference_data', label: 'إدارة الدستور المرجعي', labelEn: 'Manage Reference Constitution' },
      { code: 'manage_activity_types', label: 'إدارة أنشطة الأعمال', labelEn: 'Manage Activity Types' },
      { code: 'manage_services', label: 'إدارة الخدمات', labelEn: 'Manage Services' },
      { code: 'manage_technical_stages', label: 'هندسة المراحل الفنية', labelEn: 'Manage Tech Stages' },
    ]
  },
  {
    id: 'crm',
    label: 'العملاء والمعاملات',
    labelEn: 'CRM & Leads',
    permissions: [
      { code: 'view_clients', label: 'عرض العملاء', labelEn: 'View Clients' },
      { code: 'create_client', label: 'إضافة عميل جديد', labelEn: 'Create Client' },
      { code: 'edit_client', label: 'تعديل بيانات عميل', labelEn: 'Edit Client' },
      { code: 'delete_client', label: 'حذف عميل', labelEn: 'Delete Client' },
    ]
  },
  {
    id: 'execution',
    label: 'تنفيذ المشاريع',
    labelEn: 'Project Execution',
    permissions: [
      { code: 'create_project', label: 'بدء مشروع جديد', labelEn: 'Create Project' },
      { code: 'view_stage_instances', label: 'متابعة مراحل التنفيذ', labelEn: 'View Stages' },
      { code: 'complete_stage', label: 'اعتماد إنجاز مرحلة', labelEn: 'Complete Stage' },
      { code: 'create_field_visit', label: 'تسجيل زيارة ميدانية', labelEn: 'Field Visit' },
    ]
  },
  {
    id: 'accounting',
    label: 'المحاسبة والمالية',
    labelEn: 'Accounting',
    permissions: [
      { code: 'view_chart_of_accounts', label: 'عرض دليل الحسابات', labelEn: 'View COA' },
      { code: 'create_journal_entry', label: 'إنشاء قيد محاسبي', labelEn: 'Create Journal Entry' },
      { code: 'post_journal_entry', label: 'ترحيل القيود', labelEn: 'Post Journal Entry' },
      { code: 'create_cash_receipt', label: 'إصدار سند قبض', labelEn: 'Cash Receipt' },
    ]
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    labelEn: 'Human Resources',
    permissions: [
      { code: 'view_employees', label: 'عرض سجل الموظفين', labelEn: 'View Employees' },
      { code: 'create_employee', label: 'إضافة موظف', labelEn: 'Create Employee' },
      { code: 'approve_leave', label: 'اعتماد الإجازات', labelEn: 'Approve Leaves' },
      { code: 'generate_payroll', label: 'إعداد الرواتب', labelEn: 'Generate Payroll' },
    ]
  }
];
