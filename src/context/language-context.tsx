'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Common
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.search': 'بحث...',
    'common.actions': 'إجراءات',
    'common.loading': 'جاري التحميل...',
    'common.details': 'تفاصيل',
    'common.new': 'إضافة جديد',
    'common.confirm': 'تأكيد',
    'common.all': 'الكل',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.pending': 'قيد الانتظار',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.value': 'القيمة',
    'common.filter': 'تصفية',
    'common.summary': 'ملخص',
    'common.viewAll': 'عرض الكل',
    'common.close': 'إغلاق',
    'common.saved': 'تم الحفظ بنجاح',
    'common.deleted': 'تم الحذف بنجاح',
    'common.error': 'خطأ في النظام',
    'common.confirmDelete': 'هل أنت متأكد من الحذف؟',
    'common.isActive': 'نشط',
    'common.order': 'الترتيب',
    'common.name': 'الاسم',
    'common.code': 'الكود',
    'common.description': 'الوصف',
    'common.logout': 'تسجيل الخروج',
    'common.addLabel': 'إضافة بند',
    'common.quantity': 'الكمية',
    'common.unit': 'الوحدة',
    'common.notes': 'ملاحظات',
    'common.photos': 'الصور',
    'common.labor': 'العمالة',
    'common.equipment': 'المعدات',
    'common.saveReport': 'حفظ التقرير الميداني',
    'common.loadFromGroup': 'تحميل طاقم عمل',

    // Dashboard
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم المركزية',
    'dashboard.export': 'تصدير البيانات',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع النشطة',
    'dashboard.stats.workforce': 'إجمالي الموظفين',
    'dashboard.stats.completion': 'نسبة الإنجاز السنوية',
    'dashboard.missions': 'المهام المتأخرة',
    'dashboard.recent': 'آخر النشاطات التشغيلية',

    // CRM
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والمبيعات',
    'clients': 'قاعدة بيانات العملاء',
    'clients.title': 'قاعدة بيانات العملاء',
    'clients.addNew': 'تسجيل عميل جديد',
    'clients.table.profile': 'العميل / الملف',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'رقم الهاتف',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات الجارية',
    'clients.details.location': 'الموقع الجغرافي',
    'clients.details.history': 'سجل الحركات',

    // Projects & BOQ
    'projects': 'المشاريع والمعاملات',
    'projects.title': 'المشاريع والمعاملات',
    'projects.radar': 'رادار المشاريع الجارية',
    'projects.contracting': 'قسم المقاولات',
    'projects.addNew': 'فتح معاملة جديدة',
    'projects.boqExplorer': 'مستكشف المقايسات',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة.',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'نسبة الإنجاز',
    'projects.table.billing': 'المطالبات المالية',
    'projects.table.status': 'الحالة التشغيلية',
    
    // تفاصيل المشروع الموحدة
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد ومقايسة معتمدة للبدء.',

    // Engineering & BOQ Master
    'boqExplorer': 'مستكشف المقايسات',
    'boqTemplates': 'قوالب المقايسات (BOQ)',
    'itemized': 'تسعير بنود',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'pricingMode': 'نمط التسعير',
    'totalQuoteValue': 'إجمالي قيمة العقد النهائية',
    'defaultTerms': 'الشروط والأحكام العامة',
    'contractSigning': 'توقيع العقد',
    'at': 'عند',
    'before': 'قبل',
    'during': 'أثناء',
    'after': 'بعد',
    'totalAmount': 'القيمة الإجمالية',
    'milestoneTiming': 'توقيت الاستحقاق',
    'technicalLink': 'الارتباط الفني',
    'amount': 'المبلغ',
    'introText': 'النص التعريفي',
    'legalText': 'البنود القانونية',

    // Construction
    'construction': 'العمليات الميدانية',
    'construction.radar': 'الرادار الميداني',
    'construction.groups': 'مجموعات العمل',
    'construction.equipment': 'سجل المعدات والآليات',
    'construction.reports': 'تقارير الميدان',
    'construction.siteProgress': 'توثيق الإنجاز الميداني',
    'construction.context': 'سياق العمل',

    // Procurement
    'procurement': 'المشتريات والتوريد',
    'suppliers': 'سجل الموردين المعتمدين',
    'contracts': 'العقود الرسمية',
    'contractTemplates': 'نماذج العقود',
    'quotationTemplates': 'نماذج عروض الأسعار',

    // HR
    'hr': 'الموارد البشرية',
    'staffRecords': 'سجل الموظفين',
    'leaveRequests': 'طلبات الإجازات',
    'payrollBatches': 'مسيرات الرواتب',
    'indemnity': 'نهاية الخدمة',
    'attendanceLogs': 'البصمة والحضور',
    'permissions': 'الاستئذانات',
    'payroll': 'الرواتب والأجور',

    // Accounting
    'accounting': 'المحاسبة والمالية',
    'accounting.title': 'تحليل التدفق المالي',
    'chartOfAccounts': 'دليل الحسابات السيادي',
    'receiptVouchers': 'سندات القبض',
    'paymentVouchers': 'سندات الصرف',
    'journalEntries': 'قيود اليومية',
    'financialReports': 'التقارير المالية المجمعة',

    // Inventory
    'inventory': 'المخازن والعهد',
    'warehouses': 'إدارة المستودعات',

    // Reports
    'reports': 'التقارير والرقابة',

    // Settings (Flat Keys Protection)
    'settings': 'إعدادات النظام',
    'settings.title': 'إعدادات النظام',
    'checklists': 'الدستور التشغيلي',
    'templates': 'مكتبة القوالب',
    'rolesRef': 'مصفوفة الصلاحيات',
    'profile': 'الملف الشخصي',
    'companyIdentity': 'هوية الشركة',
    'usersManagement': 'إدارة المستخدمين',
    'workHours': 'مواعيد العمل',
    'systemSetup': 'تأسيس النظام',
    'manageCompanyData': 'إدارة بيانات المنشأة والهوية البصرية',
    'templatesDesc': 'نماذج العقود، عروض الأسعار، وجداول الكميات المرجعية.',
    'workHoursDesc': 'ضبط فترات الدوام، العطلات الرسمية، وقواعد البصمة.',
    'referenceLists': 'القوائم المرجعية',
    'boqMasterTree': 'شجرة الأعمال المرجعية',
    'halls': 'إدارة القاعات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'companyProfile': 'ملف تعريف المنشأة',
    'personalInfo': 'البيانات الشخصية',
    'saveChanges': 'حفظ التغييرات',
    'username': 'اسم المستخدم',
    'referenceLists': 'القوائم المرجعية',
    'boqMasterTree': 'شجرة الأعمال المرجعية',
    'halls': 'إدارة القاعات',
    
    // Breadcrumb Special
    'details': 'تفاصيل',
    'transactions': 'المعاملات'
  },
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.search': 'Search...',
    'common.actions': 'Actions',
    'common.loading': 'Loading...',
    'common.details': 'Details',
    'common.new': 'New',
    'common.confirm': 'Confirm',
    'common.all': 'All',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.pending': 'Pending',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.value': 'Value',
    'common.filter': 'Filter',
    'common.summary': 'Summary',
    'common.viewAll': 'View All',
    'common.close': 'Close',
    'common.saved': 'Saved Successfully',
    'common.deleted': 'Deleted Successfully',
    'common.error': 'System Error',
    'common.confirmDelete': 'Are you sure?',
    'common.isActive': 'Active',
    'common.order': 'Order',
    'common.name': 'Name',
    'common.code': 'Code',
    'common.description': 'Description',
    'common.logout': 'Logout',
    'common.addLabel': 'Add Item',
    'common.quantity': 'Quantity',
    'common.unit': 'Unit',
    'common.notes': 'Notes',
    'common.photos': 'Photos',
    'common.labor': 'Labor',
    'common.equipment': 'Equipment',
    'common.saveReport': 'Save Field Report',
    'common.loadFromGroup': 'Load Work Group',

    // Dashboard
    'dashboard': 'Dashboard',
    'dashboard.title': 'Central Dashboard',
    'dashboard.export': 'Export Data',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.stats.activeProjects': 'Active Projects',
    'dashboard.stats.workforce': 'Total Staff',
    'dashboard.stats.completion': 'Annual Progress',
    'dashboard.missions': 'Overdue Missions',
    'dashboard.recent': 'Operational Activity',

    // CRM
    'crm': 'CRM & Sales',
    'leads': 'Leads',
    'clients': 'Client Database',
    'clients.title': 'Client Database',
    'clients.addNew': 'Register Client',
    'clients.table.profile': 'Client / File',
    'clients.table.staff': 'Assigned Engineer',
    'clients.table.contact': 'Phone Number',
    'clients.table.status': 'Status',
    'clients.details.transactions': 'Active Transactions',
    'clients.details.location': 'GPS Location',
    'clients.details.history': 'Audit History',

    // Projects
    'projects': 'Projects & Trans.',
    'projects.title': 'Projects & Transactions',
    'projects.radar': 'Active Radar',
    'projects.contracting': 'Contracting',
    'projects.addNew': 'New Trans.',
    'projects.boqExplorer': 'BOQ Explorer',
    'projects.boqExplorer.noBoqs': 'No BOQs registered for this transaction yet.',
    'projects.boqNumber': 'BOQ #',
    'projects.clientName': 'Client',
    'projects.budget': 'Budget',
    'projects.status': 'Status',
    'projects.table.project': 'Project / Client',
    'projects.table.progress': 'Progress %',
    'projects.table.billing': 'Billing / IPC',
    'projects.table.status': 'Status',
    'projects.details.radar': 'Execution Radar',
    'projects.details.finance': 'Finance & Docs',
    'projects.details.locked': 'Path Locked: Contract & BOQ Required',

    // Engineering & BOQ Master
    'boqExplorer': 'BOQ Explorer',
    'boqTemplates': 'BOQ Templates',
    'itemized': 'Itemized',
    'fixed': 'Lumpsum',
    'percentage': 'Percentage',
    'pricingMode': 'Pricing Mode',
    'totalQuoteValue': 'Total Contract Value',
    'defaultTerms': 'General Terms',
    'contractSigning': 'Signing',
    'at': 'At',
    'before': 'Before',
    'during': 'During',
    'after': 'After',
    'totalAmount': 'Total Amount',
    'milestoneTiming': 'Timing',
    'technicalLink': 'Technical Link',
    'amount': 'Amount',
    'introText': 'Intro Text',
    'legalText': 'Legal Text',

    // Construction
    'construction': 'Field Operations',
    'construction.radar': 'Field Radar',
    'construction.groups': 'Work Groups',
    'construction.equipment': 'Equipment',
    'construction.reports': 'Field Logs',
    'construction.siteProgress': 'Site Progress',
    'construction.context': 'Work Context',

    // Procurement
    'procurement': 'Procurement',
    'suppliers': 'Suppliers',
    'contracts': 'Contracts',
    'contractTemplates': 'Contract Templates',
    'quotationTemplates': 'Quote Templates',

    // HR
    'hr': 'Human Resources',
    'staffRecords': 'Staff Records',
    'leaveRequests': 'Leave Requests',
    'payrollBatches': 'Payroll Batches',
    'indemnity': 'Gratuity',
    'attendanceLogs': 'Attendance',
    'permissions': 'Permissions',
    'payroll': 'Payroll',

    // Accounting
    'accounting': 'Accounting',
    'accounting.title': 'Cashflow Analysis',
    'chartOfAccounts': 'Chart of Accounts',
    'receiptVouchers': 'Receipts',
    'paymentVouchers': 'Payments',
    'journalEntries': 'Journal Entries',
    'financialReports': 'Financial Reports',

    // Inventory
    'inventory': 'Inventory & Assets',
    'warehouses': 'Warehouses',

    // Reports
    'reports': 'Control Reports',

    // Settings
    'settings': 'Settings',
    'settings.title': 'System Settings',
    'checklists': 'Constitution',
    'templates': 'Template Library',
    'rolesRef': 'Permissions Matrix',
    'profile': 'Profile',
    'companyIdentity': 'Company Profile',
    'usersManagement': 'User Mgmt',
    'workHours': 'Work Hours',
    'systemSetup': 'System Setup',
    'manageCompanyData': 'Manage Profile & Branding',
    'templatesDesc': 'Contracts, Quotes, and BOQ templates.',
    'workHoursDesc': 'Shifts, holidays, and attendance rules.',
    'referenceLists': 'Reference Lists',
    'boqMasterTree': 'Work Items Registry',
    'halls': 'Meetings Halls',
    'orgRef': 'Org Structure',
    'techRef': 'Tech Paths',
    'geoRef': 'Geo Data',
    'rolesPermissions': 'Roles & Matrix',
    'companyProfile': 'Enterprise Profile',
    'personalInfo': 'Personal Information',
    'saveChanges': 'Save Changes',
    'username': 'Username',
    'referenceLists': 'Reference Lists',
    'boqMasterTree': 'Work Items Registry',
    'halls': 'Meetings Halls',
    
    // Breadcrumb Special
    'details': 'Details',
    'transactions': 'Transactions'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Language || 'ar';
    setLang(savedLang);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const t = (key: string) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', isRtl: lang === 'ar', setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
