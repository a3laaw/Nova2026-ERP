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

// القاموس السيادي - نظام المفاتيح المسطحة (Flat Keys) لضمان الوصول بنسبة 100%
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // الأقسام الرئيسية
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع والمعاملات',
    'construction': 'العمليات الميدانية',
    'procurement': 'المشتريات والتوريد',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة والمالية',
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',
    'profile': 'الملف الشخصي',

    // سجل العملاء (الظاهر في الصورة)
    'clients.title': 'سجل العملاء',
    'clients.addNew': 'تسجيل عميل جديد',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات الفنية',
    'clients.details.location': 'إحداثيات الموقع',
    'clients.details.history': 'سجل الحركات',

    // القائمة الجانبية (Sidebar)
    'leads': 'الفرص البيعية',
    'clients': 'سجل العملاء',
    'appointments': 'المواعيد والزيارات',
    'halls': 'حجز القاعات والاجتماعات',
    'visitsDossier': 'سجل تفاعل العملاء',
    'activeProjects': 'المشاريع الجارية',
    'boqExplorer': 'مستكشف المقايسات',
    'reports': 'التقارير الهندسية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'equipment': 'سجل المعدات والآليات',
    'fieldLogs': 'تقارير الميدان',
    'suppliers': 'الموردين المعتمدين',
    'contracts': 'العقود الرسمية',
    'aiAnalysis': 'تحليل العروض (AI)',
    'staffRecords': 'شؤون الموظفين',
    'leaveRequests': 'طلبات الإجازات',
    'payrollBatches': 'مسيرات الرواتب',
    'chartOfAccounts': 'دليل الحسابات',
    'receiptVouchers': 'سندات القبض',
    'paymentVouchers': 'سندات الصرف',
    'journalEntries': 'قيود اليومية',
    'financialReports': 'التقارير المالية',
    'usersManagement': 'إدارة المستخدمين',
    'companyIdentity': 'هوية المنشأة',
    'checklists': 'الدستور التشغيلي',
    'rolesPermissions': 'مصفوفة الصلاحيات',
    'workHours': 'مواعيد العمل',
    'userProfile': 'ملفي الشخصي',

    // تفاصيل المشروع
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد معتمد ومقايسة ميزانية معتمدة للبدء.',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة.',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',

    // شريط المسار (Breadcrumb)
    'details': 'تفاصيل',
    'transactions': 'المعاملات',

    // كلمات عامة
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'خطأ في النظام',
    'common.close': 'إغلاق',

    // أنماط التسعير
    'itemized': 'تسعير بنود',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'pricingMode': 'نمط التسعير'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'clients.title': 'Clients List',
    'clients.addNew': 'Add New Client',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'checklists': 'Constitution',
    'templates': 'Templates',
    'rolesRef': 'Permissions',
    'profile': 'Profile',
    'details': 'Details',
    'transactions': 'Transactions'
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
    return translations[lang][key] || key;
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
