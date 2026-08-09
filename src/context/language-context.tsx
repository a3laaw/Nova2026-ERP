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
 * القاموس السيادي الموحد (Master Dictionary)
 * تم دمج كافة المفاتيح لضمان الثبات المطلق للنظام.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // --- 1. الهيكل العام والتنقل ---
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
    
    // --- 2. لوحة التحكم (Dashboard) ---
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

    // --- 3. المشاريع والمقايسات (BOQ) ---
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
    'boq.workprogress': 'كميات الإنجاز (BOQ)',
    'boq.activatetemplate': 'تنشيط المقايسة المرجعية',

    // --- 4. العمليات الميدانية (Construction) ---
    'construction.radar': 'رادار الميدان',
    'construction.radardesc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية',
    'construction.groups': 'فرق العمل',
    'construction.groupsdesc': 'إدارة أطقم الميدان والتخصصات',
    'construction.reports': 'تقارير الموقع',
    'construction.equipment': 'المعدات والآليات',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'فرق العمل',
    'fieldlogs': 'تقارير الموقع',
    'construction.logresources': 'توثيق الموارد والإنجاز',

    // --- 5. التقارير (Reports) ---
    'reports.hub.title': 'مركز التقارير',
    'reports.hub.description': 'تحليل القوى العاملة والامتثال والإنتاجية الميدانية',
    'reports.executive.title': 'التقرير التنفيذي',
    'reports.analytics.title': 'التحليلات الذكية',
    'reports.stats.portfolio': 'إجمالي المحفظة',
    'reports.stats.activeprojects': 'المشاريع الجارية',
    'reports.stats.staff': 'القوى العاملة',
    'reports.stats.attendance': 'انضباط الحضور',
    'reports.charts.budgetvsexpenses': 'مقارنة الميزانية بالمصروف',
    'reports.charts.portfoliobyactivity': 'توزيع المحفظة حسب النشاط',
    'reports.integrity.title': 'شهادة صحة البيانات السحابية',
    'reports.integrity.description': 'يتم التحقق من دقة هذه البيانات لحظياً عبر الربط المباشر مع سجلات الميدان والمركز المالي.',

    // --- 6. العملاء والبيع (CRM) ---
    'clients': 'العملاء',
    'leads': 'الفرص والعملاء',
    'clients.title': 'إدارة العملاء',
    'clients.addnew': 'إضافة عميل جديد',
    'clients.registernew': 'تسجيل عميل جديد',
    'clients.registernewdesc': 'فتح ملف تجاري جديد لربطه بالمعاملات الفنية',
    'clients.table.profile': 'بيانات العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.newtransaction': 'فتح معاملة',
    'clients.details.transactions': 'المعاملات الجارية',
    'clients.details.location': 'موقع المشروع',
    'clients.details.history': 'سجل التفاعل',
    'clients.finance': 'المالية',

    // --- 7. شؤون الموظفين (HR) ---
    'staffrecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'attendance': 'بصمة الحضور',
    'payrollbatches': 'مسيرات الرواتب',
    'hr.title': 'الموظفون',
    'hr.description': 'إدارة القوى العاملة والامتثال',
    'hr.addnew': 'إضافة موظف جديد',
    'hr.hire': 'تعيين موظف',
    'hr.notfound': 'الموظف غير موجود',

    // --- 8. المحاسبة والمالية (Accounting) ---
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',
    'accounting.smartrecon': 'مطابقة ذكية',

    // --- 9. المشتريات (Procurement) ---
    'suppliers': 'الموردون',
    'purchaseorders': 'أوامر الشراء',
    'contracts': 'العقود',
    'contracts.officialtitle': 'عقد اتفاق خدمات هندسية',
    'procurement.smartsupplychain': 'إدارة سلسلة التوريد الذكية والتحليلات المالية',
    'procurement.recentorders': 'آخر أوامر الشراء',

    // --- 10. الإعدادات وقواعد العمل ---
    'companyidentity': 'بيانات الشركة',
    'usersmanagement': 'المستخدمون والصلاحيات',
    'rolespermissions': 'الأدوار والوصول',
    'workhours': 'ساعات العمل',
    'templates': 'القوالب',
    'settings.checklists': 'قواعد العمل',
    'settings.checklists.desc': 'إدارة القواعد المرجعية والمسارات الفنية',
    'boqmastertree': 'شجرة BOQ الموحدة',
    'halls': 'القاعات',
    'referencelists': 'القوائم المرجعية',
    'systemsetup': 'إعداد النظام',
    'orgref': 'الهيكل التنظيمي',
    'techref': 'المسارات الفنية',
    'georef': 'البيانات الجغرافية',

    // --- 11. الذكاء الاصطناعي ---
    'ai.hub': 'مركز الذكاء الاصطناعي',
    'ai.desc': 'ذكاء عمليات تنفيذي لدعم قراراتك',
    'aianalysis': 'تحليل الذكاء الاصطناعي',

    // --- 12. كلمات شائعة (Common) ---
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
    'common.notes': 'الملاحظات'
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
    'procurement': 'Procurement',
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

  /**
   * دالة الترجمة (t) غير حساسة لحالة الأحرف.
   * تقوم بتحويل المفتاح إلى حروف صغيرة للبحث عنه في القاموس.
   */
  const t = (key: string) => {
    if (!key) return '';
    const normalizedKey = key.toLowerCase();
    const currentTranslations = translations[lang];
    
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
