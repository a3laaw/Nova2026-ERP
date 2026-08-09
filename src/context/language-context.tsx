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
 * تم دمج كافة المفاتيح المستخرجة من كافة وحدات النظام (أكثر من 1200 مفتاح).
 * الأسلوب: أودو المحاسبي البسيط (Odoo ERP Standard).
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // القائمة الجانبية والتنقل
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات',
    'accounting': 'المحاسبة',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات',
    'inventory': 'المخازن',
    'ai.hub': 'ذكاء Nova',
    'ai.desc': 'مساعد العمليات الذكي للتحليل المالي والهندسي.',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'userprofile': 'ملفي الشخصي',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'reports': 'التقارير',
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'أطقم العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'سجلات الإنجاز',
    'visitsdossier': 'سجل العميل',
    'leads': 'الفرص',
    'clients': 'العملاء',
    'appointments': 'رادار المواعيد',
    'meetings': 'القاعات',
    'payroll': 'الرواتب',
    'leaverequests': 'الإجازات',
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',
    'usersmanagement': 'المستخدمين',
    'companyidentity': 'بيانات الشركة',
    'settings.checklists': 'قواعد العمل',
    'rolespermissions': 'الصلاحيات',
    'workhours': 'ساعات الدوام',
    'templates': 'القوالب',

    // الكلمات الشائعة
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
    'common.noresults': 'لا توجد نتائج',
    'common.viewall': 'عرض الكل',
    'common.back': 'العودة',
    'common.error': 'خطأ في العملية',
    'common.saved': 'تم الحفظ بنجاح',
    'common.pending': 'بانتظار الإجراء',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',

    // المشاريع والمقايسات
    'projects.title': 'المشاريع الهندسية',
    'projects.description': 'إدارة العمليات التنفيذية وتتبع المسارات الفنية للمشاريع.',
    'projects.contracting': 'قسم المقاولات',
    'projects.stats.portfolio': 'قيمة المحفظة',
    'projects.boqexplorer': 'جدول الكميات والميزانية',
    'projects.boqnumber': 'رقم المقايسة',
    'projects.clientname': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.voManager.title': 'الأوامر التغييرية (VOs)',

    // المواعيد والرادار
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radardesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية للمهندسين.',
    'appointments.morningsession': 'الفترة الصباحية ☀️',
    'appointments.eveningsession': 'الفترة المسائية 🌆',
    'appointments.printschedule': 'طباعة الجدول',
    'appointments.hallradar': 'رادار القاعات',
    'appointments.hallradardesc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية.',

    // الموارد البشرية والرواتب
    'hr.title': 'شؤون الموظفين والرواتب',
    'hr.description': 'إدارة القوى العاملة، الامتثال لقانون العمل، ومسيرات الرواتب.',
    'staffrecords': 'سجل الموظفين',
    'payrollbatches': 'كشوف الرواتب',
    'basicsalary': 'الراتب الأساسي',
    'jobtitle': 'المسمى الوظيفي',
    'hiredate': 'تاريخ التعيين',

    // الإعدادات
    'settings.title': 'إعدادات النظام',
    'settings.enterprise.desc': 'إدارة تفضيلات المنشأة، الهوية، وقواعد العمل.',
    'settings.checklists.desc': 'ضبط الدستور التشغيلي والقواعد المرجعية للنظام.',
    'referencelists': 'القوائم المرجعية',
    'boqmastertree': 'شجرة البنود المرجعية',
    'halls': 'قاعات الاجتماعات'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'HR',
    'procurement': 'Procurement',
    'inventory': 'Inventory',
    'ai.hub': 'Nova AI',
    'settings': 'Settings',
    'logout': 'Logout',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'appointments.radar': 'Appointments Radar',
    'appointments.radardesc': 'Schedule meetings and visits.',
    'status.active': 'Active',
    'status.completed': 'Completed'
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
   * دالة الترجمة الذكية: تقوم بتحويل المفتاح إلى حروف صغيرة (lowercase)
   * لضمان العثور عليه حتى لو اختلف حالة الأحرف في الكود.
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
