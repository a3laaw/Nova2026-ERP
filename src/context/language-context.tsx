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
    reports: 'التقارير التنفيذية',
    ai: 'مساعد الذكاء الاصطناعي',
    settings: 'الإعدادات',
    workspace: 'مساحة العمل',
    welcome: 'مرحباً بك',
    notifications: 'التنبيهات الذكية',
    logout: 'تسجيل الخروج',
    profile: 'الملف الشخصي',
    billing: 'الفواتير',
    switchLang: 'English',
    devConsole: 'لوحة تحكم المطور',
    devSubTitle: 'إدارة طلبات الانضمام ودورة حياة المنشآت.',
    exitConsole: 'خروج من اللوحة',
    activeTenants: 'المنشآت النشطة',
    activatedToday: 'تم تفعيلها اليوم',
    rejected: 'الطلبات المرفوضة',
    infrastructure: 'البنية التحتية',
    pending: 'قيد الانتظار',
    totalRequests: 'إجمالي الطلبات',
    pipelineTitle: 'خط أنابيب الطلبات الواردة',
    pipelineDesc: 'مراجعة، تفعيل أو رفض تسجيلات الشركات الجديدة.',
    org: 'المنشأة',
    contact: 'المسؤول',
    industry: 'النشاط',
    status: 'الحالة',
    decision: 'أداة القرار',
    activate: 'تفعيل',
    reject: 'رفض',
    waiting: 'انتظار',
    live: 'نشط',
    declined: 'مرفوض',
    processed: 'تمت معالجته'
  },
  en: {
    dashboard: 'Dashboard',
    crm: 'Clients & CRM',
    projects: 'Projects & WBS',
    accounting: 'Accounting',
    hr: 'Human Resources',
    procurement: 'Procurement',
    inventory: 'Inventory',
    reports: 'Executive Reports',
    ai: 'AI Assistant',
    settings: 'Settings',
    workspace: 'Workspace',
    welcome: 'Welcome back',
    notifications: 'Smart Notifications',
    logout: 'Logout',
    profile: 'Profile',
    billing: 'Billing',
    switchLang: 'العربية',
    devConsole: 'Developer Console',
    devSubTitle: 'Manage onboarding requests and tenant lifecycle.',
    exitConsole: 'Exit Console',
    activeTenants: 'Active Tenants',
    activatedToday: 'Activated Today',
    rejected: 'Rejected',
    infrastructure: 'Infrastructure',
    pending: 'Pending',
    totalRequests: 'Total Requests',
    pipelineTitle: 'Incoming Requests Pipeline',
    pipelineDesc: 'Review, Activate or Reject new company registrations.',
    org: 'Organization',
    contact: 'Contact Person',
    industry: 'Industry',
    status: 'Status',
    decision: 'Decision Tool',
    activate: 'Activate',
    reject: 'Reject',
    waiting: 'Waiting',
    live: 'Live',
    declined: 'Declined',
    processed: 'Processed'
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
