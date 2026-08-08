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
    // 1. الأقسام الرئيسية (Main Navigation)
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
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة معتمدة)',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.voManager.increase': 'زيادة كمية',
    'projects.voManager.decrease': 'تخفيض كمية',
    'projects.voManager.omit': 'إلغاء بند',
    'projects.voManager.newItem': 'بند جديد (أمر تغييري)',
    'projects.voManager.targetItem': 'البند المستهدف',
    'projects.voManager.deltaQty': 'فرق الكمية',
    'projects.voManager.financialSection': 'القسم المالي',
    'projects.voManager.executionPath': 'مسار التنفيذ',
    'projects.voManager.linkExisting': 'ربط بمرحلة حالية',
    'projects.voManager.injectNew': 'حقن مرحلة جديدة',
    'projects.voManager.stageName': 'اسم المرحلة',
    'projects.voManager.stageCode': 'كود المرحلة',
    'projects.voManager.insertAfter': 'إدراج بعد',
    'projects.voManager.parallel': 'مرحلة موازية (مكملة)',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',
    'projects.boqExplorer.noBoqs': 'لا يوجد مقايسات معتمدة لهذا المشروع.',
    'projects.boqExplorer.rate': 'السعر',
    'projects.boqExplorer.action': 'الإجراء',
    'projects.boqExplorer.voSummary': 'ملخص التعديلات',

    // 4. الخدمات الميدانية والموردين والمشتريات (Field Ops & Purchasing)
    'construction': 'الخدمات الميدانية',
    'construction.radar': 'العمليات الميدانية',
    'construction.groups': 'فرق العمل',
    'construction.reports': 'تقارير الموقع',
    'construction.equipment': 'المعدات',
    'construction.context': 'بيانات الموقع',
    'construction.siteProgress': 'الإنجاز الميداني',
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
    'common.confirmDelete': 'تأكيد الحذف',
    'common.deleted': 'تم الحذف بنجاح',
    'common.viewAll': 'عرض الكل',
    'common.pending': 'معلق',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.addLabel': 'البند',
    'common.labor': 'العمالة',
    'common.equipment': 'المعدات',
    'common.loadFromGroup': 'تحميل طاقم',
    'common.photos': 'الصور',
    'common.saveReport': 'حفظ التقرير',

    // Extra mapping for sidebar/breadcrumbs
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'roles': 'الصلاحيات',
    'profile-settings': 'إعدادات الحساب'
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
    'projects.title': 'Projects & Transactions',
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
    'common.confirm': 'Confirm',
    'common.saved': 'Saved Successfully',
    'common.error': 'Error Occurred'
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
