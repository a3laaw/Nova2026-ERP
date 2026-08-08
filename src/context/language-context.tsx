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

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Common
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.search': 'بحث...',
    'common.actions': 'إجراءات',
    'common.loading': 'جاري التحميل...',
    'common.details': 'تفاصيل',
    'common.new': 'إضافة جديد',
    'common.confirm': 'تأكيد',
    'common.all': 'الكل',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.pending': 'قيد الانتظار',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.value': 'القيمة',
    'common.filter': 'تصفية',
    'common.summary': 'ملخص',
    'common.viewAll': 'عرض الكل',
    'common.close': 'إغلاق',
    'common.saved': 'تم الحفظ بنجاح',
    'common.deleted': 'تم الحذف بنجاح',
    'common.error': 'خطأ في النظام',
    'common.confirmDelete': 'هل أنت متأكد من الحذف؟',
    'common.isActive': 'نشط',
    'common.order': 'الترتيب',
    'common.name': 'الاسم',
    'common.code': 'الكود',
    'common.description': 'الوصف',
    'common.logout': 'تسجيل الخروج',
    
    // Flat Keys Protection (Deep Search Fix)
    'checklists': 'الدستور التشغيلي',
    'templates': 'مكتبة القوالب',
    'rolesRef': 'مصفوفة الصلاحيات',
    'profile': 'الملف الشخصي',
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب عقد ومقايسة معتمدة للبدء.',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة.',

    // Dashboard
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم المركزية',
    'dashboard.export': 'تصدير البيانات',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع النشطة',
    'dashboard.stats.workforce': 'إجمالي الموظفين',
    'dashboard.stats.completion': 'نسبة الإنجاز السنوية',
    'dashboard.missions': 'المهام المتأخرة',
    'dashboard.recent': 'آخر النشاطات التشغيلية',

    // CRM
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والمبيعات',
    'clients': 'قاعدة بيانات العملاء',
    'clients.title': 'قاعدة بيانات العملاء',
    'clients.addNew': 'تسجيل عميل جديد',
    
    // Projects
    'projects': 'المشاريع والمعاملات',
    'projects.title': 'المشاريع والمعاملات',
    'projects.radar': 'رادار المشاريع الجارية',
    'projects.contracting': 'قسم المقاولات',
    'projects.addNew': 'فتح معاملة جديدة',
    'projects.boqExplorer': 'مستكشف المقايسات',
    
    // Engineering & BOQ
    'boqExplorer': 'مستكشف المقايسات',
    'boqTemplates': 'قوالب المقايسات (BOQ)',
    'itemized': 'تسعير بنود',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'pricingMode': 'نمط التسعير',
    'totalQuoteValue': 'إجمالي قيمة العقد النهائية',
    'defaultTerms': 'الشروط والأحكام العامة',
    'contractSigning': 'توقيع العقد',
    'at': 'عند',
    'before': 'قبل',
    'during': 'أثناء',
    'after': 'بعد',

    // Settings
    'settings': 'إعدادات النظام',
    'companyIdentity': 'هوية الشركة',
    'usersManagement': 'إدارة المستخدمين',
    'workHours': 'مواعيد العمل',
    'systemSetup': 'تأسيس النظام',
    'manageCompanyData': 'إدارة بيانات المنشأة والهوية البصرية',
    'templatesDesc': 'نماذج العقود، عروض الأسعار، وجداول الكميات المرجعية.',
    'workHoursDesc': 'ضبط فترات الدوام، العطلات الرسمية، وقواعد البصمة.',
    'referenceLists': 'القوائم المرجعية',
    'boqMasterTree': 'شجرة الأعمال المرجعية',
    'halls': 'إدارة القاعات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'rolesPermissions': 'الأدوار والصلاحيات',
    
    // Breadcrumb Special
    'details': 'تفاصيل',
    'transactions': 'المعاملات'
  },
  en: {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'checklists': 'Constitution',
    'templates': 'Templates',
    'rolesRef': 'Permissions',
    'profile': 'Profile',
    'projects.details.radar': 'Execution Radar',
    'projects.details.finance': 'Finance & Docs',
    'projects.details.locked': 'Path Locked: Contract & BOQ Required',
    'projects.boqExplorer.noBoqs': 'No BOQs found for this transaction.',
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
