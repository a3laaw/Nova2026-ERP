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
    // الكلمات السيادية (Core)
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع والمعاملات',
    'construction': 'العمليات الميدانية',
    'procurement': 'المشتريات والتوريد',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة والمالية',
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',
    'profile': 'الملف الشخصي',
    'details': 'تفاصيل',
    'transactions': 'المعاملات',

    // العملاء والفرص (CRM)
    'leads': 'الفرص البيعية',
    'clients': 'سجل العملاء',
    'appointments': 'المواعيد والزيارات',
    'halls': 'حجز القاعات والاجتماعات',
    'visitsDossier': 'سجل تفاعل العملاء',

    // المشاريع (Projects)
    'activeProjects': 'المشاريع الجارية',
    'boqExplorer': 'مستكشف المقايسات',
    'reports': 'التقارير الهندسية',

    // العمليات الميدانية (Field Ops)
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'equipment': 'سجل المعدات',
    'fieldLogs': 'تقارير الميدان',

    // المشتريات (Procurement)
    'suppliers': 'الموردين',
    'contracts': 'العقود',
    'aiAnalysis': 'تحليل العروض (AI)',

    // الموارد البشرية (HR)
    'staffRecords': 'شؤون الموظفين',
    'leaveRequests': 'طلبات الإجازات',
    'payrollBatches': 'مسيرات الرواتب',

    // المحاسبة (Accounting)
    'chartOfAccounts': 'دليل الحسابات',
    'receiptVouchers': 'سندات القبض',
    'paymentVouchers': 'سندات الصرف',
    'journalEntries': 'قيود اليومية',
    'financialReports': 'التقارير المالية',

    // الإعدادات (Settings)
    'usersManagement': 'إدارة المستخدمين',
    'companyIdentity': 'هوية المنشأة',
    'checklists': 'الدستور التشغيلي',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'workHours': 'مواعيد العمل',
    'userProfile': 'ملفي الشخصي',

    // رسائل النظام والقفل
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد معتمد ومقايسة ميزانية معتمدة للبدء.',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة.',
    
    // الأزرار
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
    
    // أنماط التسعير
    'itemized': 'تسعير بنود',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'pricingMode': 'نمط التسعير'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'leads': 'Leads',
    'clients': 'Clients',
    'projects': 'Projects',
    'checklists': 'Constitution',
    'templates': 'Templates',
    'rolesRef': 'Permissions',
    'profile': 'Profile',
    'details': 'Details',
    'transactions': 'Transactions'
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
