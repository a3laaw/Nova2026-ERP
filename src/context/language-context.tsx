'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  tSafe: (key: string, fallbackAr: string, fallbackEn?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. القائمة الرئيسية والمسارات
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'الخدمات الميدانية',
    'procurement': 'المشتريات',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة',
    'inventory': 'المخزون',
    'settings': 'الإعدادات',
    'profile': 'الملف الشخصي',
    'equipment': 'المعدات والآليات',
    'appointments': 'المواعيد والزيارات',
    'meetings': 'الاجتماعات والقاعات',
    'reports': 'التقارير الإحصائية',
    'transactions': 'المعاملات',
    'details': 'التفاصيل',

    // 2. المحاسبة وشجرة الحسابات
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',
    'accounting.coa.addAccount': 'إضافة حساب جديد',
    'accounting.coa.title': 'دليل الحسابات الموحد',

    // 3. المشتريات والموردون
    'suppliers': 'الموردون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود الرسمية',
    'category': 'التصنيف',
    'aiAnalysis': 'تحليل عروض الأسعار',

    // 4. الموارد البشرية والرواتب
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',
    'hr.attendance.title': 'سجل الحضور والإنصراف',
    'hr.gratuity.title': 'مستحقات نهاية الخدمة',

    // 5. الإعدادات والقوالب
    'companyIdentity': 'هوية المنشأة',
    'companyProfile': 'بيانات الشركة',
    'company.name': 'اسم المنشأة',
    'company.registry': 'السجل التجاري',
    'checklists': 'قواعد العمل',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'workHours': 'ساعات العمل والعطلات',
    'userProfile': 'الملف الشخصي',
    'templates': 'مكتبة القوالب',
    'templatesDesc': 'إدارة النماذج المرجعية للمستندات والعقود',
    'usersManagement': 'المستخدمون والصلاحيات',
    'quotationTemplates': 'عروض الأسعار',
    'contractTemplates': 'العقود الرسمية',
    'boqTemplates': 'جداول الكميات',
    'boqMasterTree': 'شجرة المقايسات',
    'referenceLists': 'القوائم المرجعية',
    'halls': 'قاعات الاجتماعات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',

    // 6. كلمات عامة وحقول
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.amount': 'المبلغ',
    'common.code': 'الكود',
    'common.notes': 'ملاحظات',
    'common.name': 'الاسم',
    'common.company': 'الشركة',
    'common.nameAr': 'الاسم (عربي)',
    'common.nameEn': 'الاسم (English)',
    'common.quantity': 'الكمية',
    'common.unit': 'الوحدة',
    'common.total': 'الإجمالي',
    'common.confirm': 'تأكيد',
    'common.back': 'العودة',
    'common.close': 'إغلاق',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'حدث خطأ'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.status': 'Status',
    'category': 'Category',
    'company.registry': 'Commercial Registry',
    'templatesDesc': 'Manage document and contract templates'
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
    if (!key) return '';
    return translations[lang]?.[key] || key;
  };

  const tSafe = (key: string, fallbackAr: string, fallbackEn?: string) => {
    if (!key) return lang === 'ar' ? fallbackAr : (fallbackEn || fallbackAr);
    const translated = translations[lang]?.[key];
    if (translated && translated !== key) return translated;
    return lang === 'ar' ? fallbackAr : (fallbackEn || fallbackAr);
  };

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', isRtl: lang === 'ar', setLang, t, tSafe }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};