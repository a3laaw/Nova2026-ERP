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

const translations = {
  ar: {
    // 1. الأقسام الرئيسية (Navigation)
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
    'equipment': 'المعدات',
    'appointments': 'المواعيد',
    'meetings': 'الاجتماعات والقاعات',
    'reports': 'التقارير',
    'transactions': 'المعاملات',
    'details': 'تفاصيل',

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

    // 3. المشاريع وجداول الكميات وأوامر التغيير (Projects & BOQs)
    'projects.title': 'المشاريع والمعاملات',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.boqExplorer.rate': 'السعر',
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة معتمدة)',

    // 4. المشتريات والموردون (Purchasing & Vendors)
    'suppliers': 'الموردون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود',
    'aiAnalysis': 'تحليل العروض',

    // 5. الموظفون والرواتب (HR & Payroll)
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',

    // 6. العملاء والمبيعات (CRM & Contacts)
    'clients': 'العملاء',
    'leads': 'الفرص والعملاء',
    'clients.addNew': 'عميل جديد',
    'clients.addLead': 'فرصة جديدة',
    'visitsDossier': 'سجل تفاعل العملاء',

    // 7. الإعدادات وقواعد العمل (Settings & Rules)
    'checklists': 'قواعد العمل',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'templates': 'القوالب',
    'rolesPermissions': 'الصلاحيات والأدوار',
    'workHours': 'مواعيد العمل',
    'userProfile': 'الملف الشخصي',

    // 8. كلمات عامة بسيطة (Common Terms)
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
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'حدث خطأ',

    // 9. الخدمات الميدانية (Field Service)
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'fieldLogs': 'تقارير الميدان',
    'activeProjects': 'المشاريع الجارية'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Field Service',
    'procurement': 'Purchase',
    'hr': 'HR',
    'accounting': 'Accounting',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'profile': 'Profile',
    'equipment': 'Equipment',
    'appointments': 'Appointments',
    'meetings': 'Meetings',
    'reports': 'Reports',
    'transactions': 'Transactions',
    'details': 'Details',
    'chartOfAccounts': 'COA',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payments',
    'receiptVouchers': 'Receipts',
    'financialReports': 'Financial Reports',
    'projects.title': 'Projects & Transactions',
    'projects.boqExplorer': 'BOQ & Budget',
    'projects.details.radar': 'Field Radar',
    'projects.details.finance': 'Finance & Docs',
    'projects.details.locked': 'Path Locked (Requires Contract & BOQ)',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll Batches',
    'clients': 'Customers',
    'leads': 'Leads',
    'clients.addNew': 'New Client',
    'checklists': 'Checklists',
    'usersManagement': 'Users & Access',
    'companyIdentity': 'Company Data',
    'templates': 'Templates',
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
    return translations[lang][key as keyof typeof translations['ar']] || key;
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
