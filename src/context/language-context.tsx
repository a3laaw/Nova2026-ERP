'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  tSafe: (key: string, fallbackAr: string, fallbackEn?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // الأقسام الرئيسية
    'dashboard': 'لوحة التحكم',
    'dashboard.subtitle': 'إحصائيات عامة ومتابعة سير العمل في المشاريع.',
    'projects': 'المشاريع',
    'crm': 'العملاء والفرص',
    'procurement': 'المشتريات',
    'hr': 'الموارد البشرية',
    'inventory': 'المخازن والعهد',
    'accounting': 'المحاسبة والمالية',
    'ai.hub': 'ذكاء Nova',
    'settings': 'الإعدادات',

    // الكلمات المشتركة
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.confirm': 'تأكيد',
    'common.status': 'الحالة',
    'common.name': 'الاسم',
    'common.company': 'الشركة',
    'common.noresults': 'لا توجد نتائج مطابقة',
    'common.date': 'التاريخ',
    'common.amount': 'المبلغ',
    'common.unit': 'الوحدة',
    'common.quantity': 'الكمية',
    'common.total': 'الإجمالي',
    'common.viewall': 'عرض الكل',

    // CRM & Leads
    'crm.title': 'العملاء والفرص',
    'crm.description': 'إدارة الفرص البيعية وقاعدة بيانات العملاء.',
    'crm.newlead': 'إضافة فرصة',
    'crm.table.name': 'الاسم',
    'crm.table.company': 'الشركة',
    'crm.table.status': 'الحالة',

    // Projects & BOQ
    'projects.title': 'المشاريع',
    'projects.description': 'متابعة المشاريع الجارية والجدول الزمني.',
    'projects.addnew': 'إضافة مشروع',
    'projects.boqexplorer': 'جدول الكميات والميزانية',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية.',
    'boq.activate': 'تنشيط المقايسة',
    
    // HR & Payroll
    'hr.title': 'الموارد البشرية',
    'hr.description': 'إدارة القوى العاملة والامتثال لقانون العمل.',
    'staffrecords': 'شؤون الموظفين',
    'payroll': 'مسيرات الرواتب',
    'leaverequests': 'طلبات الإجازات',
    'attendance': 'بصمة الحضور',
    'hr.workforce.desc': 'إدارة طواقم العمل والميدان.',
    'workgroups': 'فرق العمل',
    'workgroups.desc': 'إدارة أطقم الميدان والتخصصات.',

    // Construction & Field
    'construction.radar': 'رادار الميدان',
    'construction.radarDesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية.',
    'fieldradar': 'رادار الميدان',
    'fieldlogs': 'تقارير الموقع',
    'equipment': 'المخازن والمعدات',

    // Financials
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',

    // Dashboard Stats & Units
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeprojects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'نسبة الإنجاز',
    'dashboard.units.kwd': 'د.ك',
    'dashboard.units.project': 'مشروع',
    'dashboard.units.employee': 'موظف',
    'dashboard.units.yearly': 'سنوياً',
    'dashboard.units.present': 'حاضر',
    'dashboard.units.new': 'جديد',
    
    // Reports
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية.',
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.subtitle': 'General statistics and workflow tracking.',
    'projects': 'Projects',
    'crm': 'CRM & Leads',
    'procurement': 'Procurement',
    'hr': 'Human Resources',
    'inventory': 'Inventory & Assets',
    'accounting': 'Accounting',
    'ai.hub': 'Nova AI',
    'settings': 'Settings',

    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.status': 'Status',
    'common.name': 'Name',
    'common.company': 'Company',
    'common.noresults': 'No results found',
    'common.date': 'Date',
    'common.amount': 'Amount',
    'common.unit': 'Unit',
    'common.quantity': 'Quantity',
    'common.total': 'Total',
    'common.viewall': 'View All',

    'crm.title': 'CRM & Leads',
    'crm.description': 'Manage sales opportunities and client database.',
    'crm.newlead': 'New Lead',
    'crm.table.name': 'Name',
    'crm.table.company': 'Company',
    'crm.table.status': 'Status',

    'projects.title': 'Projects',
    'projects.description': 'Track active projects and timelines.',
    'projects.addnew': 'Add Project',
    'projects.boqexplorer': 'BOQ & Budget',
    'projects.boqexplorer.desc': 'Manage bill of quantities and baseline budgets.',

    'hr.title': 'Human Resources',
    'hr.description': 'Workforce management and labor law compliance.',
    'staffrecords': 'Staff Records',
    'payroll': 'Payroll',
    'leaverequests': 'Leave Requests',
    'attendance': 'Attendance',
    'workgroups': 'Work Groups',
    'workgroups.desc': 'Field crew management and specialties.',

    'construction.radar': 'Field Radar',
    'construction.radarDesc': 'Coordinate site engineers and work crews in construction sites.',
    'fieldradar': 'Field Radar',
    'fieldlogs': 'Field Logs',
    'equipment': 'Equipment & Assets',

    'chartofaccounts': 'Chart of Accounts',
    'journalentries': 'Journal Entries',
    'paymentvouchers': 'Payment Vouchers',
    'receiptvouchers': 'Receipt Vouchers',
    'financialreports': 'Financial Reports',

    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.stats.activeprojects': 'Active Projects',
    'dashboard.stats.workforce': 'Workforce',
    'dashboard.stats.completion': 'Completion Rate',
    'dashboard.units.kwd': 'KWD',
    'dashboard.units.project': 'Project',
    'dashboard.units.employee': 'Employee',
    'dashboard.units.yearly': 'Yearly',
    'dashboard.units.present': 'Present',
    'dashboard.units.new': 'New',

    'reports.hub.title': 'Reports Hub',
    'reports.hub.description': 'Workforce analysis and field productivity.',
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
    const lowKey = key.toLowerCase();
    // ابحث أولاً عن المفتاح كما هو، ثم ابحث عن النسخة المصغرة (lowercase)
    return translations[lang]?.[key] || translations[lang]?.[lowKey] || key;
  };

  const tSafe = (key: string, fallbackAr: string, fallbackEn?: string) => {
    if (!key) return lang === 'ar' ? fallbackAr : (fallbackEn || fallbackAr);
    const translated = t(key);
    if (translated !== key) return translated;
    return lang === 'ar' ? fallbackAr : (fallbackEn || fallbackAr);
  };

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', isRtl: lang === 'ar', setLang, t, tSafe }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};