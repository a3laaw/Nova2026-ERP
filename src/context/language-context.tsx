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

// القاموس الموحد الشامل بالنظام - أسلوب أودو البسيط والراديائي (Odoo ERP Standard)
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الأقسام الرئيسية (Navigation)
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.export': 'تصدير التقارير',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'المهام الميدانية',
    'dashboard.stats.revenue': 'الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'الموظفون',
    'dashboard.stats.completion': 'نسبة الإنجاز',

    // 2. المبيعات والعملاء والفرص (CRM & Contacts)
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'clients.addNew': 'عميل جديد',
    'clients.addLead': 'فرصة جديدة',
    'clients.title': 'العملاء',
    'clients.details.history': 'سجل النشاطات',
    'clients.details.location': 'الموقع',
    'clients.details.transactions': 'المشاريع والمعاملات',
    'clients.table.contact': 'التواصل',
    'clients.table.profile': 'الملف',
    'clients.table.staff': 'المسؤول',
    'clients.table.status': 'الحالة',
    'addLead': 'فرصة جديدة',

    // 3. المشاريع وجداول الكميات وأوامر التغيير (Projects, BOQs & Change Orders)
    'projects': 'المشاريع',
    'projects.title': 'المشاريع والمعاملات',
    'projects.radar': 'متابعة المشاريع',
    'projects.addNew': 'مشروع جديد',
    'projects.contracting': 'قسم المقاولات',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.stats.portfolio': 'قيمة المشاريع',
    'projects.stats.claims': 'المطالبات المالية',
    'projects.stats.collection': 'نسبة التحصيل',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'نسبة الإنجاز',
    'projects.table.billing': 'الموقف المالي',
    'projects.table.status': 'الحالة',
    'projects.details.radar': 'متابعة التنفيذ',
    'projects.details.finance': 'المالية والعقود',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',

    // 4. الخدمات الميدانية والموردين والمشتريات (Field Ops & Purchasing)
    'construction': 'الخدمات الميدانية',
    'construction.radar': 'العمليات الميدانية',
    'construction.groups': 'فرق العمل',
    'construction.reports': 'تقارير الموقع',
    'procurement': 'المشتريات',
    'suppliers': 'الموردون',
    'contracts': 'العقود',
    'purchaseOrders': 'أوامر الشراء',
    'aiAnalysis': 'تحليل العروض',

    // 5. الموظفون والرواتب (HR & Payroll)
    'hr': 'الموظفون والرواتب',
    'staffRecords': 'الموظفون',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',
    'payroll': 'الرواتب',
    'hr.attendance.title': 'سجل الحضور والإنصراف',
    'hr.gratuity.title': 'حاسبة نهاية الخدمة',

    // 6. المحاسبة والمالية (Accounting)
    'accounting': 'المحاسبة',
    'chartOfAccounts': 'شجرة الحسابات',
    'receiptVouchers': 'سندات القبض',
    'paymentVouchers': 'سندات الصرف',
    'journalEntries': 'قيود اليومية',
    'financialReports': 'التقارير المالية',

    // 7. المخزون والإعدادات (Inventory & Settings)
    'inventory': 'المخزون',
    'settings': 'الإعدادات',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'checklists': 'قواعد العمل',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'workHours': 'ساعات العمل والعطلات',
    'userProfile': 'الملف الشخصي',
    'templates': 'القوالب',
    'equipment': 'المعدات',
    'appointments': 'المواعيد',
    'meetings': 'الاجتماعات والقاعات',

    // 8. الكلمات العامة البسيطة (Common Terms)
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
    'common.company': 'الشركة',
    'common.email': 'البريد الإلكتروني',
    'common.value': 'القيمة التقديرية'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Dashboard',
    'dashboard.export': 'Export',
    'dashboard.recent': 'Recent Activity',
    'dashboard.missions': 'Field Tasks',

    'crm': 'CRM',
    'leads': 'Leads & Opportunities',
    'clients': 'Contacts',
    'clients.addNew': 'New Contact',
    'clients.title': 'Contacts',
    'addLead': 'New Lead',

    'projects': 'Projects',
    'construction': 'Field Service',
    'procurement': 'Purchase',
    'suppliers': 'Vendors',
    'purchaseOrders': 'Purchase Orders',

    'hr': 'Employees',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',

    'accounting': 'Accounting',
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',

    'inventory': 'Inventory',
    'settings': 'Settings',

    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.name': 'Name',
    'common.company': 'Company',
    'common.status': 'Status',
    'common.email': 'Email',
    'common.value': 'Estimated Value'
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