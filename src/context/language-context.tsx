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

// القاموس السيادي الموحد - نظام المفاتيح المسطحة (Flat Keys Only) لضمان الاستقرار المطلق
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // الأقسام الرئيسية (Sidebar & Titles)
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء المحتملين',
    'clients': 'سجل العملاء المعتمدين',
    'appointments': 'رادار المواعيد والزيارات',
    'meetings': 'حجز القاعات والاجتماعات',
    'visitsDossier': 'سجل تفاعل العملاء (Dossier)',
    'projects': 'المشاريع والمعاملات',
    'activeProjects': 'المشاريع الجارية',
    'boqExplorer': 'مستكشف المقايسات والميزانيات',
    'reports': 'التقارير والرقابة',
    'construction': 'العمليات الميدانية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'equipment': 'سجل المعدات والآليات',
    'fieldLogs': 'تقارير الميدان',
    'procurement': 'المشتريات والتوريد',
    'suppliers': 'الموردين المعتمدين',
    'contracts': 'العقود الرسمية والملاحق',
    'aiAnalysis': 'تحليل العروض بالذكاء الاصطناعي',
    'hr': 'الموارد البشرية',
    'staffRecords': 'سجل شؤون الموظفين',
    'leaveRequests': 'طلبات الإجازات السنوية',
    'payrollBatches': 'مسيرات الرواتب الشهرية',
    'accounting': 'المحاسبة والمالية',
    'chartOfAccounts': 'دليل الحسابات السيادي',
    'receiptVouchers': 'سندات القبض المالية',
    'paymentVouchers': 'سندات الصرف والمدفوعات',
    'journalEntries': 'قيود اليومية المزدوجة',
    'financialReports': 'التقارير والقوائم المالية',
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',
    'usersManagement': 'إدارة مستخدمي النظام',
    'companyIdentity': 'هوية المنشأة والمظهر',
    'checklists': 'الدستور التشغيلي (المرجعيات)',
    'rolesPermissions': 'مصفوفة الصلاحيات والأدوار',
    'workHours': 'مواعيد العمل والعطلات',
    'userProfile': 'إعدادات ملفي الشخصي',
    'systemSetup': 'تهيئة النظام (Seed)',
    'templates': 'مكتبة القوالب الفنية',
    'referenceLists': 'القوائم المرجعية الموحدة',
    'boqMasterTree': 'شجرة بنود الأعمال المرجعية',
    'halls': 'إدارة قاعات الاجتماعات',
    'orgRef': 'الهيكل التنظيمي المرجعي',
    'techRef': 'هندسة المسارات الفنية',
    'geoRef': 'المرجع الجغرافي (الكويت)',

    // لوحة التحكم
    'dashboard.title': 'لوحة التحكم القيادية',
    'dashboard.export': 'تصدير التقارير',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'مهمات ميدانية متأخرة',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'معدل الإنجاز',

    // المشاريع
    'projects.title': 'المشاريع والمعاملات الفنية',
    'projects.radar': 'رادار تتبع العمليات المفتوحة',
    'projects.addNew': 'فتح معاملة جديدة',
    'projects.contracting': 'قسم المقاولات فقط',
    'projects.boqExplorer': 'مستكشف المقايسات والميزانيات',
    'projects.stats.portfolio': 'قيمة المحفظة الجارية',
    'projects.stats.claims': 'المطالبات المالية',
    'projects.stats.collection': 'نسبة التحصيل',

    // العمليات الميدانية
    'construction.radar': 'رادار العمليات الميدانية',
    'construction.reports': 'تقارير الإنجاز الميداني',
    'construction.equipment': 'سجل المعدات والآليات',
    'construction.siteProgress': 'إنجازات بنود الموقع',

    // HR & Payroll
    'payroll': 'نظام الرواتب والامتثال',
    'staff.records': 'سجل شؤون الموظفين',
    'leave.requests': 'طلبات الإجازات',

    // AI
    'ai.hub': 'مركز Nova للذكاء الهندسي',
    'ai.desc': 'تحليلات GenAI المتقدمة للمشتريات والمالية والميدان.',

    // Common
    'common.search': 'بحث سريع في السجلات...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف نهائي',
    'common.edit': 'تعديل',
    'details': 'تفاصيل',
    'transactions': 'المعاملات'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Executive Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Field Operations',
    'procurement': 'Procurement',
    'hr': 'Human Resources',
    'accounting': 'Accounting',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'common.search': 'Search...',
    'common.filter': 'Filter'
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
