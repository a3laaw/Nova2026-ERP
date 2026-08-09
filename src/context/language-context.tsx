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

// القاموس الشامل والنهائي (Sovereign Master Dictionary)
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // --- التنقل والهيكل العام ---
    'dashboard': 'لوحة التحكم',
    'logout': 'تسجيل الخروج',
    'devconsole': 'لوحة المطور',
    'userprofile': 'ملفي الشخصي',
    'settings': 'الإعدادات',
    'reports': 'التقارير',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات',
    'accounting': 'المحاسبة',
    'inventory': 'المخازن والعهد',
    'hr': 'الموارد البشرية',
    
    // --- لوحة التحكم (Dashboard) ---
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
    'dashboard.missions': 'المهام المطلوبة',

    // --- المشاريع والمقايسات (BOQ) ---
    'projects.boqexplorer': 'جدول الكميات والميزانية',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',
    'projects.addnew': 'إضافة مشروع',
    'projects.stats.portfolio': 'إجمالي المحفظة',
    'projects.stats.claims': 'المطالبات',
    'projects.stats.collection': 'التحصيل',
    'projects.table.project': 'المشروع',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'المفوتر',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المستندات والمالية',

    // --- الميدان (Construction) ---
    'construction.radar': 'رادار الميدان',
    'construction.radardesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'construction.groups': 'فرق العمل',
    'construction.groupsdesc': 'إدارة أطقم الميدان والتخصصات',
    'construction.reports': 'تقارير الموقع',
    'construction.equipment': 'المعدات والآليات',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'فرق العمل',
    'fieldlogs': 'تقارير الموقع',

    // --- التقارير (Reports) ---
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    'reports.executive.title': 'التقرير التنفيذي',
    'reports.analytics.title': 'التحليلات الذكية',

    // --- العملاء (CRM) ---
    'clients': 'العملاء',
    'leads': 'الفرص والعملاء',
    'clients.title': 'إدارة العملاء',
    'clients.addnew': 'إضافة عميل جديد',
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',

    // --- شؤون الموظفين (HR) ---
    'staffrecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'attendance': 'بصمة الحضور',
    'payrollbatches': 'مسيرات الرواتب',

    // --- المحاسبة (Accounting) ---
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',

    // --- الإعدادات (Settings) ---
    'companyidentity': 'بيانات الشركة',
    'usersmanagement': 'المستخدمون والصلاحيات',
    'rolespermissions': 'الأدوار والوصول',
    'workhours': 'ساعات العمل',
    'templates': 'القوالب',
    'settings.checklists': 'قواعد العمل',
    'settings.checklists.desc': 'إدارة القواعد المرجعية والمسارات الفنية',
    'boqmastertree': 'شجرة BOQ الموحدة',
    'halls': 'القاعات',

    // --- Common ---
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
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'خطأ في العملية',
    'common.noresults': 'لا توجد نتائج'
  },
  en: {
    'dashboard': 'Dashboard',
    'logout': 'Logout',
    'devconsole': 'Dev Console',
    'userprofile': 'My Profile',
    'settings': 'Settings',
    'reports': 'Reports',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'HR',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.kwd': 'KWD',
    'projects.boqexplorer': 'BOQ & Budget',
    'construction.radar': 'Field Radar',
    'construction.groups': 'Work Groups',
    'reports.hub.title': 'Reports Hub'
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

  // دالة ترجمة ذكية غير حساسة لحالة الأحرف (Case-insensitive)
  const t = (key: string) => {
    if (!key) return '';
    const normalizedKey = key.toLowerCase();
    const currentTranslations = translations[lang];
    
    // البحث عن المفتاح في القاموس المسطح
    return currentTranslations[normalizedKey] || key;
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
