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

    // Dashboard
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

    // Projects
    'projects': 'المشاريع والمعاملات',
    'projects.title': 'المشاريع والمعاملات',
    'projects.radar': 'رادار المشاريع الجارية',
    'projects.contracting': 'قسم المقاولات',
    'projects.addNew': 'فتح معاملة جديدة',
    'projects.boqExplorer': 'مستكشف المقايسات',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد ومقايسة معتمدة',

    // Engineering & BOQ
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

    // Construction
    'construction': 'العمليات الميدانية',
    'construction.radar': 'الرادار الميداني',
    'construction.groups': 'مجموعات العمل',
    'construction.equipment': 'سجل المعدات والآليات',
    'construction.reports': 'تقارير الميدان',
    'construction.siteProgress': 'توثيق الإنجاز الميداني',

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

    // Settings
    'settings': 'إعدادات النظام',
    'settings.title': 'إعدادات النظام',
    'settings.checklists': 'الدستور التشغيلي',
    'checklists': 'الدستور التشغيلي',
    'templates': 'مكتبة القوالب',
    'rolesRef': 'مصفوفة الصلاحيات',
    'profile': 'الملف الشخصي',
    'userProfile': 'الملف الشخصي',
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
    'rolesPermissions': 'الأدوار والصلاحيات'
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

    // Dashboard
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

    // Projects
    'projects': 'Projects & Trans.',
    'projects.title': 'Projects & Transactions',
    'projects.radar': 'Active Radar',
    'projects.contracting': 'Contracting',
    'projects.addNew': 'New Trans.',
    'projects.boqExplorer': 'BOQ Explorer',
    'projects.boqNumber': 'BOQ #',
    'projects.clientName': 'Client',
    'projects.budget': 'Budget',
    'projects.status': 'Status',
    'projects.details.radar': 'Execution Radar',
    'projects.details.finance': 'Finance & Docs',
    'projects.details.locked': 'Path Locked: Contract & BOQ Required',

    // Engineering & BOQ
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

    // Construction
    'construction': 'Field Operations',
    'construction.radar': 'Field Radar',
    'construction.groups': 'Work Groups',
    'construction.equipment': 'Equipment',
    'construction.reports': 'Field Logs',
    'construction.siteProgress': 'Site Progress',

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
    'settings.checklists': 'Operational Constitution',
    'checklists': 'Constitution',
    'templates': 'Template Library',
    'rolesRef': 'Permissions Matrix',
    'profile': 'Profile',
    'userProfile': 'User Profile',
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
    'rolesPermissions': 'Roles & Matrix'
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
    // استخدام الوصول المباشر للمفاتيح المسطحة لضمان السيادة اللغوية
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
