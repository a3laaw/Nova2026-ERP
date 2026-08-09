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
    'boqexplorer': 'جدول الكميات والميزانية',
    'boqexplorer.subtitle': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',
    'workgroups': 'فرق العمل',
    'workgroups.subtitle': 'إدارة أطقم الميدان والتخصصات.',
    'construction.radar': 'رادار الميدان',
    'construction.radarDesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية.',
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    
    // إحصائيات الداشبورد
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeprojects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'نسبة الإنجاز',
    
    // وحدات ومسميات
    'dashboard.units.kwd': 'د.ك',
    'dashboard.units.project': 'مشروع',
    'dashboard.units.employee': 'موظف',
    'dashboard.units.yearly': 'سنوياً',
    'dashboard.units.present': 'حاضر',
    'dashboard.units.new': 'جديد',
    
    // أزرار وإجراءات
    'projects.addnew': 'إضافة مشروع',
    'dashboard.export': 'تصدير',
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.viewall': 'عرض الكل',
    'dashboard.recent': 'النشاطات الأخيرة',
    'accounting': 'المحاسبة',
    
    // السايدبار (Sidebar)
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'appointments': 'المواعيد',
    'meetings': 'الاجتماعات',
    'visitsdossier': 'سجل الزيارات',
    'activeprojects': 'المشاريع الجارية',
    'reports': 'التقارير',
    'construction': 'المقاولات',
    'fieldradar': 'رادار الميدان',
    'workgroups_sidebar': 'فرق العمل',
    'equipment': 'المعدات',
    'fieldlogs': 'تقارير الموقع',
    'aianalysis': 'تحليل الذكاء الاصطناعي',
    'userprofile': 'ملفي الشخصي',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.subtitle': 'General statistics and project workflow tracking.',
    'projects': 'Projects',
    'boqexplorer': 'BOQ & Budget',
    'boqexplorer.subtitle': 'Manage and approve bill of quantities and baseline budgets',
    'workgroups': 'Work Groups',
    'workgroups.subtitle': 'Manage field crews and specialties.',
    'construction.radar': 'Field Radar',
    'construction.radarDesc': 'Coordinate site engineers and work crews in construction sites.',
    'reports.hub.title': 'Reports Hub',
    'reports.hub.description': 'Workforce analysis, compliance and field productivity',
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
    'projects.addnew': 'Add Project',
    'dashboard.export': 'Export',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.viewall': 'View All',
    'dashboard.recent': 'Recent Activities',
    'accounting': 'Accounting',
    'leads': 'Leads & CRM',
    'clients': 'Clients',
    'appointments': 'Appointments',
    'meetings': 'Meetings',
    'visitsdossier': 'Visits Dossier',
    'activeprojects': 'Active Projects',
    'reports': 'Reports',
    'construction': 'Construction',
    'fieldradar': 'Field Radar',
    'workgroups_sidebar': 'Work Groups',
    'equipment': 'Equipment',
    'fieldlogs': 'Field Logs',
    'aianalysis': 'AI Analysis',
    'userprofile': 'My Profile',
    'settings': 'Settings',
    'logout': 'Logout',
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
    return translations[lang]?.[lowKey] || translations[lang]?.[key] || key;
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