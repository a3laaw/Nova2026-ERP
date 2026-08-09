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
    // الهيكل العام
    'dashboard': 'لوحة التحكم',
    'logout': 'تسجيل الخروج',
    'devConsole': 'لوحة المطور',
    'userProfile': 'ملفي الشخصي',
    'settings': 'الإعدادات',
    'reports': 'التقارير',
    'details': 'التفاصيل',
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

    // لوحة التحكم (Stats & Dashboard)
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

    // CRM
    'clients': 'العملاء',
    'leads': 'الفرص والعملاء',
    'clients.title': 'إدارة العملاء',
    'clients.addNew': 'إضافة عميل',
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',

    // المشاريع و BOQ
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
    'projects.table.billing': 'المبالغ المفوترة',

    // الموارد البشرية
    'hr.title': 'الموارد البشرية',
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسيرات الرواتب',
    'attendance': 'بصمة الحضور',
    'hr.workforce.compliance': 'إدارة القوى العاملة والامتثال',

    // العمليات الميدانية
    'construction': 'المقاولات',
    'fieldRadar': 'رادار الميدان',
    'construction.radar': 'رادار الميدان',
    'construction.radarDesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'workGroups': 'فرق العمل',
    'construction.groups': 'فرق العمل',
    'construction.groupsDesc': 'إدارة أطقم الميدان والتخصصات',
    'fieldLogs': 'تقارير الموقع',
    'construction.reports': 'تقارير الموقع',

    // المحاسبة
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',

    // التقارير
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',

    // الإعدادات
    'companyIdentity': 'بيانات الشركة',
    'usersManagement': 'المستخدمون والصلاحيات',
    'rolesPermissions': 'الأدوار والوصول',
    'workHours': 'ساعات العمل',
    'templates': 'القوالب',
  },
  en: {
    // General
    'dashboard': 'Dashboard',
    'logout': 'Logout',
    'devConsole': 'Dev Console',
    'userProfile': 'My Profile',
    'settings': 'Settings',
    'reports': 'Reports',
    'details': 'Details',
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

    // Dashboard
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

    // CRM
    'clients': 'Clients',
    'leads': 'Leads & Clients',
    'clients.title': 'CRM Management',
    'clients.addNew': 'Add Client',
    'clients.table.profile': 'Client Profile',
    'clients.table.staff': 'Assigned To',
    'clients.table.contact': 'Contact',
    'clients.table.status': 'Status',

    // Projects & BOQ
    'projects': 'Projects',
    'activeProjects': 'Active Projects',
    'boqExplorer': 'BOQ & Budget',
    'projects.boqExplorer': 'BOQ & Budget',
    'projects.boqExplorer.desc': 'Manage bill of quantities and baseline budgets',
    'projects.addNew': 'Add Project',
    'projects.stats.portfolio': 'Total Portfolio',
    'projects.stats.claims': 'Claims',
    'projects.stats.collection': 'Collection',
    'projects.table.project': 'Project',
    'projects.table.progress': 'Progress',
    'projects.table.billing': 'Billing',

    // HR
    'hr.title': 'Human Resources',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll Batches',
    'attendance': 'Attendance',
    'hr.workforce.compliance': 'Workforce & Compliance',

    // Field Operations
    'construction': 'Construction',
    'fieldRadar': 'Field Radar',
    'construction.radar': 'Field Radar',
    'construction.radarDesc': 'Coordinate site engineers and work crews',
    'workGroups': 'Work Groups',
    'construction.groups': 'Work Groups',
    'construction.groupsDesc': 'Manage field crews and specialties',
    'fieldLogs': 'Field Logs',
    'construction.reports': 'Field Reports',

    // Accounting
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',
    'financialReports': 'Financial Reports',

    // Reports
    'reports.hub.title': 'Reports Hub',
    'reports.hub.description': 'Workforce analysis and compliance reports',

    // Settings
    'companyIdentity': 'Company Identity',
    'usersManagement': 'Users & Permissions',
    'rolesPermissions': 'Roles & Access',
    'workHours': 'Working Hours',
    'templates': 'Templates',
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
    // جعل البحث عن المفاتيح غير حساس لحالة الأحرف لضمان الاستقرار
    const normalizedKey = key.toLowerCase();
    const currentTranslations = translations[lang];
    
    // البحث عن المفتاح المطابق بغض النظر عن حالة الأحرف
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
