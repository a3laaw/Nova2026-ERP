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
    // --- BATCH 1: LAYOUT & SIDEBAR (45 keys) ---
    'inline.profile.link.failed': 'تعذر تحميل ملف الصلاحيات',
    'inline.account.frozen': 'المنشأة مجمدة مؤقتاً',
    'inline.awaiting.activation': 'بانتظار تفعيل المنشأة',
    'inline.subscription.expired': 'انتهت صلاحية الوصول',
    'logout': 'تسجيل الخروج',
    'inline.rotate.0': 'rotate-180',
    'inline.end': 'start',
    'devConsole': 'لوحة تحكم المطور',
    'inline.flex.row': 'flex-row-reverse',
    'dashboard': 'لوحة التحكم',
    'clients': 'العملاء',
    'projects': 'المشاريع',
    'inventory': 'المخزون',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'details': 'تفاصيل',
    'transactions': 'المعاملات',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',
    'chartOfAccounts': 'شجرة الحسابات',
    'receiptVouchers': 'سندات القبض',
    'journalEntries': 'قيود اليومية',
    'boqExplorer': 'جدول الكميات والميزانية',
    'purchaseOrders': 'أوامر الشراء',
    'usersManagement': 'المستخدمون والصلاحيات',
    'leads': 'الفرص والعملاء',
    'appointments': 'المواعيد',
    'visitsDossier': 'سجل الزيارات الشامل',
    'activeProjects': 'المشاريع الجارية',
    'reports': 'التقارير',
    'construction': 'الخدمات الميدانية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'فرق العمل الميدانية',
    'equipment': 'المعدات',
    'fieldLogs': 'سجلات الموقع',
    'aiAnalysis': 'التحليل الذكي',
    'inline.personal.workspace': 'شؤوني الوظيفية',
    'paymentVouchers': 'سندات الصرف',
    'financialReports': 'التقارير المالية',
    'userProfile': 'الملف الشخصي',
    'inline.left': 'right',
    'inline.left.full.ml.3': 'right-full mr-3',
    'inline.right': 'left',
    'inline.tax...reg.no': 'الرقم الضريبي / السجل:',
    'inline.generated.on': 'تاريخ الاستخراج',
    'inline.text.left': 'text-right',

    // --- RETAINED CORE KEYS (Common) ---
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
    'common.back': 'العودة',
    'common.close': 'إغلاق',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'حدث خطأ',
    'common.name': 'الاسم',
    'common.company': 'المنشأة',
    'common.contact': 'التواصل',
    'common.rating': 'التقييم',
    'common.nameAr': 'الاسم (عربي)',
    'common.nameEn': 'الاسم (EN)',
    'common.isActive': 'نشط',
    'common.confirmDelete': 'هل أنت متأكد من الحذف؟',
    'common.deleted': 'تم الحذف بنجاح',
    'common.pending': 'قيد الانتظار',
    'common.active': 'نشط حالياً',
    'common.completed': 'مكتمل',
    'common.all': 'الكل',
    'common.photos': 'الصور',
    'common.labor': 'العمالة',
    'common.equipment': 'المعدات',
    'common.loadFromGroup': 'تحميل من طاقم',
    'common.addLabel': 'إضافة بند'
  },
  en: {
    // --- BATCH 1: LAYOUT & SIDEBAR ---
    'inline.profile.link.failed': 'Profile Link Failed',
    'inline.account.frozen': 'Account Frozen',
    'inline.awaiting.activation': 'Awaiting Activation',
    'inline.subscription.expired': 'Subscription Expired',
    'logout': 'Logout',
    'inline.rotate.0': 'rotate-0',
    'inline.end': 'end',
    'devConsole': 'Developer Console',
    'inline.flex.row': 'flex-row',
    'dashboard': 'Dashboard',
    'clients': 'Contacts',
    'projects': 'Projects',
    'inventory': 'Inventory',
    'rolesPermissions': 'Roles & Permissions',
    'details': 'Details',
    'transactions': 'Transactions',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll',
    'chartOfAccounts': 'Chart of Accounts',
    'receiptVouchers': 'Receipt Vouchers',
    'journalEntries': 'Journal Entries',
    'boqExplorer': 'BOQ & Budget',
    'purchaseOrders': 'Purchase Orders',
    'usersManagement': 'Users & Access',
    'leads': 'Opportunities',
    'appointments': 'Appointments',
    'visitsDossier': 'Visits Dossier',
    'activeProjects': 'Active Projects',
    'reports': 'Reports',
    'construction': 'Field Service',
    'fieldRadar': 'Field Radar',
    'workGroups': 'Work Groups',
    'equipment': 'Equipment',
    'fieldLogs': 'Field Logs',
    'aiAnalysis': 'AI Analysis',
    'inline.personal.workspace': 'Personal Workspace',
    'paymentVouchers': 'Payment Vouchers',
    'financialReports': 'Financial Reports',
    'userProfile': 'User Profile',
    'inline.left': 'left',
    'inline.left.full.ml.3': 'left-full ml-3',
    'inline.right': 'right',
    'inline.tax...reg.no': 'TAX / REG NO:',
    'inline.generated.on': 'Generated On',
    'inline.text.left': 'text-left',

    // --- RETAINED CORE KEYS (Common) ---
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.amount': 'Amount',
    'common.code': 'Code',
    'common.notes': 'Notes',
    'common.quantity': 'Quantity',
    'common.unit': 'Unit',
    'common.total': 'Total',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.saved': 'Saved Successfully',
    'common.error': 'Error Occurred',
    'common.name': 'Name',
    'common.company': 'Company',
    'common.contact': 'Contact',
    'common.rating': 'Rating',
    'common.nameAr': 'Name (Arabic)',
    'common.nameEn': 'Name (English)',
    'common.isActive': 'Active',
    'common.confirmDelete': 'Confirm Delete?',
    'common.deleted': 'Deleted Successfully',
    'common.pending': 'Pending',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.all': 'All',
    'common.photos': 'Photos',
    'common.labor': 'Labor',
    'common.equipment': 'Equipment',
    'common.loadFromGroup': 'Load From Group',
    'common.addLabel': 'Add Item'
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
