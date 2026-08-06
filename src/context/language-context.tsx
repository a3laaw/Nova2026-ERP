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
      dashboard: 'لوحة التحكم',
      crm: 'العملاء والفرص',
      projects: 'المشاريع',
      construction: 'المقاولات الميدانية',
      procurement: 'المشتريات والتوريد',
      hr: 'الموارد البشرية',
      accounting: 'المحاسبة',
      inventory: 'المخازن',
      settings: 'الإعدادات',
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
      description: 'الوصف',
      switchLang: 'English',
      logout: 'تسجيل الخروج'
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
      table: {
        profile: 'العميل المالك',
        staff: 'المسؤول',
        contact: 'الهاتف',
        status: 'الحالة'
      }
    },
    projects: {
      title: 'رادار المشاريع والفوترة',
      radar: 'تتبع الإنجاز الميداني والمطالبات',
      contracting: 'المقاولات',
      addNew: 'بدء مشروع',
      boqExplorer: 'مستكشف المقايسات',
      table: {
        project: 'المشروع / العميل',
        progress: 'الإنجاز',
        billing: 'المطالبات',
        status: 'الحالة'
      },
      details: {
        radar: 'رادار التنفيذ',
        finance: 'المستندات المالية',
        locked: 'المسار مقفل - مطلوب ربط مالي'
      }
    },
    construction: {
      radar: 'رادار العمليات الميدانية',
      groups: 'مجموعات العمل',
      equipment: 'سجل المعدات والآليات',
      reports: 'زيارات المواقع المنفذة'
    },
    hr: {
      title: 'شؤون الموظفين والامتثال',
      staff: 'سجل الموظفين',
      leaves: 'طلبات الإجازات',
      payroll: 'مسيرات الرواتب',
      gratuity: 'نهاية الخدمة',
      permissions: 'الاستئذانات',
      attendance: 'البصمة والحضور'
    }
  },
  en: {
    common: {
      dashboard: 'Dashboard',
      crm: 'CRM & Sales',
      projects: 'Projects',
      construction: 'Field Operations',
      procurement: 'Procurement',
      hr: 'HR & People',
      accounting: 'Accounting',
      inventory: 'Inventory',
      settings: 'Settings',
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
      description: 'Description',
      switchLang: 'العربية',
      logout: 'Logout'
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
      table: {
        profile: 'Client Profile',
        staff: 'Assigned Staff',
        contact: 'Mobile',
        status: 'Status'
      }
    },
    projects: {
      title: 'Projects & Billing Radar',
      radar: 'Field progress and Interim Payments',
      contracting: 'Contracting',
      addNew: 'New Project',
      boqExplorer: 'BOQ Explorer',
      table: {
        project: 'Project / Client',
        progress: 'Progress',
        billing: 'Billing',
        status: 'Status'
      },
      details: {
        radar: 'Execution Radar',
        finance: 'Financial Documents',
        locked: 'Pipeline Locked - Financial Link Required'
      }
    },
    construction: {
      radar: 'Field Ops Radar',
      groups: 'Work Crews',
      equipment: 'Equipment Registry',
      reports: 'Site Reports'
    },
    hr: {
      title: 'HR & Compliance',
      staff: 'Staff Records',
      leaves: 'Leave Requests',
      payroll: 'Payroll',
      gratuity: 'Indemnity',
      permissions: 'Permissions',
      attendance: 'Attendance'
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
    return typeof value === 'string' ? value : key;
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
