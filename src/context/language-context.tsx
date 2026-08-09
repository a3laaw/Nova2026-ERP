
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
    // Navigation
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'projects': 'المشاريع',
    'hr': 'الموظفون',
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'inventory': 'المخازن',
    'settings': 'الإعدادات',
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'suppliers': 'الموردون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود',
    'boqExplorer': 'جدول الكميات والميزانية',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'checklists': 'قواعد العمل',
    'rolesPermissions': 'الصلاحيات',
    'workHours': 'ساعات العمل',
    'profile': 'الملف الشخصي',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',

    // CRM Batch 1
    'crm.description': 'إدارة الفرص والمبيعات',
    'crm.newLead': 'فرصة جديدة',
    'clients.title': 'العملاء',
    'clients.registerNew': 'تسجيل عميل جديد',
    'clients.registerNewDesc': 'فتح ملف تجاري جديد لربطه بالمعاملات الفنية',
    'clients.editProfile': 'تعديل بيانات العميل',
    'clients.newTransaction': 'فتح معاملة',
    'clients.finance': 'المالية',
    'clients.isolatedView': 'عرض معزول',
    'clients.assignedOnly': 'تظهر ملفاتك المنسوبة فقط',
    'clients.unauthorizedEdit': 'لا تملك صلاحية تعديل بيانات العملاء.',
    'clients.updateSuccess': 'تم تحديث بيانات العميل بنجاح.',
    
    // Transactions & Contracts Batch 1
    'transactions.newTitle': 'فتح معاملة فنية جديدة',
    'transactions.pathAssignment': 'تحديد المسار الفني والمهندس',
    'transactions.targetDept': 'القسم المسؤول',
    'transactions.selectDept': 'اختر القسم أولاً...',
    'transactions.assignedEngineer': 'المهندس المسؤول عن التنفيذ',
    'transactions.assignEngineer': 'تحديد المهندس...',
    'transactions.searchEngineer': 'بحث بالاسم أو الرقم...',
    'transactions.openNow': 'فتح المسار الآن',
    'transactions.openSuccess': 'تم فتح المسار الفني بنجاح',
    'transactions.openFailed': 'فشل فتح المعاملة',
    'transactions.redirecting': 'جاري تحويلك لرادار المتابعة...',
    'contracts.officialTitle': 'عقد خدمات هندسية رسمي',
    'contracts.markPaid': 'توثيق السداد',
    'contracts.commitAndSave': 'اعتماد وحفظ العقد',
    'quotations.commitAndSave': 'اعتماد وحفظ عرض السعر',

    // Common
    'common.save': 'حفظ',
    'common.saveChanges': 'حفظ التغييرات',
    'common.cancel': 'إلغاء',
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.name': 'الاسم',
    'common.company': 'الشركة',
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
    'common.nameAr': 'الاسم (عربي)',
    'common.nameEn': 'الاسم (EN)',
    'common.email': 'البريد الإلكتروني',
    'common.noResults': 'لا يوجد نتائج.',
    'common.unexpectedError': 'حدث خطأ غير متوقع.',
    'common.records': 'سجلات',
    'common.contract': 'عقد',
    'common.quotation': 'عرض سعر',
    'common.editItems': 'تعديل البنود',
    'common.active': 'النشاط',
    'common.timeline': 'الزمني'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'leads': 'Leads',
    'clients': 'Clients',
    'projects': 'Projects',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'contracts': 'Contracts',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.search': 'Search...',
    'common.status': 'Status',

    // CRM Batch 1
    'crm.description': 'Manage Leads & Sales',
    'crm.newLead': 'New Lead',
    'clients.title': 'Clients',
    'clients.registerNew': 'Register New Client',
    'clients.registerNewDesc': 'Open new commercial file',
    'clients.editProfile': 'Edit Client Profile',
    'clients.newTransaction': 'New Trans',
    'clients.finance': 'Finance',
    'clients.isolatedView': 'Isolated View',
    'clients.assignedOnly': 'Your assigned files only',
    'clients.unauthorizedEdit': 'Unauthorized to edit clients.',
    'clients.updateSuccess': 'Client data updated successfully.',
    'transactions.newTitle': 'New Technical Transaction',
    'transactions.pathAssignment': 'Path & Assignment',
    'transactions.targetDept': 'Target Department',
    'transactions.selectDept': 'Select Department...',
    'transactions.assignedEngineer': 'Assigned Engineer',
    'transactions.assignEngineer': 'Assign Engineer...',
    'transactions.searchEngineer': 'Search engineer...',
    'transactions.openNow': 'Open Path Now',
    'transactions.openSuccess': 'Technical Transaction Opened',
    'transactions.openFailed': 'Transaction Failed',
    'transactions.redirecting': 'Redirecting to tracking radar...',
    'contracts.officialTitle': 'Official Engineering Contract',
    'contracts.markPaid': 'Mark Paid',
    'contracts.commitAndSave': 'Commit & Save',
    'quotations.commitAndSave': 'Commit & Save',
    'common.saveChanges': 'Save Changes',
    'common.email': 'Email',
    'common.noResults': 'No results found.',
    'common.unexpectedError': 'An unexpected error occurred.',
    'common.records': 'Records',
    'common.contract': 'Contract',
    'common.quotation': 'Quotation',
    'common.editItems': 'Edit Items',
    'common.active': 'Active',
    'common.timeline': 'Timeline'
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
    if (translated) return translated;
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
