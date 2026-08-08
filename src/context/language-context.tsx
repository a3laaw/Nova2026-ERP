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
    // الكلمات السيادية (Sovereign Core)
    'checklists': 'الدستور التشغيلي',
    'templates': 'مكتبة القوالب',
    'rolesRef': 'مصفوفة الصلاحيات',
    'profile': 'الملف الشخصي',
    'details': 'تفاصيل',
    'transactions': 'المعاملات',

    // تفاصيل المشروع والقفول (Project Details & Locks)
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد معتمد ومقايسة ميزانية معتمدة للبدء.',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة.',
    
    // الأزرار والعمليات (Common Actions)
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.search': 'بحث...',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.pending': 'قيد الانتظار',
    'common.error': 'خطأ في النظام',
    'common.saved': 'تم الحفظ بنجاح',
    'common.confirm': 'تأكيد وحفظ',
    'common.close': 'إغلاق',
    'common.order': 'الترتيب',
    'common.code': 'الكود',
    'common.unit': 'الوحدة',
    'common.quantity': 'الكمية',
    'common.all': 'الكل',

    // الوحدات الإدارية (Dashboard & Modules)
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع والمعاملات',
    'construction': 'العمليات الميدانية',
    'procurement': 'المشتريات والتوريد',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة والمالية',
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',

    // التبويبات الفنية (UI Tabs)
    'active': 'النشاط',
    'timeline': 'الزمني',
    'chat_archive': 'الأرشيف',
    'time_archive': 'الوقت',

    // أنماط التسعير (Pricing Modes)
    'itemized': 'تسعير بنود',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'pricingMode': 'نمط التسعير'
  },
  en: {
    'checklists': 'Constitution',
    'templates': 'Templates',
    'rolesRef': 'Permissions',
    'profile': 'Profile',
    'details': 'Details',
    'transactions': 'Transactions',
    'projects.details.radar': 'Execution Radar',
    'projects.details.finance': 'Finance & Docs',
    'projects.details.locked': 'Path Locked: Contract & BOQ Required',
    'projects.boqExplorer.noBoqs': 'No BOQs found for this transaction.',
    'common.save': 'Save',
    'common.cancel': 'Cancel'
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
