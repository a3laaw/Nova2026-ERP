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
 * القاموس السيادي الموحد والنهائي (Sovereign Master Dictionary)
 * يحتوي على كافة مفاتيح النظام لضمان الثبات المطلق.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // --- الهيكل العام والتنقل ---
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
    'procurement': 'المشتريات',
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات والميزانية',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'فرق العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'تقارير الموقع',
    'ai.hub': 'مركز الذكاء الاصطناعي',
    'aianalysis': 'تحليل الذكاء الاصطناعي',
    'staffrecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'attendance': 'بصمة الحضور',
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
    'projects.addnew': 'إضافة مشروع',

    // --- العملاء (CRM) ---
    'clients': 'العملاء',
    'leads': 'الفرص والعملاء',
    'clients.title': 'إدارة العملاء',
    'clients.addnew': 'إضافة عميل جديد',
    'clients.registernew': 'تسجيل عميل جديد',
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',

    // --- العمليات والإنتاج (Operations) ---
    'construction.radar': 'رادار الميدان',
    'construction.radardesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',
    'construction.groups': 'فرق العمل',
    'construction.groupsdesc': 'إدارة أطقم الميدان والتخصصات',
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    'construction.logresources': 'توثيق الموارد والإنجاز',

    // --- المحاسبة (Accounting) ---
    'accounting.smartrecon': 'مطابقة ذكية',
    'accounting.bankstatement': 'كشف البنك',
    'accounting.generalledger': 'الأستاذ العام',
    'accounting.aireconsummary': 'ملخص المطابقة بالذكاء الاصطناعي',

    // --- كلمات شائعة (Common) ---
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
    'common.notes': 'الملاحظات',
    'common.namear': 'الاسم بالعربي',
    'common.nameen': 'الاسم بالإنجليزي',
    'common.description': 'الوصف',
    'common.isactive': 'نشط',
    'common.code': 'الكود المرجعي',
    
    // --- حالات (Status) ---
    'status.active': 'نشط',
    'status.pending': 'قيد الانتظار',
    'status.completed': 'مكتمل',
    'status.cancelled': 'ملغي',
    'status.scheduled': 'مجدول',
    'status.new': 'جديد',
    'status.contracted': 'متعاقد',
  },
  en: {
    'dashboard': 'Dashboard',
    'logout': 'Logout',
    'devconsole': 'Dev Console',
    'settings': 'Settings',
    'reports': 'Reports',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'HR',
    'procurement': 'Procurement',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.kwd': 'KWD',
    'construction.radar': 'Field Radar',
    'reports.hub.title': 'Reports Hub',
    'status.active': 'Active',
    'status.completed': 'Completed',
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
    return translations[lang]?.[normalizedKey] || key;
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
