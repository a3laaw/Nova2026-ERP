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
 * القاموس الموحد والنهائي (Master Dictionary) - تم بناؤه من الصفر.
 * يحتوي على كافة مفاتيح النظام لضمان عدم حدوث تراجع في أي صفحة.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. التنقل الرئيسي (Sidebar & Navigation)
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
    'devconsole': 'لوحة تحكم المطور',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',

    // 2. إدارة العملاء (CRM)
    'clients': 'إدارة العملاء',
    'leads': 'الفرص والعملاء',
    'visitsdossier': 'سجل الزيارات',
    'clients.title': 'إدارة العملاء والملفات',
    'clients.addnew': 'تسجيل عميل جديد',
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول المباشر',
    'clients.table.contact': 'بيانات الاتصال',
    'clients.table.status': 'حالة الملف',
    'clients.newtransaction': 'فتح معاملة فنية',
    'clients.finance': 'السجل المالي',

    // 3. المشاريع والمقايسات (Projects & BOQ)
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات والميزانية',
    'reports': 'التقارير',
    'projects.title': 'المشاريع الهندسية',
    'projects.addnew': 'إضافة مشروع',
    'projects.contracting': 'قسم المقاولات',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية',
    'projects.stats.portfolio': 'إجمالي المحفظة',
    'projects.stats.claims': 'المطالبات الجارية',
    'projects.stats.collection': 'نسبة التحصيل',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'نسبة الإنجاز',
    'projects.table.billing': 'المبالغ المفوترة',
    'projects.table.status': 'حالة المشروع',
    'projects.noactiveprojects': 'لا يوجد مشاريع جارية حالياً.',

    // 4. المقاولات والميدان (Field Operations)
    'fieldradar': 'رادار الميدان',
    'workgroups': 'فرق العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'تقارير الموقع',
    'construction.radar': 'رادار العمليات الميدانية',
    'construction.radar.desc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'construction.groups': 'فرق العمل والمجموعات',
    'construction.groups.desc': 'إدارة أطقم الميدان والتخصصات الفنية',
    'construction.equipment': 'سجل المعدات والأصول',
    'construction.reports': 'تقارير الإنجاز الميداني',
    'construction.logresources': 'توثيق الموارد والإنجاز',

    // 5. الموارد البشرية (HR & Payroll)
    'staffrecords': 'شؤون الموظفين',
    'attendance': 'بصمة الحضور',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'hr.title': 'الموارد البشرية والامتثال',
    'hr.description': 'إدارة القوى العاملة والامتثال لقانون العمل الكويتي',
    'hr.hire': 'تعيين موظف جديد',
    'hr.staffrecords': 'سجل الموظفين الموحد',
    'hr.payrolltitle': 'مسيرات الرواتب',
    'hr.leaverequeststitle': 'طلبات الإجازات',

    // 6. المحاسبة والمالية (Accounting)
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',

    // 7. التقارير والرقابة (Reports Hub)
    'reports.hub.title': 'مركز التقارير والرقابة',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    'reports.executive.title': 'التقرير التنفيذي الشامل',
    'reports.analytics.title': 'رادار الأداء المالي',

    // 8. إحصائيات الداشبورد (Dashboard Stats)
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

    // 9. الكلمات الشائعة (Common)
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
    'common.noresults': 'لا توجد نتائج مطابقة',
    'common.viewall': 'عرض الكل',
    'common.back': 'العودة',
    'common.error': 'خطأ في العملية',
    'common.saved': 'تم الحفظ بنجاح',

    // 10. حالات النظام (Status)
    'status.active': 'نشط',
    'status.completed': 'مكتمل',
    'status.pending': 'قيد الانتظار',
    'status.draft': 'مسودة',
    'status.contracted': 'متعاقد',
    'status.new': 'جديد',
    'status.approved': 'معتمد',
    'status.rejected': 'مرفوض',
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'Human Resources',
    'procurement': 'Procurement',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'common.search': 'Search...',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.kwd': 'KWD'
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
   * دالة الترجمة الذكية: تقوم بتحويل المفتاح لحروف صغيرة لضمان المطابقة
   * ومنع ظهور الأكواد البرمجية في حال اختلاف حالة الأحرف في الكود.
   */
  const t = (key: string) => {
    if (!key) return '';
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
