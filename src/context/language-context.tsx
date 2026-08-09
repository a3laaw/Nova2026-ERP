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
 * تم توحيد المفاتيح لتكون بحروف صغيرة (lowercase) لسهولة المطابقة.
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الهيكل العام والتنقل (Navigation)
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

    // 2. إحصائيات لوحة التحكم (Dashboard Stats)
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeprojects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'نسبة الإنجاز العام',
    'dashboard.units.kwd': 'د.ك',
    'dashboard.units.yearly': 'سنوياً',
    'dashboard.units.new': 'جديد',
    'dashboard.units.present': 'حاضر',
    'dashboard.units.project': 'مشروع',
    'dashboard.units.employee': 'موظف',
    'dashboard.recent': 'العمليات الأخيرة',
    'dashboard.export': 'تصدير البيانات',
    'dashboard.missions': 'المهام المعلقة',

    // 3. إدارة العملاء (CRM & Clients)
    'clients': 'إدارة العملاء',
    'leads': 'الفرص والطلبات',
    'appointments': 'رادار المواعيد',
    'meetings': 'حجز القاعات',
    'visitsdossier': 'سجل تفاعل العملاء',
    'clients.title': 'قاعدة بيانات العملاء',
    'clients.addnew': 'تسجيل عميل جديد',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'بيانات الاتصال',
    'clients.table.status': 'حالة الملف',
    'clients.newtransaction': 'فتح معاملة جديدة',
    'clients.finance': 'كشف الحساب',

    // 4. المشاريع والمقايسات (Projects & BOQ)
    'activeprojects': 'المشاريع النشطة',
    'boqexplorer': 'جدول الكميات والميزانية',
    'projects.title': 'إدارة المشاريع الهندسية',
    'projects.addnew': 'إضافة مشروع',
    'projects.contracting': 'قسم التنفيذ',
    'projects.boqexplorer.desc': 'إدارة واعتماد جداول الكميات والميزانيات المرجعية للمشاريع',
    'projects.stats.portfolio': 'قيمة المحفظة',
    'projects.stats.claims': 'المطالبات المالية',
    'projects.stats.collection': 'نسبة التحصيل',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'الإنجاز الميداني',
    'projects.table.billing': 'المبالغ المفوترة',
    'projects.table.status': 'حالة المشروع',
    'projects.noactiveprojects': 'لا يوجد مشاريع جارية حالياً.',

    // 5. المقاولات والميدان (Construction & Field)
    'fieldradar': 'رادار العمليات الميدانية',
    'workgroups': 'فرق وأطقم العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'سجلات الإنجاز الميداني',
    'construction.radar': 'رادار الميدان الإنشائي',
    'construction.radar.desc': 'تنسيق أطقم العمل والمعدات وتتبع حركة المهندسين في المواقع',
    'construction.groups': 'تكوين أطقم العمل',
    'construction.groups.desc': 'إدارة تخصصات العمالة وتوزيع المهام الميدانية',
    'construction.equipment': 'سجل الأصول والمعدات',
    'construction.reports': 'تقارير المواقع اليومية',
    'construction.logresources': 'توثيق الإنجاز والموارد',

    // 6. الموارد البشرية والرواتب (HR & Payroll)
    'staffrecords': 'شؤون الموظفين',
    'attendance': 'بصمة الحضور والغياب',
    'payroll': 'مسيرات الرواتب',
    'leaverequests': 'إدارة الإجازات',
    'hr.title': 'الموارد البشرية والامتثال',
    'hr.description': 'إدارة شؤون الموظفين والامتثال الكامل لقانون العمل الكويتي',
    'hr.hire': 'توظيف جديد',
    'hr.staffrecords': 'سجل الموظفين الموحد',
    'hr.payrolltitle': 'كشوف الرواتب الشهرية',
    'hr.leaverequeststitle': 'طلبات الإجازات الرسمية',

    // 7. المحاسبة والمالية (Accounting)
    'chartofaccounts': 'دليل الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية والختامية',

    // 8. التقارير والرقابة (Reports Hub)
    'reports.hub.title': 'مركز التقارير والرقابة',
    'reports.hub.description': 'تحليل الأداء التشغيلي والمالي والامتثال القانوني للمنشأة',
    'reports.executive.title': 'التقرير التنفيذي الشامل',
    'reports.analytics.title': 'رادار الأداء المالي',

    // 9. الإعدادات وقواعد العمل (Settings)
    'usersmanagement': 'المستخدمين والصلاحيات',
    'companyidentity': 'هوية الشركة والبراند',
    'settings.checklists': 'الدستور التشغيلي',
    'rolespermissions': 'الأدوار والمسؤوليات',
    'workhours': 'ساعات الدوام الرسمي',
    'templates': 'مكتبة القوالب',
    'managecompanydata': 'إدارة بيانات المنشأة والسجلات الرسمية',
    'settings.checklists.desc': 'إدارة القواعد المرجعية، المسارات الفنية، والمقايسات القياسية',

    // 10. الكلمات الشائعة (Common)
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

    // 11. حالات النظام (Statuses)
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
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.units.kwd': 'KWD',
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
   * هذا يمنع ظهور "أكواد المفاتيح" في حال اختلاف حالة الأحرف في الكود البرمجي.
   */
  const t = (key: string) => {
    if (!key) return '';
    const lowerKey = key.toLowerCase();
    // البحث أولاً بالمفتاح الصغير، ثم بالمفتاح الأصلي كخيار احتياطي
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
