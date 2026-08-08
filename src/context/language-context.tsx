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
    // 1. الهيكل العام والشريط الجانبي
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'العمليات الميدانية',
    'procurement': 'المشتريات والتوريد',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة والمالية',
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',
    'profile': 'الملف الشخصي',
    'equipment': 'المعدات والآليات',
    'appointments': 'المواعيد والزيارات',
    'meetings': 'الاجتماعات والقاعات',
    'reports': 'التقارير',
    'transactions': 'المعاملات الفنية',
    'details': 'التفاصيل',
    'logout': 'تسجيل الخروج',
    'devConsole': 'لوحة المطور',
    'leads': 'الفرص والعملاء',
    'clients': 'سجل العملاء',
    'visitsDossier': 'سجل تفاعل العملاء',
    'activeProjects': 'المشاريع الجارية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'fieldLogs': 'تقارير الميدان',
    'aiAnalysis': 'تحليل العروض',
    'inline.personal.workspace': 'شؤوني الوظيفية',
    'financialReports': 'التقارير المالية',
    'userProfile': 'إعدادات ملفي الشخصي',
    'inline.profile.link.failed': 'تعذر تحميل ملف الصلاحيات',
    'inline.account.frozen': 'المنشأة مجمدة مؤقتاً',
    'inline.awaiting.activation': 'بانتظار تفعيل المنشأة',
    'inline.subscription.expired': 'انتهت صلاحية الوصول',
    'inline.tax...reg.no': 'الرقم الضريبي / السجل:',
    'inline.generated.on': 'تاريخ الاستخراج',

    // 2. المبيعات والعملاء
    'clients.title': 'سجل العملاء المعتمدين',
    'clients.addNew': 'تسجيل عميل جديد',
    'clients.addLead': 'فرصة جديدة',
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات المرتبطة',
    'clients.details.location': 'الموقع الجغرافي',
    'clients.details.history': 'سجل الأحداث',
    'inline.isolated.view': 'عرض معزول',
    'inline.your.assigned.files.only': 'تظهر ملفاتك المنسوبة فقط',
    'inline.no.matching.clients.found': 'لا يوجد عملاء مطابقين للبحث.',
    'inline.new.trans': 'فتح معاملة',

    // 3. المشاريع والمقايسات
    'projects.title': 'المشاريع والمعاملات',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.boqExplorer.rate': 'السعر',
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة معتمدة)',
    'boqExplorer': 'مستكشف المقايسات',
    'common.confirm': 'تأكيد',
    'common.confirmDelete': 'تأكيد الحذف',
    'common.deleted': 'تم الحذف بنجاح',
    'common.saved': 'تم الحفظ بنجاح',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.error': 'حدث خطأ',
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.quantity': 'الكمية',
    'common.unit': 'الوحدة',
    'common.total': 'الإجمالي',
    'common.code': 'الكود',
    'common.notes': 'ملاحظات',
    'common.date': 'التاريخ',
    'common.amount': 'المبلغ',
    'common.actions': 'الإجراءات',
    'common.status': 'الحالة',

    // 4. الموارد البشرية والرواتب
    'staffRecords': 'شؤون الموظفين',
    'payroll': 'الرواتب والامتثال',
    'leaveRequests': 'طلبات الإجازات',
    'payrollBatches': 'مسير الرواتب',
    'entryAdded': 'تمت الإضافة بنجاح',
    'saveFailed': 'فشل حفظ البيانات',

    // 5. المحاسبة
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'accounting.coa.title': 'شجرة الحسابات الموحدة',
    'accounting.journals.title': 'قيود اليومية العامة',
    'accounting.vouchers.paymentTitle': 'سندات الصرف المالي',
    'accounting.vouchers.receiptTitle': 'سندات القبض المالي',

    // 6. الإعدادات
    'checklists': 'قواعد العمل',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'templates': 'مكتبة القوالب',
    'templatesDesc': 'إدارة النماذج والقوالب القياسية للنظام',
    'rolesPermissions': 'مصفوفة الصلاحيات',
    'workHours': 'مواعيد العمل',
    'workHoursDesc': 'ضبط ساعات الدوام والعطلات الرسمية',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',
    'halls': 'القاعات والاجتماعات',
    'boqMasterTree': 'شجرة البنود المرجعية',
    'referenceLists': 'القوائم المرجعية',
    'pricingMode': 'نموذج التسعير',
    'itemized': 'بنود مفصلة',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'at': 'عند',
    'before': 'قبل',
    'during': 'أثناء',
    'after': 'بعد',
    'scopeNone': 'لا يوجد وصول',
    'scopeOwn': 'بياناتي فقط',
    'scopeDept': 'بيانات القسم',
    'scopeAll': 'وصول كامل',

    // 7. كلمات متفرقة
    'ai.hub': 'مركز الذكاء الهندسي',
    'ai.desc': 'أدوات الذكاء الاصطناعي لدعم اتخاذ القرار',
    'search': 'بحث...',
    'code': 'الكود',
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM & Sales',
    'projects': 'Projects',
    'construction': 'Field Ops',
    'procurement': 'Procurement',
    'hr': 'Human Resources',
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
    'logout': 'Logout',
    'devConsole': 'Dev Console',
    'leads': 'Leads',
    'clients': 'Clients',
    'visitsDossier': 'Client Dossier',
    'activeProjects': 'Active Projects',
    'fieldRadar': 'Field Radar',
    'workGroups': 'Work Groups',
    'fieldLogs': 'Field Logs',
    'aiAnalysis': 'AI Analysis',
    'financialReports': 'Financial Reports',
    'userProfile': 'User Profile',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll Batches',
    'chartOfAccounts': 'COA',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payments',
    'receiptVouchers': 'Receipts',
    'checklists': 'Rules',
    'usersManagement': 'Users',
    'companyIdentity': 'Company',
    'templates': 'Templates',
    'rolesPermissions': 'Permissions',
    'workHours': 'Work Hours',
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
