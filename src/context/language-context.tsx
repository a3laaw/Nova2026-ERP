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

const translations: Record<Language, Record<string, any>> = {
  ar: {
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تعديل',
      delete: 'حذف',
      search: 'بحث...',
      actions: 'إجراءات',
      loading: 'جاري التحميل...',
      details: 'تفاصيل',
      new: 'جديد',
      confirm: 'تأكيد',
      all: 'الكل',
      active: 'نشط',
      completed: 'مكتمل',
      pending: 'قيد الانتظار',
      status: 'الحالة',
      date: 'التاريخ',
      value: 'القيمة',
      filter: 'تصفية',
      summary: 'ملخص',
      viewAll: 'عرض الكل',
      close: 'إغلاق',
      post: 'ترحيل السجلات',
      saved: 'تم الحفظ بنجاح',
      deleted: 'تم الحذف بنجاح',
      error: 'خطأ في النظام',
      confirmDelete: 'هل أنت متأكد من الحذف؟',
      isActive: 'نشط',
      order: 'الترتيب',
      name: 'الاسم',
      code: 'الكود',
      description: 'الوصف'
    },
    dashboard: {
      title: 'نظرة عامة على العمليات',
      stats: {
        revenue: 'إيرادات المشاريع',
        activeProjects: 'المشاريع النشطة',
        workforce: 'القوى العاملة',
        completion: 'معدل الإنجاز'
      },
      missions: 'مهمات بانتظار الإغلاق',
      recent: 'سجل العمليات المباشر',
      export: 'تصدير التقرير'
    },
    clients: {
      title: 'قاعدة بيانات العملاء',
      addNew: 'تسجيل عميل جديد',
      form: {
        title: 'بيانات العميل',
        identity: 'الهوية والبيانات القانونية',
        location: 'الموقع والعنوان الذكي',
        assignEngineer: 'المهندس المسؤول'
      },
      table: {
        profile: 'العميل المالك',
        staff: 'المسؤول',
        contact: 'الهاتف',
        status: 'الحالة'
      },
      details: {
        title: 'تفاصيل العميل',
        transactions: 'المعاملات الفنية',
        location: 'الرادار الجغرافي',
        history: 'سجل الأحداث'
      }
    },
    projects: {
      title: 'رادار المشاريع والفوترة',
      radar: 'تتبع الإنجاز الميداني والمطالبات',
      contracting: 'المقاولات',
      addNew: 'بدء مشروع',
      stats: {
        portfolio: 'إجمالي المحفظة',
        claims: 'مطالبات نشطة',
        collection: 'نسبة التحصيل'
      },
      table: {
        project: 'المشروع / العميل',
        progress: 'الإنجاز',
        billing: 'المطالبات',
        status: 'الحالة'
      },
      details: {
        title: 'تفاصيل المشروع',
        radar: 'رادار التنفيذ',
        finance: 'المستندات المالية',
        locked: 'المسار مقفل - مطلوب ربط مالي'
      }
    },
    boq: {
      title: 'مستكشف المقايسات',
      tabs: {
        estimates: 'المقايسات',
        variations: 'الأوامر التغييرية'
      }
    },
    hr: {
      title: 'الموارد البشرية',
      payroll: 'الرواتب'
    },
    procurement: {
      title: 'المشتريات'
    },
    accounting: {
      title: 'المحاسبة'
    },
    inventory: {
      title: 'المخازن'
    },
    settings: {
      title: 'الإعدادات'
    }
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      search: 'Search...',
      actions: 'Actions',
      loading: 'Loading...',
      details: 'Details',
      new: 'New',
      confirm: 'Confirm',
      all: 'All',
      active: 'Active',
      completed: 'Completed',
      pending: 'Pending',
      status: 'Status',
      date: 'Date',
      value: 'Value',
      filter: 'Filter',
      summary: 'Summary',
      viewAll: 'View All',
      close: 'Close',
      post: 'Post Records',
      saved: 'Saved Successfully',
      deleted: 'Deleted Successfully',
      error: 'System Error',
      confirmDelete: 'Are you sure?',
      isActive: 'Active',
      order: 'Order',
      name: 'Name',
      code: 'Code',
      description: 'Description'
    },
    dashboard: {
      title: 'Operations Overview',
      stats: {
        revenue: 'Project Revenue',
        activeProjects: 'Active Projects',
        workforce: 'Workforce',
        completion: 'Completion Rate'
      },
      missions: 'Missions Awaiting Closure',
      recent: 'Live Activity',
      export: 'Export'
    },
    clients: {
      title: 'Clients Database',
      addNew: 'New Registration',
      form: {
        title: 'Client Profile',
        identity: 'Identity & Legal',
        location: 'Smart Location Radar',
        assignEngineer: 'Assigned Engineer'
      },
      table: {
        profile: 'Client Profile',
        staff: 'Assigned Staff',
        contact: 'Mobile',
        status: 'Status'
      },
      details: {
        title: 'Client Details',
        transactions: 'Technical Transactions',
        location: 'Geographic Radar',
        history: 'History Log'
      }
    },
    projects: {
      title: 'Projects & Billing Radar',
      radar: 'Field progress and Interim Payments',
      contracting: 'Contracting',
      addNew: 'New Project',
      stats: {
        portfolio: 'Total Portfolio',
        claims: 'Active Claims',
        collection: 'Collection'
      },
      table: {
        project: 'Project / Client',
        progress: 'Progress',
        billing: 'Billing',
        status: 'Status'
      },
      details: {
        title: 'Project Details',
        radar: 'Execution Radar',
        finance: 'Financial Documents',
        locked: 'Pipeline Locked - Financial Link Required'
      }
    },
    boq: {
      title: 'BOQ Explorer',
      tabs: {
        estimates: 'Estimates',
        variations: 'Variations'
      }
    }
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
    const keys = key.split('.');
    let value: any = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
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
