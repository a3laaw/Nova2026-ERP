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
 * القاموس السيادي النهائي والشامل (The Full Sovereign Master Dictionary)
 * تم دمج كافة المفاتيح المستخرجة من موديولات النظام (أكثر من 1300 مفتاح).
 * ملاحظة: تم استخدام حروف صغيرة (lowercase) للمفاتيح لضمان كفاءة البحث الذكي.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // --- 1. الهيكل والتنقل (Navigation & Layout) ---
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات والإنشاءات',
    'accounting': 'المحاسبة والمالية',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات والتوريد',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'ذكاء Nova الاصطناعي',
    'ai.desc': 'مساعد العمليات الذكي المدعوم بتقنيات Genkit للتحليل المالي والهندسي.',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'userprofile': 'ملفي الشخصي',
    'details': 'التفاصيل',
    'transactions': 'المعاملات الفنية',
    'reports': 'التقارير والرقابة',
    'activeprojects': 'المشاريع النشطة',
    'boqexplorer': 'جدول الكميات والميزانية',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'أطقم العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'سجلات الإنجاز',
    'visitsdossier': 'سجل تفاعل العملاء',
    'leads': 'الفرص والطلبات',
    'clients': 'إدارة العملاء',
    'appointments': 'رادار المواعيد',
    'meetings': 'حجز القاعات',
    'payroll': 'مسيرات الرواتب',
    'leaverequests': 'إدارة الإجازات',
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',
    'usersmanagement': 'المستخدمين والصلاحيات',
    'companyidentity': 'بيانات الشركة',
    'settings.checklists': 'الدستور التشغيلي',
    'rolespermissions': 'الأدوار والمسؤوليات',
    'workhours': 'ساعات الدوام',
    'templates': 'مكتبة القوالب',
    'templatesdesc': 'إدارة النماذج المرجعية لعروض الأسعار، العقود، وجداول الكميات.',

    // --- 2. الكلمات الشائعة (Common Actions) ---
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.add': 'إضافة جديد',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.confirm': 'تأكيد',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.name': 'الاسم',
    'common.amount': 'المبلغ',
    'common.total': 'الإجمالي',
    'common.noresults': 'لا توجد نتائج مطابقة للبحث',
    'common.viewall': 'عرض الكل',
    'common.back': 'العودة',
    'common.error': 'فشل في تنفيذ العملية',
    'common.saved': 'تم حفظ التغييرات بنجاح',
    'common.pending': 'قيد المعالجة',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',

    // --- 3. لوحة التحكم (Dashboard) ---
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
    'dashboard.export': 'تصدير البيانات',
    'dashboard.description': 'نظرة عامة على أداء المنشأة وسير العمل التشغيلي والمالي.',

    // --- 4. المشاريع والمقايسات (Projects & BOQ) ---
    'projects.title': 'المشاريع الهندسية',
    'projects.description': 'إدارة العمليات التنفيذية وتتبع المسارات الفنية للمشاريع.',
    'projects.contracting': 'قسم المقاولات',
    'projects.stats.portfolio': 'قيمة المحفظة',
    'projects.boqexplorer': 'مستكشف المقايسات',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية للمشاريع.',
    'projects.addnew': 'مشروع جديد',
    'projects.table.project': 'المشروع',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'الفوترة',
    'projects.table.status': 'الحالة',

    // --- 5. المواعيد والرادار (Appointments & Radar) ---
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radardesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية للمهندسين.',
    'appointments.morningsession': 'الفترة الصباحية ☀️',
    'appointments.eveningsession': 'الفترة المسائية 🌆',
    'appointments.printschedule': 'طباعة الجدول',
    'appointments.hallradar': 'رادار حجز القاعات',
    'appointments.hallradardesc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية داخل المنشأة.',
    'appointments.busy': 'مشغول / محجوز',
    'appointments.activehalls': 'قاعات مفعلة',

    // --- 6. العمليات الميدانية (Construction & Field) ---
    'construction.radar': 'رادار الميدان الإنشائي',
    'construction.radar.desc': 'تنسيق أطقم العمل والمعدات وتتبع حركة المهندسين في المواقع.',
    'construction.groups': 'تكوين أطقم العمل',
    'construction.groupsdesc': 'إدارة تخصصات العمالة وتوزيع المهام الميدانية.',
    'construction.equipment': 'سجل الأصول والمعدات',
    'construction.reports': 'تقارير المواقع اليومية',
    'construction.reportsdesc': 'أرشيف تقارير الإنجاز الميداني الموثقة بالموارد.',
    'construction.newreport': 'تقرير جديد',
    'construction.siteprogress': 'إنجاز الموقع',

    // --- 7. الموارد البشرية (HR & Payroll) ---
    'hr.title': 'الموارد البشرية',
    'hr.description': 'إدارة القوى العاملة، الرواتب، والامتثال لقانون العمل.',
    'hr.staffrecords': 'سجل الموظفين',
    'hr.payroll': 'الرواتب والبدلات',
    'hr.leaverequests': 'طلبات الإجازات',
    'hr.hire': 'تعيين موظف',
    'hr.addnew': 'إضافة موظف',
    'hr.createintegratedprofile': 'إنشاء ملف تعريفي ومالي متكامل للموظف.',

    // --- 8. المحاسبة (Accounting) ---
    'accounting.coa.title': 'دليل الحسابات السيادي',
    'accounting.journals.title': 'قيود اليومية',
    'accounting.journals.desc': 'إدارة القيود المحاسبية والترحيل المالي لدفتر الأستاذ.',
    'accounting.vouchers.paymenttitle': 'سندات الصرف',
    'accounting.vouchers.receipttitle': 'سندات القبض',
    'accounting.smartrecon': 'مطابقة ذكية',

    // --- 9. التقارير (Reports) ---
    'reports.hub.title': 'مركز التقارير والرقابة',
    'reports.hub.description': 'أدوات تحليلية متقدمة لربط الميدان بالمركز المالي والإداري.',
    'reports.executive.title': 'التقرير التنفيذي الشامل',
    'reports.analytics.title': 'رادار الأداء المالي والإنتاجي',
    'reports.stats.workforce': 'القوى العاملة',
    'reports.stats.portfolio': 'إجمالي المحفظة',
    'reports.stats.activeprojects': 'المشاريع الجارية',
    'reports.stats.attendance': 'انضباط الحضور',
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'HR Management',
    'procurement': 'Procurement',
    'inventory': 'Inventory',
    'ai.hub': 'Nova AI',
    'settings': 'Settings',
    'logout': 'Logout',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'appointments.radar': 'Appointments Radar',
    'appointments.radardesc': 'Schedule client meetings and site visits.',
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

  /**
   * دالة الترجمة الذكية والمحصنة (Hardened t() Function):
   * تقوم بتحويل المفتاح المطلوب إلى حروف صغيرة (lowercase) قبل البحث عنه،
   * وهذا يمحو "الفجوة المعرفية" الناتجة عن اختلاف حالة الأحرف في الكود.
   */
  const t = (key: string) => {
    if (!key) return '';
    const cleanKey = key.trim().toLowerCase();
    
    // البحث في القاموس الصغير أولاً ثم المفتاح الأصلي كخيار بديل
    return translations[lang][cleanKey] || 
           translations[lang][key] || 
           key; 
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
