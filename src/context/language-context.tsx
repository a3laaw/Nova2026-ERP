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
 * القاموس السيادي الموحد (The Master Dictionary)
 * يحتوي على 100% من مفاتيح النظام المستخرجة لضمان عدم حدوث تراجع.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // --- Navigation & Core ---
    'dashboard': 'لوحة التحكم',
    'logout': 'تسجيل الخروج',
    'devconsole': 'لوحة المطور',
    'userprofile': 'ملفي الشخصي',
    'settings': 'الإعدادات',
    'reports': 'التقارير',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات',
    'accounting': 'المحاسبة',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'مركز الذكاء الاصطناعي',
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات والميزانية',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'فرق العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'تقارير الموقع',
    'attendance': 'بصمة الحضور',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'payrollbatches': 'مسيرات الرواتب',
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',
    'visitsdossier': 'سجل الزيارات',
    'appointments': 'المواعيد',
    'meetings': 'الاجتماعات',
    'usersmanagement': 'المستخدمون والصلاحيات',
    'companyidentity': 'بيانات الشركة',
    'rolespermissions': 'الأدوار والوصول',
    'workhours': 'ساعات العمل',
    'templates': 'القوالب',
    'settings.checklists': 'قواعد العمل',

    // --- Dashboard Specific ---
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
    'projects.addnew': 'إضافة مشروع',

    // --- Descriptions ---
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    'construction.radar.desc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'construction.groups.desc': 'إدارة أطقم الميدان والتخصصات',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',

    // --- Common Items ---
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
    'common.noresults': 'لا توجد نتائج',
    'common.viewall': 'عرض الكل',
    'common.back': 'العودة',

    // --- CRM Table Headers ---
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'leads.title': 'الفرص والعملاء',
    'clients.title': 'إدارة العملاء',

    // --- Statuses ---
    'status.active': 'نشط',
    'status.pending': 'قيد الانتظار',
    'status.completed': 'مكتمل',
    'status.cancelled': 'ملغي',
    'status.new': 'جديد',
    'status.contracted': 'متعاقد',
  },
  en: {
    'dashboard': 'Dashboard',
    'logout': 'Logout',
    'settings': 'Settings',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'common.search': 'Search...',
    'common.save': 'Save',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.kwd': 'KWD',
    'reports.hub.title': 'Reports Center',
    'reports.hub.description': 'Workforce and operational productivity analysis',
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
    // البحث بطريقة غير حساسة لحالة الأحرف لمنع الفجوة المعرفية
    const normalizedKey = key.toLowerCase();
    return translations[lang]?.[normalizedKey] || translations[lang]?.[key] || key;
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
