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

/**
 * القاموس الموحد الجديد (Clean Sheet) - المصدر الوحيد للحقيقة.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // التنقل الرئيسي (Sidebar & Nav)
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات',
    'accounting': 'المحاسبة',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'مركز الذكاء الاصطناعي',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'userprofile': 'ملفي الشخصي',

    // موديول المشاريع والمقايسات
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات والميزانية',
    'reports': 'التقارير',
    'projects.addnew': 'إضافة مشروع',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',

    // موديول المقاولات (Field)
    'fieldradar': 'رادار الميدان',
    'workgroups': 'فرق العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'تقارير الموقع',
    'construction.radar': 'رادار العمليات الميدانية',
    'construction.radar.desc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'construction.groups': 'فرق العمل والمجموعات',
    'construction.groups.desc': 'إدارة أطقم الميدان والتخصصات الفنية',

    // موديول CRM
    'leads': 'الفرص والعملاء',
    'clients': 'إدارة العملاء',
    'visitsdossier': 'سجل الزيارات',

    // موديول الموارد البشرية
    'staffrecords': 'شؤون الموظفين',
    'attendance': 'بصمة الحضور',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'reports.hub.title': 'مركز التقارير والرقابة',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',

    // موديول المحاسبة
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',

    // إحصائيات الداشبورد
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeprojects': 'المشاريع الجارية',
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

    // الكلمات الشائعة (Common)
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
    'common.total': 'الإجمالي',
    'common.noresults': 'لا توجد نتائج',
    'common.viewall': 'عرض الكل',

    // حالات العميل (CRM Table)
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'status.contracted': 'متعاقد',
    'status.new': 'جديد'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'Human Resources',
    'settings': 'Settings',
    'common.search': 'Search...',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.kwd': 'KWD',
    'reports.hub.title': 'Reports Center',
    'reports.hub.description': 'Workforce and operational productivity analysis'
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
    // بحث ذكي غير حساس لحالة الأحرف لضمان ثبات الترجمة
    const lowerKey = key.toLowerCase();
    return translations[lang]?.[lowerKey] || translations[lang]?.[key] || key;
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
