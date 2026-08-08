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
    // 1. الأقسام الرئيسية (Navigation)
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'المهام المعلقة',
    'dashboard.export': 'تصدير البيانات',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'projects.title': 'المشاريع والمعاملات',
    'construction': 'الخدمات الميدانية',
    'procurement': 'المشتريات',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة',
    'inventory': 'المخزون',
    'settings': 'الإعدادات',
    'profile': 'الملف الشخصي',
    'equipment': 'المعدات والآليات',
    'appointments': 'المواعيد',
    'meetings': 'الاجتماعات والقاعات',
    'reports': 'التقارير',
    'transactions': 'المعاملات',
    'details': 'التفاصيل',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'clients.title': 'سجل العملاء',
    'visitsDossier': 'سجل تفاعل العملاء',
    'activeProjects': 'المشاريع الجارية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'fieldLogs': 'تقارير الميدان',
    'aiAnalysis': 'تحليل العروض',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'checklists': 'قواعد العمل',
    'templates': 'القوالب',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'workHours': 'مواعيد العمل',
    'userProfile': 'الملف الشخصي',

    // 2. المحاسبة والمالية (Accounting)
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',
    'accounting.coa.title': 'شجرة الحسابات',
    'accounting.journals.title': 'قيود اليومية',
    'accounting.vouchers.paymentTitle': 'سندات الصرف',
    'accounting.vouchers.receiptTitle': 'سندات القبض',

    // 3. المشاريع والمقايسات (Projects & BOQs)
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqExplorer.noBoqs': 'لا يوجد مقايسات معتمدة لهذا المشروع.',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.boqExplorer.rate': 'السعر',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة معتمدة)',
    'projects.addNew': 'مشروع جديد',

    // 4. المشتريات والموردون (Purchasing)
    'suppliers': 'الموردون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود',

    // 5. الموظفون والرواتب (HR)
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',

    // 6. كلمات عامة (Common)
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.actions': 'الإجراءات',
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
    'common.confirmDelete': 'تأكيد الحذف',
    'common.deleted': 'تم الحذف بنجاح',
    'common.viewAll': 'عرض الكل',
    'common.pending': 'معلق'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'projects.title': 'Projects & Transactions',
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
