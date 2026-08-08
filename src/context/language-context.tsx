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
    // 1. الهيكل العام والشريط الجانبي (Layout, Sidebar & Navigation)
    'inline.profile.link.failed': 'تعذر تحميل ملف الصلاحيات',
    'inline.account.frozen': 'المنشأة مجمدة مؤقتاً',
    'inline.awaiting.activation': 'بانتظار تفعيل المنشأة',
    'inline.subscription.expired': 'انتهت صلاحية الوصول',
    'logout': 'تسجيل الخروج',
    'devConsole': 'لوحة المطور',
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
    'details': 'التفاصيل',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'visitsDossier': 'سجل تفاعل العملاء',
    'activeProjects': 'المشاريع الجارية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'fieldLogs': 'تقارير الميدان',
    'aiAnalysis': 'تحليل العروض',
    'inline.personal.workspace': 'شؤوني الوظيفية',
    'financialReports': 'التقارير المالية',
    'userProfile': 'إعدادات ملفي الشخصي',
    'inline.tax...reg.no': 'الرقم الضريبي / السجل:',
    'inline.generated.on': 'تاريخ الاستخراج',

    // 2. المحاسبة والمالية (Accounting)
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'accounting.coa.title': 'شجرة الحسابات',
    'accounting.journals.title': 'قيود اليومية',
    'accounting.vouchers.paymentTitle': 'سندات الصرف',
    'accounting.vouchers.receiptTitle': 'سندات القبض',

    // 3. المشاريع وجداول الكميات (Projects & BOQs)
    'projects.title': 'المشاريع والمعاملات',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية التقديرية',
    'projects.status': 'الحالة',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مرتبطة بهذا المشروع.',
    'projects.boqExplorer.rate': 'السعر',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.voTitle': 'عنوان الأمر التغييري',
    'projects.voManager.reason': 'السبب الفني للتعديل',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.voManager.increase': 'زيادة كمية',
    'projects.voManager.decrease': 'نقص كمية',
    'projects.voManager.omit': 'إلغاء بند',
    'projects.voManager.newItem': 'بند جديد بالكامل',
    'projects.voManager.targetItem': 'البند المستهدف',
    'projects.voManager.deltaQty': 'فارق الكمية',
    'projects.voManager.financialSection': 'القسم المالي',
    'projects.voManager.executionPath': 'مسار التنفيذ',
    'projects.voManager.linkExisting': 'ربط بمرحلة حالية',
    'projects.voManager.injectNew': 'حقن مرحلة جديدة',
    'projects.voManager.stageName': 'اسم المرحلة الجديدة',
    'projects.voManager.stageCode': 'كود المرحلة',
    'projects.voManager.insertAfter': 'إدراج بعد مرحلة',
    'projects.voManager.parallel': 'مرحلة تكميلية (موازية)؟',
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار مقفل (يتطلب عقداً ومقايسة معتمدة)',
    'boqExplorer': 'مستكشف المقايسات',

    // 4. المشتريات (Procurement)
    'suppliers': 'الموردون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود',
    'aiAnalysis': 'تحليل العروض',
    'totalQuoteValue': 'إجمالي قيمة العرض',
    'pricingMode': 'نموذج التسعير',
    'itemized': 'بنود مفصلة',
    'fixed': 'مبلغ مقطوع',
    'percentage': 'نسبة مئوية',
    'convertToContract': 'تحويل إلى عقد رسمي',

    // 5. الموظفون (HR)
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'payrollBatches': 'مسير الرواتب',

    // 6. العملاء (CRM)
    'clients.title': 'سجل العملاء',
    'clients.addNew': 'عميل جديد',
    'clients.addLead': 'فرصة جديدة',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات المرتبطة',
    'clients.details.location': 'الموقع الجغرافي',
    'clients.details.history': 'سجل الأحداث',

    // 7. الإعدادات وقواعد العمل (Settings)
    'checklists': 'قواعد العمل',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة',
    'companyProfile': 'ملف الشركة',
    'commercialRegistry': 'السجل التجاري',
    'logo': 'شعار الشركة',
    'templates': 'القوالب',
    'templatesDesc': 'إدارة القوالب والنماذج القياسية',
    'workHours': 'مواعيد العمل',
    'workHoursDesc': 'ضبط ساعات الدوام والعطلات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',
    'referenceLists': 'القوائم المرجعية',
    'boqMasterTree': 'شجرة البنود المرجعية',
    'halls': 'القاعات والاجتماعات',
    'rolesRef': 'مصفوفة الصلاحيات',
    'personalInfo': 'البيانات الشخصية',

    // 8. المساعد الذكي (AI)
    'ai.hub': 'مركز الذكاء الهندسي',
    'ai.desc': 'أدوات الذكاء الاصطناعي لدعم القرار',

    // 9. عام (Common)
    'common.add': 'إضافة',
    'common.addLabel': 'إضافة بند',
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
    'common.error': 'حدث خطأ',
    'common.saved': 'تم الحفظ بنجاح',
    'common.close': 'إغلاق',
    'common.pending': 'بانتظار الإجراء',
    'at': 'عند',
    'before': 'قبل',
    'during': 'أثناء',
    'after': 'بعد',
    'scopeNone': 'لا يوجد وصول',
    'scopeOwn': 'بياناتي فقط',
    'scopeDept': 'بيانات القسم',
    'scopeAll': 'وصول كامل',
    'contractSigning': 'توقيع العقد',
    'saved': 'تم الحفظ'
  },
  en: {
    // Navigation
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Field Service',
    'procurement': 'Purchase',
    'hr': 'Employees',
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
    'clients': 'Contacts',
    'visitsDossier': 'Client Dossier',
    'activeProjects': 'Active Projects',
    'fieldRadar': 'Field Radar',
    'workGroups': 'Work Groups',
    'fieldLogs': 'Field Logs',
    'aiAnalysis': 'AI Analysis',
    'financialReports': 'Financial Reports',
    'userProfile': 'User Profile',
    
    // Accounting
    'chartOfAccounts': 'Chart of Accounts',
    'journalEntries': 'Journal Entries',
    'paymentVouchers': 'Payment Vouchers',
    'receiptVouchers': 'Receipt Vouchers',
    'financialReports': 'Financial Reports',

    // Procurement
    'suppliers': 'Vendors',
    'purchaseOrders': 'Purchase Orders',
    'contracts': 'Contracts',

    // HR
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'payrollBatches': 'Payroll Batches',

    // CRM & Settings
    'clients': 'Contacts',
    'settings': 'Settings',
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
