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
    // --- الشاشة الرئيسية (الداشبورد) ---
    'dashboard': 'لوحة التحكم',
    'dashboard.subtitle': 'متابعة شاملة لمؤشرات الأداء والعمليات الجارية.',
    'dashboard.export': 'تصدير',
    'dashboard.stats.completion': 'نسبة الإنجاز',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.activeprojects': 'المشاريع الجارية',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.units.yr': 'سنوياً',
    'dashboard.units.present': 'حاضر',
    'dashboard.units.new': 'جديد',
    'dashboard.units.kwd': 'د.ك',
    'dashboard.recent': 'النشاطات الأخيرة',
    'dashboard.recent.quoteApproved': 'اعتماد عرض سعر',
    'dashboard.recent.attendanceLogged': 'تسجيل حضور',
    'dashboard.recent.paymentVoucher': 'سند صرف',
    'dashboard.missions': 'المهمات المتأخرة',
    
    // --- الأزرار العامة ---
    'common.viewAll': 'عرض الكل',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.add': 'إضافة',
    'common.close': 'إغلاق',
    'common.confirm': 'تأكيد',
    'common.search': 'بحث...',
    
    // --- المجموعات (السايدبار) ---
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'appointments': 'المواعيد',
    'meetings': 'الاجتماعات',
    'visitsDossier': 'سجل الزيارات',
    
    'projects': 'المشاريع',
    'activeProjects': 'المشاريع الجارية',
    'boqExplorer': 'جدول الكميات والميزانية',
    'reports': 'التقارير',
    
    'construction': 'المقاولات',
    'fieldRadar': 'رادار الميدان',
    'workGroups': 'فرق العمل',
    'equipment': 'المعدات',
    'fieldLogs': 'تقارير الموقع',
    
    'accounting': 'المحاسبة',
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',

    'hr': 'الموارد البشرية',
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    
    'settings': 'الإعدادات',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'rolesPermissions': 'الأدوار والوصول',
    'workHours': 'ساعات العمل',
    'userProfile': 'ملفي الشخصي',

    'ai.hub': 'ذكاء Nova',
    'aiAnalysis': 'تحليل الذكاء الاصطناعي',
    'projects.addNew': 'إضافة مشروع',
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.subtitle': 'Comprehensive overview of performance and operations.',
    'dashboard.export': 'Export',
    'dashboard.stats.completion': 'Completion Rate',
    'dashboard.stats.workforce': 'Workforce',
    'dashboard.stats.activeprojects': 'Active Projects',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.yr': 'Yearly',
    'dashboard.units.present': 'Present',
    'dashboard.units.new': 'New',
    'dashboard.units.kwd': 'KWD',
    'dashboard.recent': 'Recent Activity',
    'dashboard.recent.quoteApproved': 'Quote Approved',
    'dashboard.recent.attendanceLogged': 'Attendance Logged',
    'dashboard.recent.paymentVoucher': 'Payment Voucher',
    'dashboard.missions': 'Overdue Missions',
    'common.viewAll': 'View All',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.search': 'Search...',
    'crm': 'CRM',
    'leads': 'Leads',
    'clients': 'Clients',
    'appointments': 'Appointments',
    'meetings': 'Meetings',
    'visitsDossier': 'Visits Dossier',
    'projects': 'Projects',
    'activeProjects': 'Active Projects',
    'boqExplorer': 'BOQ Explorer',
    'reports': 'Reports',
    'construction': 'Construction',
    'fieldRadar': 'Field Radar',
    'workGroups': 'Work Groups',
    'equipment': 'Equipment',
    'fieldLogs': 'Field Logs',
    'accounting': 'Accounting',
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',
    'financialReports': 'Financial Reports',
    'hr': 'HR',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Leaves',
    'settings': 'Settings',
    'usersManagement': 'Users Management',
    'companyIdentity': 'Company Identity',
    'rolesPermissions': 'Roles & Permissions',
    'workHours': 'Work Hours',
    'userProfile': 'User Profile',
    'ai.hub': 'Nova AI',
    'aiAnalysis': 'AI Analysis',
    'projects.addNew': 'Add Project',
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
    const normalizedKey = key.toLowerCase();
    return translations[lang]?.[normalizedKey] || translations[lang]?.[key] || key;
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
