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

// القاموس الموحد الشامل - أسلوب أودو ERP الرشيق (Odoo Standard)
// تم تسطيح المفاتيح بالكامل لمنع أي فشل في البحث اللغوي
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
    'appointments': 'المواعيد والزيارات',
    'meetings': 'حجز القاعات والاجتماعات',
    'visitsDossier': 'سجل تفاعل العملاء',

    // 3. المشاريع وجداول الكميات وأوامر التغيير (Projects & BOQs)
    'projects': 'المشاريع والمعاملات',
    'projects.title': 'المشاريع الجارية',
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
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة)',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'boqExplorer': 'مستكشف المقايسات',
    'boqMasterTree': 'شجرة المقايسات',

    // 4. الخدمات الميدانية والموردين والمشتريات (Field Ops & Purchasing)
    'construction': 'العمليات الميدانية',
    'construction.radar': 'الرادار الميداني',
    'construction.groups': 'فرق العمل',
    'construction.reports': 'تقارير الموقع',
    'construction.equipment': 'سجل المعدات والآليات',
    'procurement': 'المشتريات والتوريد',
    'suppliers': 'الموردون',
    'contracts': 'العقود',
    'purchaseOrders': 'أوامر الشراء',
    'aiAnalysis': 'تحليل العروض',

    // 5. الموظفون والرواتب (HR & Payroll)
    'hr': 'الموارد البشرية',
    'staffRecords': 'شؤون الموظفين',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',
    'payroll': 'الرواتب',
    'hr.attendance.title': 'سجل الحضور والإنصراف',
    'hr.gratuity.title': 'حاسبة نهاية الخدمة',

    // 6. المحاسبة والمالية (Accounting)
    'accounting': 'المحاسبة والمالية',
    'chartOfAccounts': 'شجرة الحسابات',
    'receiptVouchers': 'سندات القبض',
    'paymentVouchers': 'سندات الصرف',
    'journalEntries': 'قيود اليومية',
    'financialReports': 'التقارير المالية',

    // 7. المخزون والإعدادات (Inventory & Settings)
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',
    'settings.checklists': 'قواعد العمل',
    'usersManagement': 'إدارة المستخدمين',
    'companyIdentity': 'بيانات الشركة',
    'companyProfile': 'هوية المنشأة',
    'checklists': 'قواعد العمل',
    'rolesPermissions': 'الأدوار والصلاحيات',
    'workHours': 'ساعات العمل والعطلات',
    'userProfile': 'الملف الشخصي',
    'templates': 'مكتبة القوالب',
    'equipment': 'المعدات والآليات',
    'halls': 'قاعات الاجتماعات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',
    'referenceLists': 'القوائم المرجعية',

    // 8. القوائم المرجعية (Reference Details)
    'unitTypes': 'وحدات القياس',
    'paymentMethods': 'طرق الدفع',
    'paymentConditionTypes': 'شروط الدفع',
    'milestoneTimingTypes': 'توقيت الدفعات',
    'itemCategories': 'تصنيفات الأصناف',
    'costTypeCategories': 'تصنيفات التكلفة',

    // 9. كلمات عامة (Common Terms)
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
    'common.pending': 'بانتظار الإجراء',
    'common.viewAll': 'عرض الكل',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'reports.title': 'مركز التقارير'
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
    'staffRecords': 'Employees',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll',
    'chartOfAccounts': 'Chart of Accounts',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.search': 'Search...',
    'common.filter': 'Filter'
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

  /**
   * دالة الترجمة الآمنة (The Safe Translator)
   * تضمن عدم ظهور أكواد برمجية في حال فقدان الترجمة
   */
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