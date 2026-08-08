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

// القاموس الموحد الشامل - ميثاق أودو الاحترافي (Odoo ERP Standard)
// تم إلغاء كافة التعبيرات السيادية واستبدالها بمصطلحات ERP رشيقة
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. التنقل الرئيسي (Navigation)
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.export': 'تصدير البيانات',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'المهام الميدانية',
    'dashboard.stats.revenue': 'الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'الموظفون',
    'dashboard.stats.completion': 'نسبة الإنجاز',

    // 2. المبيعات والعملاء (CRM)
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'clients.addNew': 'عميل جديد',
    'clients.title': 'سجل العملاء',
    'clients.details.history': 'سجل النشاطات',
    'clients.details.location': 'الموقع الجغرافي',
    'clients.details.transactions': 'المشاريع والمعاملات',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'التواصل',
    'clients.table.status': 'الحالة',
    'addLead': 'فرصة جديدة',

    // 3. المشاريع والمقايسات (Projects & BOQs)
    'projects': 'المشاريع',
    'projects.title': 'المشاريع والمعاملات',
    'projects.radar': 'رادار المشاريع',
    'projects.addNew': 'مشروع جديد',
    'projects.contracting': 'قسم التنفيذ',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqs.title': 'جداول الكميات',
    'projects.stats.portfolio': 'قيمة المحفظة',
    'projects.stats.claims': 'المطالبات',
    'projects.stats.collection': 'التحصيل',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'الموقف المالي',
    'projects.table.status': 'الحالة',
    'projects.details.radar': 'متابعة التنفيذ',
    'projects.details.finance': 'المالية والعقود',
    'projects.details.locked': 'المسار الفني مقفل: يتطلب اعتماد العقد والمقايسة',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد التغيير',
    'projects.boqExplorer.sections': 'الأقسام',
    'projects.boqExplorer.rate': 'السعر',

    // 4. العمليات الميدانية (Field Operations)
    'construction': 'الخدمات الميدانية',
    'construction.radar': 'الرادار الميداني',
    'construction.groups': 'فرق العمل الميدانية',
    'construction.reports': 'تقارير الإنجاز',
    'construction.equipment': 'سجل المعدات والآليات',
    'equipment': 'المعدات',
    'inventory': 'المخزون والعهد',
    'appointments': 'المواعيد والزيارات',
    'meetings': 'الاجتماعات والقاعات',
    'visitsDossier': 'سجل الزيارات الشامل',

    // 5. الموارد البشرية (HR)
    'hr': 'الموظفون والرواتب',
    'staffRecords': 'سجل الموظفين',
    'payroll': 'الرواتب والامتثال',
    'payrollBatches': 'مسير الرواتب',
    'leaveRequests': 'طلبات الإجازات',
    'userProfile': 'الملف الشخصي',

    // 6. المالية والمحاسبة (Finance)
    'accounting': 'المحاسبة والمالية',
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',

    // 7. المشتريات والموردين (Procurement)
    'procurement': 'المشتريات',
    'suppliers': 'الموردون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود الرسمية',
    'aiAnalysis': 'تحليل عروض الأسعار',

    // 8. الإعدادات (Settings)
    'settings': 'الإعدادات',
    'settings.checklists': 'قواعد العمل والمسارات',
    'checklists': 'قواعد العمل',
    'usersManagement': 'المستخدمون والصلاحيات',
    'rolesPermissions': 'مصفوفة الأدوار',
    'companyIdentity': 'هوية المنشأة',
    'companyProfile': 'بيانات الشركة',
    'commercialRegistry': 'السجل التجاري',
    'templates': 'مكتبة القوالب',
    'templatesDesc': 'إدارة النماذج المرجعية للمستندات والعقود',
    'workHours': 'مواعيد العمل والعطلات',
    'unitTypes': 'وحدات القياس',
    'paymentMethods': 'طرق الدفع',
    'paymentConditionTypes': 'شروط الدفع',
    'milestoneTimingTypes': 'توقيت الدفعات',
    'itemCategories': 'تصنيفات الأصناف',
    'costTypeCategories': 'تصنيفات التكاليف',
    'halls': 'قاعات الاجتماعات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',
    'boqMasterTree': 'شجرة المقايسات الموحدة',

    // 9. كلمات عامة (Common)
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
    'common.viewAll': 'عرض الكل',
    'common.saved': 'تم الحفظ بنجاح',
    'common.error': 'حدث خطأ تقني',
    'common.name': 'الاسم',
    'common.company': 'المنشأة',
    'common.contact': 'الاتصال',
    'common.rating': 'التقييم',
    'category': 'التصنيف',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'logout': 'تسجيل الخروج',
    'basicSalary': 'الراتب الأساسي',
    'jobTitle': 'المسمى الوظيفي'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Dashboard',
    'dashboard.export': 'Export Data',
    'dashboard.recent': 'Recent Activity',
    'dashboard.missions': 'Field Tasks',
    'dashboard.stats.revenue': 'Revenue',
    'dashboard.stats.activeProjects': 'Active Projects',
    'dashboard.stats.workforce': 'Workforce',
    'dashboard.stats.completion': 'Completion Rate',

    'crm': 'CRM',
    'leads': 'Leads',
    'clients': 'Contacts',
    'clients.addNew': 'New Contact',
    'clients.title': 'Contacts Register',
    'clients.table.profile': 'Profile',
    'clients.table.status': 'Status',

    'projects': 'Projects',
    'projects.title': 'Projects & Transactions',
    'projects.boqExplorer': 'BOQ & Budget',
    'projects.radar': 'Project Radar',
    'projects.table.project': 'Project / Client',
    'projects.table.progress': 'Progress',
    'projects.table.status': 'Status',
    'projects.details.radar': 'Execution Tracking',
    'projects.details.finance': 'Finance & Contracts',

    'construction': 'Field Operations',
    'construction.radar': 'Field Radar',
    'construction.groups': 'Work Groups',
    'construction.reports': 'Field Logs',
    'construction.equipment': 'Equipment Master',
    
    'hr': 'Human Resources',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',

    'accounting': 'Accounting',
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',

    'procurement': 'Procurement',
    'suppliers': 'Vendors',
    'purchaseOrders': 'Purchase Orders',
    'contracts': 'Contracts',

    'settings': 'Settings',
    'settings.checklists': 'Business Rules',
    'usersManagement': 'Users & Access',
    'companyIdentity': 'Company Profile',
    'templates': 'Templates',

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
    'common.total': 'Total',
    'common.viewAll': 'View All',
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
    if (!key) return '';
    const val = translations[lang]?.[key];
    return val || key;
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
