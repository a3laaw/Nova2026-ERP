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
      { code: 'manage_subservices', label: 'إدارة الخدمات الفرعية', labelEn: 'Manage Sub-Services' },
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
      { code: 'open_transaction', label: 'فتح معاملة جديدة', labelEn: 'Open Transaction' },
    ]
  },
  {
    id: 'technical_paths',
    label: 'المسارات الفنية',
    labelEn: 'Technical Paths',
    permissions: [
      { code: 'view_stage_instances', label: 'متابعة مراحل التنفيذ', labelEn: 'View Stage Instances' },
      { code: 'start_stage', label: 'بدء تنفيذ مرحلة', labelEn: 'Start Stage' },
      { code: 'update_stage_progress', label: 'تحديث نسبة الإنجاز', labelEn: 'Update Progress' },
      { code: 'complete_stage', label: 'اعتماد إنجاز مرحلة', labelEn: 'Complete Stage' },
      { code: 'reopen_stage', label: 'إعادة فتح مرحلة مغلقة', labelEn: 'Reopen Stage' },
    ]
  },
  {
    id: 'contracts',
    label: 'العقود والاتفاقيات',
    labelEn: 'Contracts',
    permissions: [
      { code: 'create_quotation', label: 'إنشاء عرض سعر', labelEn: 'Create Quotation' },
      { code: 'approve_quotation', label: 'اعتماد عرض سعر', labelEn: 'Approve Quotation' },
      { code: 'create_contract', label: 'إنشاء مسودة عقد', labelEn: 'Create Contract' },
      { code: 'activate_contract', label: 'تفعيل العقد والبدء', labelEn: 'Activate Contract' },
    ]
  },
  {
    id: 'execution',
    label: 'المشاريع والزيارات',
    labelEn: 'Projects & Visits',
    permissions: [
      { code: 'create_project', label: 'بدء مشروع جديد', labelEn: 'Create Project' },
      { code: 'edit_project', label: 'تعديل بيانات مشروع', labelEn: 'Edit Project' },
      { code: 'create_field_visit', label: 'تسجيل زيارة ميدانية', labelEn: 'Create Field Visit' },
      { code: 'edit_field_visit', label: 'تعديل تقرير زيارة', labelEn: 'Edit Field Visit' },
    ]
  },
  {
    id: 'procurement',
    label: 'المشتريات والمخازن',
    labelEn: 'Procurement & Inventory',
    permissions: [
      { code: 'create_purchase_request', label: 'إنشاء طلب شراء', labelEn: 'Create Purchase Request' },
      { code: 'approve_purchase_request', label: 'اعتماد طلب شراء', labelEn: 'Approve Purchase Request' },
      { code: 'create_rfq', label: 'إنشاء طلب تسعير (RFQ)', labelEn: 'Create RFQ' },
      { code: 'create_purchase_order', label: 'إصدار أمر شراء (PO)', labelEn: 'Create Purchase Order' },
      { code: 'create_grn', label: 'إثبات استلام مواد (GRN)', labelEn: 'Create GRN' },
      { code: 'approve_grn', label: 'اعتماد سند الاستلام', labelEn: 'Approve GRN' },
    ]
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    labelEn: 'Human Resources',
    permissions: [
      { code: 'view_employees', label: 'عرض سجل الموظفين', labelEn: 'View Employees' },
      { code: 'create_employee', label: 'إضافة موظف', labelEn: 'Create Employee' },
      { code: 'edit_employee', label: 'تعديل بيانات موظف', labelEn: 'Edit Employee' },
      { code: 'approve_leave', label: 'اعتماد الإجازات', labelEn: 'Approve Leave' },
      { code: 'approve_permission', label: 'اعتماد الاستئذانات', labelEn: 'Approve Permission' },
      { code: 'generate_payroll', label: 'إعداد كشوف الرواتب', labelEn: 'Generate Payroll' },
      { code: 'approve_payroll', label: 'اعتماد صرف الرواتب', labelEn: 'Approve Payroll' },
    ]
  },
  {
    id: 'accounting',
    label: 'المحاسبة والمالية',
    labelEn: 'Accounting',
    permissions: [
      { code: 'view_chart_of_accounts', label: 'عرض دليل الحسابات', labelEn: 'View COA' },
      { code: 'manage_chart_of_accounts', label: 'إدارة شجرة الحسابات', labelEn: 'Manage COA' },
      { code: 'create_journal_entry', label: 'إنشاء قيد محاسبي', labelEn: 'Create Journal Entry' },
      { code: 'post_journal_entry', label: 'ترحيل القيود لدفتر الأستاذ', labelEn: 'Post Journal Entry' },
      { code: 'create_cash_receipt', label: 'إصدار سند قبض', labelEn: 'Create Cash Receipt' },
      { code: 'create_payment_voucher', label: 'إصدار سند صرف', labelEn: 'Create Payment Voucher' },
    ]
  }
];