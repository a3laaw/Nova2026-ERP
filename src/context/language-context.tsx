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

    // لوحة التحكم
    'dashboard.title': 'لوحة التحكم القيادية',
    'dashboard.export': 'تصدير التقارير',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'مهمات ميدانية متأخرة',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'معدل الإنجاز',

    // المشاريع والمعاملات
    'projects.title': 'المشاريع والمعاملات الفنية',
    'projects.radar': 'رادار تتبع العمليات المفتوحة',
    'projects.addNew': 'فتح معاملة جديدة',
    'projects.contracting': 'قسم المقاولات فقط',
    'projects.boqExplorer': 'مستكشف المقايسات والميزانيات',
    'projects.stats.portfolio': 'قيمة المحفظة الجارية',
    'projects.stats.claims': 'المطالبات المالية',
    'projects.stats.collection': 'نسبة التحصيل',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'الإنجاز الفني',
    'projects.table.billing': 'الموقف المالي',
    'projects.table.status': 'الحالة',

    // العمليات الميدانية
    'construction.radar': 'رادار العمليات الميدانية',
    'construction.groups': 'مجموعات وأطقم العمل',
    'construction.equipment': 'سجل المعدات والآليات',
    'construction.reports': 'تقارير الإنجاز الميداني',
    'construction.siteProgress': 'إنجازات بنود الموقع',
    'construction.context': 'سياق العملية الميدانية',

    // المشتريات
    'suppliers': 'الموردين المعتمدين',
    'contracts': 'العقود الرسمية والملاحق',
    'aiAnalysis': 'ذكاء Nova لتحليل العروض',
    'purchaseOrders': 'أوامر الشراء (POs)',

    // الموارد البشرية
    'staffRecords': 'سجل شؤون الموظفين',
    'leaveRequests': 'طلبات الإجازات السنوية',
    'payrollBatches': 'مسيرات الرواتب الشهرية',
    'payroll': 'نظام الرواتب والامتثال',

    // المحاسبة
    'chartOfAccounts': 'دليل الحسابات السيادي',
    'receiptVouchers': 'سندات القبض المالية',
    'paymentVouchers': 'سندات الصرف والمدفوعات',
    'journalEntries': 'قيود اليومية المزدوجة',
    'financialReports': 'التقارير والقوائم المالية',

    // الإعدادات
    'usersManagement': 'إدارة مستخدمي النظام',
    'companyIdentity': 'هوية المنشأة والمظهر',
    'checklists': 'الدستور التشغيلي (المرجعيات)',
    'rolesPermissions': 'مصفوفة الصلاحيات والأدوار',
    'workHours': 'مواعيد العمل والعطلات',
    'userProfile': 'إعدادات ملفي الشخصي',
    'systemSetup': 'تهيئة النظام (Seed)',
    'templates': 'مكتبة القوالب الفنية',
    'templatesDesc': 'إدارة قوالب العقود، العروض، والمقايسات.',
    'referenceLists': 'القوائم المرجعية الموحدة',
    'boqMasterTree': 'شجرة بنود الأعمال المرجعية',
    'halls': 'إدارة قاعات الاجتماعات',
    'orgRef': 'الهيكل التنظيمي المرجعي',
    'techRef': 'هندسة المسارات الفنية',
    'geoRef': 'المرجع الجغرافي (الكويت)',

    // CRM والعملاء
    'leads': 'الفرص والعملاء المحتملين',
    'clients': 'سجل العملاء المعتمدين',
    'appointments': 'رادار المواعيد والزيارات',
    'meetings': 'حجز القاعات والاجتماعات',
    'visitsDossier': 'سجل تفاعل العملاء (Dossier)',

    // الذكاء الاصطناعي
    'ai.hub': 'مركز Nova للذكاء الهندسي',
    'ai.desc': 'تحليلات GenAI المتقدمة للمشتريات والمالية والميدان.',

    // كلمات عامة
    'common.search': 'بحث سريع في السجلات...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف نهائي',
    'common.edit': 'تعديل',
    'common.viewAll': 'عرض الكل',
    'common.pending': 'قيد الانتظار',
    'common.saved': 'تم حفظ البيانات بنجاح',
    'common.error': 'خطأ في النظام السحابي',
    'common.close': 'إغلاق',

    // تفاصيل المشروع
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق الرسمية',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد معتمد ومقايسة ميزانية معتمدة لبدء الرادار.',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة.',
    'projects.boqNumber': 'رقم المقايسة المرجعي',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية التقديرية',
    'projects.status': 'الحالة الميدانية'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Executive Dashboard',
    'projects.title': 'Projects & Transactions',
    'projects.boqExplorer': 'BOQ Explorer',
    'construction.radar': 'Field Radar',
    'construction.equipment': 'Equipment Master',
    'construction.reports': 'Field Reports',
    'staffRecords': 'Staff Records',
    'payroll': 'Payroll System',
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
