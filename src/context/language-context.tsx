'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  tSafe: (key: string, fallbackAr: string, fallbackEn?: string) => string;
}

/**
 * القاموس الشامل (Master Dictionary)
 * تم دمج كافة المفاتيح لضمان عدم فقدان أي ترجمة عند التحديثات المستقبلية.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الهيكل العام والتنقل
    'dashboard': 'لوحة التحكم',
    'dashboard.subtitle': 'إحصائيات عامة ومتابعة سير العمل في المشاريع.',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.export': 'تصدير',
    'dashboard.missions': 'المهام المطلوبة',
    'logout': 'تسجيل الخروج',
    'devConsole': 'لوحة المطور',
    'userProfile': 'ملفي الشخصي',
    'details': 'التفاصيل',

    // 2. الكلمات المشتركة (Common)
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
    'common.notes': 'الملاحظات',
    'common.error': 'خطأ في العملية',
    'common.saved': 'تم الحفظ بنجاح',
    'common.deleted': 'تم الحذف بنجاح',
    'common.confirmDelete': 'تأكيد الحذف',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.pending': 'قيد الانتظار',
    'common.unit': 'الوحدة',
    'common.quantity': 'الكمية',
    'common.total': 'الإجمالي',
    'common.viewAll': 'عرض الكل',
    'common.code': 'الكود',

    // 3. العملاء والفرص (CRM)
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'clients.title': 'إدارة العملاء',
    'clients.addNew': 'إضافة عميل جديد',
    'clients.table.profile': 'بيان العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات الفنية',
    'clients.details.location': 'موقع المشروع',
    'clients.details.history': 'سجل الأحداث',

    // 4. المشاريع والمقايسات (BOQ)
    'projects': 'المشاريع',
    'activeProjects': 'المشاريع الجارية',
    'projects.title': 'إدارة المشاريع',
    'projects.addNew': 'إضافة مشروع',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqExplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',
    'projects.stats.portfolio': 'إجمالي المحفظة',
    'projects.stats.claims': 'المطالبات',
    'projects.stats.collection': 'التحصيل',
    'projects.table.project': 'المشروع',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'المبالغ المفوترة',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المستندات والمالية',
    'projects.details.locked': 'المسار الفني مقفل. يرجى اعتماد العقد والمقايسة أولاً.',

    // 5. العمليات الميدانية (Construction)
    'construction': 'المقاولات',
    'construction.radar': 'رادار الميدان',
    'construction.radarDesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية.',
    'construction.groups': 'فرق العمل',
    'construction.groupsDesc': 'إدارة أطقم الميدان والتخصصات.',
    'construction.reports': 'تقارير الموقع',
    'fieldRadar': 'رادار الميدان',
    'workGroups': 'فرق العمل',
    'fieldLogs': 'تقارير الموقع',

    // 6. الموارد البشرية والرواتب (HR)
    'hr.title': 'الموارد البشرية',
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسيرات الرواتب',
    'attendance': 'بصمة الحضور',

    // 7. المحاسبة (Accounting)
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',

    // 8. الوحدات والإحصائيات (Dashboard Units)
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

    // 9. التقارير
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية.',
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.subtitle': 'General statistics and project workflow tracking.',
    'dashboard.recent': 'Recent Activities',
    'dashboard.export': 'Export',
    'logout': 'Logout',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.save': 'Save',
    'common.status': 'Status',
    'common.name': 'Name',
    'common.amount': 'Amount',
    'crm': 'CRM',
    'projects': 'Projects',
    'projects.boqExplorer': 'BOQ & Budget',
    'hr': 'Human Resources',
    'accounting': 'Accounting',
    'dashboard.units.kwd': 'KWD',
    'dashboard.units.yearly': 'Yearly',
    'dashboard.units.new': 'New',
    'dashboard.units.present': 'Present',
    'reports.hub.title': 'Reports Hub',
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

  /**
   * دالة الترجمة المحسنة: غير حساسة لحالة الأحرف (Case-insensitive)
   * تضمن العثور على المفتاح حتى لو كان هناك اختلاف بسيط في الكتابة.
   */
  const t = (key: string) => {
    if (!key) return '';
    
    const currentTranslations = translations[lang];
    
    // محاولة المطابقة المباشرة
    if (currentTranslations[key]) return currentTranslations[key];
    
    // محاولة المطابقة مع تجاهل حالة الأحرف (للإنجليزي)
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(currentTranslations).find(k => k.toLowerCase() === lowerKey);
    
    if (foundKey) return currentTranslations[foundKey];
    
    // إذا لم يوجد، ابحث في الأقسام (مثل common.save)
    return currentTranslations[key] || key;
  };

  const tSafe = (key: string, fallbackAr: string, fallbackEn?: string) => {
    const translated = t(key);
    if (translated !== key) return translated;
    return lang === 'ar' ? fallbackAr : (fallbackEn || fallbackAr);
  };

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', isRtl: lang === 'ar', setLang, t, tSafe }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
