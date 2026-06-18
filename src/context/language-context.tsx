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
    entryRemoved: 'تم إزالة السجل من قاعدة البيانات.',
    saveFailed: 'فشل الحفظ في السحاب.',
    deleteFailed: 'تعذر الحذف حالياً.',
    confirmDelete: 'هل أنت متأكد من حذف هذا السجل المرجعي؟',
    orgRef: 'الهيكل التنظيمي',
    geoRef: 'البيانات الجغرافية',
    techRef: 'المسارات الفنية',
    depts: 'الأقسام الإدارية',
    jobs: 'المسميات الوظيفية',
    govs: 'المحافظات',
    areas: 'المناطق التابعة',
    txTypes: 'أنواع المعاملات',
    subSrvs: 'الخدمات الفرعية',
    stages: 'مراحل العمل / WBS',
    addEntry: 'إضافة سجل',
    devConsole: 'لوحة المطور',
    active: 'نشط',
    suspended: 'موقوف',
    search: 'بحث...',
    newPath: 'إضافة مسار فني جديد',
    newDept: 'إضافة قسم جديد',
    newGov: 'إضافة محافظة جديدة',
    save: 'حفظ',
    cancel: 'إلغاء'
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
    entryRemoved: 'Entry removed.',
    saveFailed: 'Save failed.',
    deleteFailed: 'Deletion failed.',
    confirmDelete: 'Are you sure?',
    orgRef: 'Organization',
    geoRef: 'Geography',
    techRef: 'Technical Path',
    depts: 'Departments',
    jobs: 'Job Titles',
    govs: 'Governorates',
    areas: 'Areas',
    txTypes: 'Transaction Types',
    subSrvs: 'Sub Services',
    stages: 'Work Stages / WBS',
    addEntry: 'Add Entry',
    devConsole: 'Developer Console',
    active: 'Active',
    suspended: 'Suspended',
    search: 'Search...',
    newPath: 'Add New Path',
    newDept: 'Add New Department',
    newGov: 'Add New Governorate',
    save: 'Save',
    cancel: 'Cancel'
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
