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
    // --- الهيكل العام والتنقل ---
    'dashboard': 'لوحة التحكم',
    'logout': 'تسجيل الخروج',
    'devConsole': 'لوحة المطور',
    'userProfile': 'ملفي الشخصي',
    'settings': 'الإعدادات',
    'reports': 'التقارير',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.confirm': 'تأكيد',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.name': 'الاسم',
    'common.amount': 'المبلغ',
    'common.unit': 'الوحدة',
    'common.quantity': 'الكمية',
    'common.total': 'الإجمالي',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.viewAll': 'عرض الكل',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'خطأ في العملية',
    'common.noResults': 'لا توجد نتائج',

    // --- لوحة التحكم (Dashboard) ---
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'نسبة الإنجاز',
    'dashboard.units.kwd': 'د.ك',
    'dashboard.units.yearly': 'سنوياً',
    'dashboard.units.new': 'جديد',
    'dashboard.units.present': 'حاضر',
    'dashboard.units.project': 'مشروع',
    'dashboard.units.employee': 'موظف',
    'dashboard.recent': 'العمليات الأخيرة',
    'dashboard.export': 'تصدير',
    'dashboard.missions': 'المهام المطلوبة',

    // --- إدارة العملاء والـ CRM ---
    'clients': 'العملاء',
    'leads': 'الفرص والعملاء',
    'clients.title': 'إدارة العملاء',
    'clients.addNew': 'إضافة عميل جديد',
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات الجارية',
    'clients.details.location': 'الموقع والعنوان',
    'clients.details.history': 'سجل التفاعل',

    // --- المشاريع والمقايسات (BOQ) ---
    'projects': 'المشاريع',
    'activeProjects': 'المشاريع الجارية',
    'boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqExplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',
    'projects.addNew': 'إضافة مشروع',
    'projects.stats.portfolio': 'إجمالي المحفظة',
    'projects.stats.claims': 'المطالبات',
    'projects.stats.collection': 'التحصيل',
    'projects.table.project': 'المشروع',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'المفوتر',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المستندات والمالية',

    // --- العمليات الميدانية (Construction) ---
    'construction': 'المقاولات',
    'fieldRadar': 'رادار الميدان',
    'construction.radar': 'رادار الميدان',
    'construction.radarDesc': 'إدارة وتنسيق أطقم العمل والمهندسين في المواقع الإنشائية',
    'workGroups': 'فرق العمل',
    'construction.groups': 'فرق العمل',
    'construction.groupsDesc': 'إدارة أطقم الميدان والتخصصات',
    'fieldLogs': 'تقارير الموقع',
    'construction.reports': 'تقارير الموقع',
    'equipment': 'المعدات',
    'construction.equipment': 'المعدات والآليات',

    // --- الموارد البشرية (HR) ---
    'hr.title': 'الموارد البشرية',
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسيرات الرواتب',
    'attendance': 'بصمة الحضور',
    'hr.workforce.compliance': 'إدارة القوى العاملة والامتثال',

    // --- المحاسبة (Accounting) ---
    'accounting': 'المحاسبة',
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',

    // --- التقارير (Reports) ---
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    'reports.executive.title': 'التقرير التنفيذي',
    'reports.analytics.title': 'التحليلات الذكية',

    // --- الإعدادات (Settings) ---
    'companyIdentity': 'بيانات الشركة',
    'usersManagement': 'المستخدمون والصلاحيات',
    'rolesPermissions': 'الأدوار والوصول',
    'workHours': 'ساعات العمل',
    'templates': 'القوالب',
    'settings.checklists': 'قواعد العمل',
    'settings.checklists.desc': 'إدارة القواعد المرجعية والمسارات الفنية',
    'boqMasterTree': 'شجرة BOQ الموحدة',
    'halls': 'القاعات',
  },
  en: {
    // --- Structure & Nav ---
    'dashboard': 'Dashboard',
    'logout': 'Logout',
    'devConsole': 'Dev Console',
    'userProfile': 'My Profile',
    'settings': 'Settings',
    'reports': 'Reports',
    'details': 'Details',
    'transactions': 'Transactions',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.name': 'Name',
    'common.amount': 'Amount',
    'common.unit': 'Unit',
    'common.quantity': 'Quantity',
    'common.total': 'Total',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.viewAll': 'View All',
    'common.saved': 'Saved Successfully',
    'common.error': 'Operation Error',
    'common.noResults': 'No results found',

    // --- Dashboard ---
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.stats.activeProjects': 'Active Projects',
    'dashboard.stats.workforce': 'Workforce',
    'dashboard.stats.completion': 'Completion Rate',
    'dashboard.units.kwd': 'KWD',
    'dashboard.units.yearly': 'Yearly',
    'dashboard.units.new': 'New',
    'dashboard.units.present': 'Present',
    'dashboard.units.project': 'Project',
    'dashboard.units.employee': 'Employee',
    'dashboard.recent': 'Recent Activities',
    'dashboard.export': 'Export',
    'dashboard.missions': 'Pending Tasks',

    // --- CRM ---
    'clients': 'Clients',
    'leads': 'Leads & Clients',
    'clients.title': 'Client Management',
    'clients.addNew': 'Add New Client',
    'clients.table.profile': 'Client Profile',
    'clients.table.staff': 'Assigned To',
    'clients.table.contact': 'Contact',
    'clients.table.status': 'Status',
    'clients.details.transactions': 'Active Transactions',
    'clients.details.location': 'Location & Address',
    'clients.details.history': 'Interaction History',

    // --- Projects & BOQ ---
    'projects': 'Projects',
    'activeProjects': 'Active Projects',
    'boqExplorer': 'BOQ & Budget',
    'projects.boqExplorer': 'BOQ & Budget',
    'projects.boqExplorer.desc': 'Manage bill of quantities and baseline budgets',
    'projects.addNew': 'New Project',
    'projects.stats.portfolio': 'Total Portfolio',
    'projects.stats.claims': 'Claims',
    'projects.stats.collection': 'Collection',
    'projects.table.project': 'Project',
    'projects.table.progress': 'Progress',
    'projects.table.billing': 'Billed',
    'projects.details.radar': 'Execution Radar',
    'projects.details.finance': 'Docs & Finance',

    // --- Construction ---
    'construction': 'Construction',
    'fieldRadar': 'Field Radar',
    'construction.radar': 'Field Radar',
    'construction.radarDesc': 'Coordinate site engineers and work crews in construction project sites',
    'workGroups': 'Work Groups',
    'construction.groups': 'Work Groups',
    'construction.groupsDesc': 'Manage field crew and specialties',
    'fieldLogs': 'Field Logs',
    'construction.reports': 'Field Reports',
    'equipment': 'Equipment',
    'construction.equipment': 'Equipment Master',

    // --- HR ---
    'hr.title': 'Human Resources',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll Batches',
    'attendance': 'Attendance',
    'hr.workforce.compliance': 'Workforce & Compliance',

    // --- Accounting ---
    'accounting': 'Accounting',
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',
    'financialReports': 'Financial Reports',

    // --- Reports ---
    'reports.hub.title': 'Reports Hub',
    'reports.hub.description': 'Workforce analysis and compliance reports',
    'reports.executive.title': 'Executive Report',
    'reports.analytics.title': 'Smart Analytics',

    // --- Settings ---
    'companyIdentity': 'Company Identity',
    'usersManagement': 'Users & Permissions',
    'rolesPermissions': 'Roles & Access',
    'workHours': 'Working Hours',
    'templates': 'Templates',
    'settings.checklists': 'Rules & Refs',
    'settings.checklists.desc': 'Manage reference lists and technical paths',
    'boqMasterTree': 'BOQ Master Tree',
    'halls': 'Meeting Rooms',
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
    if (!key) return '';
    // جعل البحث غير حساس لحالة الأحرف لضمان ثبات القاموس مهما تغير الكود
    const normalizedKey = key.toLowerCase();
    const currentTranslations = translations[lang];
    
    // محاولة العثور على المفتاح بغض النظر عن حالة الأحرف
    const foundKey = Object.keys(currentTranslations).find(k => k.toLowerCase() === normalizedKey);
    
    return foundKey ? currentTranslations[foundKey] : key;
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
