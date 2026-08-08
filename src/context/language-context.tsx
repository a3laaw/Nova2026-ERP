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
    // 1. الهيكل العام والملاحة (Layout & Navigation)
    'inline.profile.link.failed': 'تعذر تحميل ملف الصلاحيات',
    'inline.account.frozen': 'المنشأة مجمدة مؤقتاً',
    'inline.awaiting.activation': 'بانتظار تفعيل المنشأة',
    'inline.subscription.expired': 'انتهت صلاحية الوصول',
    'logout': 'تسجيل الخروج',
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'الخدمات الميدانية',
    'procurement': 'المشتريات',
    'hr': 'الموظفون والرواتب',
    'accounting': 'المحاسبة',
    'inventory': 'المخزون',
    'settings': 'الإعدادات',
    'profile': 'الملف الشخصي',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'appointments': 'المواعيد والزيارات',
    'meetings': 'الاجتماعات والقاعات',
    'visitsDossier': 'سجل تفاعل العملاء',
    'activeProjects': 'المشاريع الجارية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'equipment': 'المعدات والآليات',
    'fieldLogs': 'تقارير الميدان',
    'aiAnalysis': 'تحليل العروض',
    'financialReports': 'التقارير المالية',
    'userProfile': 'إعدادات ملفي الشخصي',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'checklists': 'قواعد العمل',
    'templates': 'القوالب',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',

    // 2. المحاسبة والمالية (Accounting)
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'accounting.coa.title': 'شجرة الحسابات',
    'accounting.journals.title': 'قيود اليومية',
    'accounting.vouchers.paymentTitle': 'سندات الصرف',
    'accounting.vouchers.receiptTitle': 'سندات القبض',

    // 3. المشاريع والمقايسات (Projects & BOQs)
    'projects.title': 'المشاريع والمعاملات',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',
    'projects.boqExplorer.rate': 'السعر',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.voTitle': 'عنوان أمر التغيير',
    'projects.voManager.reason': 'السبب',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة معتمدة)',

    // 4. الموظفون (HR)
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',
    'entryAdded': 'تمت إضافة القيد بنجاح',

    // 5. كلمات عامة (Common)
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
    'common.quantity': 'الكمية',
    'common.unit': 'الوحدة',
    'common.total': 'الإجمالي',
    'common.confirm': 'تأكيد',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'حدث خطأ غير متوقع',
    'common.confirmDelete': 'تأكيد الحذف النهائي',
    'common.deleted': 'تم الحذف بنجاح'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Field Service',
    'procurement': 'Purchase',
    'hr': 'Employees',
    'accounting': 'Accounting',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'clients': 'Contacts',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel'
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
    return translations[lang]?.[key] || key;
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
