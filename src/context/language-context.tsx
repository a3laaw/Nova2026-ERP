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
 * القاموس الموحد والنهائي (Master Dictionary) - الإصدار الشامل.
 * تم دمج كافة المفاتيح لضمان عدم حدوث تراجع نصي في أي صفحة.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الهيكل والتنقل (Navigation)
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات والإنشاءات',
    'accounting': 'المحاسبة والمالية',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات والتوريد',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'ذكاء Nova الاصطناعي',
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

    // 2. الداشبورد (Dashboard)
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

    // 3. المواعيد والرادار (Appointments)
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radardesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية للمهندسين.',
    'appointments.morningsession': 'الفترة الصباحية ☀️',
    'appointments.eveningsession': 'الفترة المسائية 🌆',
    'appointments.printschedule': 'طباعة الجدول',
    'appointments.hallradar': 'رادار حجز القاعات',
    'appointments.hallradardesc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية داخل المنشأة.',
    'appointments.printoccupancy': 'طباعة تقرير الإشغال',
    'appointments.busy': 'مشغول / محجوز',
    'appointments.activehalls': 'قاعات مفعلة',

    // 4. الميدان والإنشاءات (Field)
    'construction.radar': 'رادار الميدان الإنشائي',
    'construction.radar.desc': 'تنسيق أطقم العمل والمعدات وتتبع حركة المهندسين في المواقع.',
    'construction.groups': 'تكوين أطقم العمل',
    'construction.groupsdesc': 'إدارة تخصصات العمالة وتوزيع المهام الميدانية.',
    'construction.equipment': 'سجل الأصول والمعدات',
    'construction.reports': 'تقارير المواقع اليومية',
    'construction.reportsdesc': 'أرشيف تقارير الإنجاز الميداني الموثقة بالموارد.',
    'construction.newreport': 'تقرير جديد',

    // 5. الموارد البشرية (HR)
    'hr.title': 'الموارد البشرية والامتثال',
    'hr.description': 'إدارة القوى العاملة، الرواتب، الإجازات، والامتثال لقانون العمل الكويتي.',
    'staffrecords': 'سجل الموظفين',
    'hr.hire': 'توظيف جديد',
    'hr.leaveRequestsTitle': 'طلبات الإجازات',
    'hr.manageAbsences': 'إدارة الغيابات والأرصدة القانونية.',
    'hr.ownRecordsOnly': 'عرض سجلاتك الشخصية فقط.',
    'hr.workDays': 'يوم عمل',

    // 6. المحاسبة والمالية (Accounting)
    'accounting.coa.title': 'دليل الحسابات والترميز المالي',
    'accounting.journals.title': 'دفاتر قيود اليومية',
    'accounting.journals.desc': 'تسجيل ومراجعة كافة العمليات المالية بنظام القيد المزدوج.',
    'accounting.vouchers.paymenttitle': 'سندات الصرف المعتمدة',
    'accounting.vouchers.receipttitle': 'سندات القبض المعتمدة',

    // 7. الكلمات الشائعة (Common)
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

    // 8. التقارير (Reports Hub)
    'reports.hub.title': 'مركز التقارير والرقابة',
    'reports.hub.description': 'أدوات تحليلية متقدمة لربط الميدان بالمركز المالي والإداري.',
    'reports.executive.title': 'التقرير التنفيذي الشامل',
    'reports.analytics.title': 'رادار الأداء المالي والإنتاجي',
    'reports.charts.budgetvsexpenses': 'تحليل الميزانية vs المصروفات',
    'reports.charts.portfoliobyactivity': 'توزيع المحفظة حسب النشاط',
    'reports.stats.portfolio': 'إجمالي المحفظة',
    'reports.stats.activeprojects': 'المشاريع الجارية',
    'reports.stats.staff': 'القوى العاملة',
    'reports.stats.attendance': 'انضباط الحضور',

    // 9. القالب الهندسي والمقايسات (BOQ)
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية للمشاريع.',
    'boqtemplates': 'قوالب المقايسات',
    'quotationtemplates': 'قوالب عروض الأسعار',
    'contracttemplates': 'قوالب العقود الرسمية',
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
    'ai.hub': 'AI Intelligence',
    'settings': 'Settings',
    'logout': 'Logout',
    'userprofile': 'Profile',
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
   * دالة الترجمة المحصنة (Hardened Translation):
   * تحول المفتاح إلى حروف صغيرة (lowercase) وتزيل أي مسافات زائدة لضمان الربط دائماً.
   */
  const t = (key: string) => {
    if (!key) return '';
    const cleanKey = key.trim().toLowerCase();
    
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
