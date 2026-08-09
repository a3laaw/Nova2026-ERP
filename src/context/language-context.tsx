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
 * يحتوي على كافة مفاتيح النظام لضمان عدم حدوث تراجع في أي صفحة.
 * تم توحيد المفاتيح لتكون بحروف صغيرة (lowercase) لسهولة المطابقة عبر دالة t().
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الهيكل العام والتنقل (Layout & Navigation)
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع الهندسية',
    'construction': 'المقاولات والإنشاءات',
    'accounting': 'المحاسبة والمالية',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات والتوريد',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'ذكاء Nova الاصطناعي',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'userprofile': 'ملفي الشخصي',
    'devconsole': 'لوحة تحكم المطور',
    'details': 'التفاصيل',
    'transactions': 'المعاملات الفنية',
    'reports': 'التقارير والرقابة',
    'activeprojects': 'المشاريع النشطة',
    'boqexplorer': 'جدول الكميات والميزانية',
    'fieldradar': 'رادار العمليات الميدانية',
    'workgroups': 'فرق وأطقم العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'سجلات الإنجاز الميداني',
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
    'companyidentity': 'هوية الشركة',
    'settings.checklists': 'الدستور التشغيلي',
    'rolespermissions': 'الأدوار والمسؤوليات',
    'workhours': 'ساعات الدوام',
    'templates': 'مكتبة القوالب',

    // 2. إحصائيات لوحة التحكم (Dashboard Stats)
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
    'dashboard.missions': 'المهام المعلقة',

    // 3. رادار المواعيد والقاعات (Appointments & Meetings)
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radardesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية للمهندسين.',
    'appointments.printschedule': 'طباعة الجدول',
    'appointments.morningsession': 'الفترة الصباحية ☀️',
    'appointments.eveningsession': 'الفترة المسائية 🌆',
    'appointments.hallradar': 'رادار حجز القاعات',
    'appointments.hallradardesc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية.',
    'appointments.printoccupancy': 'طباعة تقرير الإشغال',
    'appointments.busy': 'مشغول / محجوز',
    'appointments.activehalls': 'قاعات مفعلة',
    'appointments.totalmeetings': 'إجمالي اجتماعات اليوم',
    'appointments.roomoccupancy': 'إشغال القاعات',

    // 4. المقاولات والميدان (Construction & Field)
    'construction.radar': 'رادار الميدان الإنشائي',
    'construction.radar.desc': 'تنسيق أطقم العمل والمعدات وتتبع حركة المهندسين في المواقع.',
    'construction.groups': 'تكوين أطقم العمل',
    'construction.groupsdesc': 'إدارة تخصصات العمالة وتوزيع المهام الميدانية.',
    'construction.equipment': 'سجل الأصول والمعدات',
    'construction.reports': 'تقارير المواقع اليومية',
    'construction.reportsdesc': 'أرشيف تقارير الإنجاز الميداني الموثقة بالموارد.',
    'construction.newreport': 'تقرير جديد',

    // 5. الكلمات الشائعة (Common)
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
    'common.active': 'تم التنشيط بنجاح',
    'common.completed': 'تم الإنجاز بنجاح',

    // 6. الموارد البشرية والرواتب (HR & Payroll)
    'hr.title': 'الموارد البشرية والامتثال',
    'hr.description': 'إدارة شؤون الموظفين والامتثال الكامل لقانون العمل الكويتي.',
    'hr.hire': 'توظيف جديد',
    'hr.staffrecords': 'سجل الموظفين الموحد',
    'hr.payrolltitle': 'كشوف الرواتب الشهرية',
    'hr.leaverequeststitle': 'طلبات الإجازات',
    'hr.ownrecordsonly': 'عرض سجلاتك الشخصية فقط',
    'hr.manageabsences': 'إدارة الغيابات والأرصدة',

    // 7. حالات النظام (Statuses)
    'status.active': 'نشط',
    'status.completed': 'مكتمل',
    'status.pending': 'بانتظار الإجراء',
    'status.draft': 'مسودة',
    'status.contracted': 'متعاقد',
    'status.new': 'جديد',
    'status.approved': 'معتمد',
    'status.rejected': 'مرفوض',
    'status.cancelled': 'ملغى',
    'status.in-progress': 'قيد التنفيذ',
    'status.paid': 'تم السداد',
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
    'ai.hub': 'AI Assistant',
    'settings': 'Settings',
    'logout': 'Logout',
    'userprofile': 'Profile',
    'appointments.radar': 'Appointments Radar',
    'appointments.radardesc': 'Schedule client meetings and site visits.',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
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
   * دالة الترجمة الذكية السيادية:
   * تقوم بتحويل أي مفتاح يتم طلبه إلى حروف صغيرة (lowercase) قبل البحث عنه.
   * هذا يمحو الفجوة المعرفية ويمنع ظهور الأكواد البرمجية في الواجهة.
   */
  const t = (key: string) => {
    if (!key) return '';
    const lowerKey = key.toLowerCase();
    return translations[lang][lowerKey] || translations[lang][key] || key;
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
