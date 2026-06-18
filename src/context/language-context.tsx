
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    dashboard: 'لوحة التحكم',
    crm: 'العملاء والفرص',
    projects: 'المشاريع والمهام',
    accounting: 'المحاسبة والمالية',
    hr: 'الموارد البشرية',
    procurement: 'المشتريات',
    inventory: 'المخازن والعهد',
    checklists: 'قواعد البيانات المرجعية',
    reports: 'التقارير التنفيذية',
    ai: 'مساعد الذكاء الاصطناعي',
    settings: 'الإعدادات',
    workspace: 'مساحة العمل',
    switchLang: 'English',
    logout: 'تسجيل الخروج',
    // Reference Data Specific
    orgRef: 'الهيكل التنظيمي',
    geoRef: 'البيانات الجغرافية',
    techRef: 'المسارات الفنية',
    depts: 'الأقسام',
    jobs: 'الوظائف',
    govs: 'المحافظات',
    areas: 'المناطق',
    srvTypes: 'أنشطة الأعمال',
    txTypes: 'أنواع المعاملات',
    subSrvs: 'الخدمات الفرعية',
    stages: 'مراحل العمل / WBS',
    addEntry: 'إضافة سجل مرجعي',
    devConsole: 'لوحة المطور'
  },
  en: {
    dashboard: 'Dashboard',
    crm: 'CRM',
    projects: 'Projects',
    accounting: 'Accounting',
    hr: 'HR',
    procurement: 'Procurement',
    inventory: 'Inventory',
    checklists: 'Reference Data',
    reports: 'Reports',
    ai: 'AI Assistant',
    settings: 'Settings',
    workspace: 'Workspace',
    switchLang: 'العربية',
    logout: 'Logout',
    // Reference Data Specific
    orgRef: 'Organizational',
    geoRef: 'Geographical',
    techRef: 'Technical Path',
    depts: 'Departments',
    jobs: 'Jobs',
    govs: 'Governorates',
    areas: 'Areas',
    srvTypes: 'Service Categories',
    txTypes: 'Transaction Types',
    subSrvs: 'Sub Services',
    stages: 'Work Stages / WBS',
    addEntry: 'Add Reference',
    devConsole: 'Developer Console'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Language;
    if (savedLang) setLangState(savedLang);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const t = (key: string) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang, t }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
