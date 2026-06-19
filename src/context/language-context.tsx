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
    checklists: 'القوائم المرجعية',
    reports: 'التقارير التنفيذية',
    ai: 'مساعد الذكاء الاصطناعي',
    settings: 'الإعدادات',
    workspace: 'مساحة العمل',
    switchLang: 'English',
    logout: 'تسجيل الخروج',
    profile: 'الملف الشخصي',
    billing: 'الفواتير والاشتراكات',
    saved: 'تم الحفظ',
    error: 'خطأ',
    deleted: 'تم الحذف',
    entryAdded: 'تمت إضافة السجل بنجاح.',
    saveFailed: 'فشل الحفظ في السحاب.',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    active: 'نشط',
    completed: 'مكتمل',
    suspended: 'موقوف',
    'on-hold': 'قيد الانتظار',
    search: 'بحث...',
    newProject: 'مشروع جديد',
    startProject: 'بدء المشروع',
    name: 'الاسم',
    budget: 'الميزانية التقديرية',
    status: 'الحالة التشغيلية',
    project: 'المشروع',
    govs: 'المحافظة',
    value: 'القيمة',
    summary: 'الملخص'
  },
  en: {
    dashboard: 'Dashboard',
    crm: 'CRM',
    projects: 'Projects',
    accounting: 'Accounting',
    hr: 'HR',
    procurement: 'Procurement',
    inventory: 'Inventory',
    checklists: 'Reference Hub',
    reports: 'Reports',
    ai: 'AI Assistant',
    settings: 'Settings',
    workspace: 'Workspace',
    switchLang: 'العربية',
    logout: 'Logout',
    profile: 'Profile',
    billing: 'Billing',
    saved: 'Saved',
    error: 'Error',
    deleted: 'Deleted',
    entryAdded: 'Entry added successfully.',
    saveFailed: 'Save failed.',
    confirmDelete: 'Are you sure?',
    active: 'Active',
    completed: 'Completed',
    suspended: 'Suspended',
    'on-hold': 'On Hold',
    search: 'Search...',
    newProject: 'New Project',
    startProject: 'Start Project',
    name: 'Name',
    budget: 'Estimated Budget',
    status: 'Operational Status',
    project: 'Project',
    govs: 'Governorate',
    value: 'Value',
    summary: 'Summary'
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

  const t = (key: string) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang, t }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen">
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
