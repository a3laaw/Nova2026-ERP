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
    // 1. الهيكل العام (Navigation)
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.export': 'تصدير التقارير',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'المهام الميدانية',
    'dashboard.stats.revenue': 'الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'الموظفون',
    'dashboard.stats.completion': 'نسبة الإنجاز',
    'devConsole': 'لوحة تحكم المطور',
    'logout': 'تسجيل الخروج',

    // 2. المبيعات والعملاء (CRM)
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'clients.title': 'سجل العملاء',
    'clients.addNew': 'عميل جديد',
    'clients.addLead': 'فرصة جديدة',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المسؤول',
    'clients.table.contact': 'التواصل',
    'clients.table.status': 'الحالة',
    'clients.details.history': 'سجل النشاطات',
    'clients.details.location': 'الموقع الجغرافي',
    'clients.details.transactions': 'المشاريع والمعاملات',
    'addLead': 'فرصة جديدة',

    // 3. المشاريع والمقايسات (Projects & BOQs)
    'projects': 'المشاريع',
    'projects.title': 'المشاريع والمعاملات',
    'projects.radar': 'متابعة المشاريع',
    'projects.addNew': 'مشروع جديد',
    'projects.contracting': 'قسم المقاولات',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة لهذا المشروع.',
    'projects.details.radar': 'متابعة التنفيذ',
    'projects.details.finance': 'المالية والعقود',
    'projects.details.locked': 'المسار مقفل: يتطلب اعتماد العقد والمقايسة',
    'projects.voManager.title': 'أوامر التغيير (VOs)',
    'projects.voManager.addAdjustment': 'إضافة تعديل',
    'projects.voManager.confirmVO': 'اعتماد أمر التغيير',
    'projects.voManager.voTitle': 'عنوان الأمر التغييري',
    'projects.voManager.reason': 'سبب التغيير',
    'projects.voManager.increase': 'زيادة كمية',
    'projects.voManager.decrease': 'نقص كمية',
    'projects.voManager.omit': 'إلغاء بند',
    'projects.voManager.newItem': 'بند جديد',
    'projects.voManager.targetItem': 'البند المستهدف',
    'projects.voManager.deltaQty': 'فارق الكمية',
    'projects.voManager.financialSection': 'القسم المالي',
    'projects.voManager.executionPath': 'مسار التنفيذ',
    'projects.voManager.linkExisting': 'ربط بمرحلة قائمة',
    'projects.voManager.injectNew': 'حقن مرحلة جديدة',
    'projects.voManager.stageName': 'اسم المرحلة',
    'projects.voManager.stageCode': 'كود المرحلة',
    'projects.voManager.insertAfter': 'إدراج بعد',
    'projects.voManager.parallel': 'مرحلة موازية',
    'projects.boqExplorer.sections': 'الأقسام',
    'projects.boqExplorer.rate': 'السعر',
    'projects.stats.portfolio': 'قيمة المشاريع',
    'projects.stats.claims': 'المطالبات المالية',
    'projects.stats.collection': 'نسبة التحصيل',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'الموقف المالي',

    // 4. الخدمات الميدانية والمعدات (Field Ops)
    'construction': 'الخدمات الميدانية',
    'construction.radar': 'الرادار الميداني',
    'construction.groups': 'فرق العمل',
    'construction.reports': 'تقارير الإنجاز',
    'construction.equipment': 'سجل المعدات والآليات',
    'construction.context': 'السياق التشغيلي',
    'construction.siteProgress': 'إنجاز الموقع',
    'equipment': 'المعدات والآليات',
    'inventory': 'المخزون والعهد',
    'appointments': 'المواعيد والزيارات',
    'meetings': 'الاجتماعات والقاعات',
    'visitsDossier': 'سجل الزيارات الشامل',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'فرق العمل الميدانية',
    'fieldLogs': 'سجلات الموقع',

    // 5. الموظفون والرواتب (HR & Payroll)
    'hr': 'الموظفون والرواتب',
    'staffRecords': 'سجل الموظفين',
    'payroll': 'الرواتب والامتثال',
    'payrollBatches': 'مسير الرواتب',
    'leaveRequests': 'طلبات الإجازات',
    'userProfile': 'الملف الشخصي',
    'basicSalary': 'الراتب الأساسي',
    'jobTitle': 'المسمى الوظيفي',

    // 6. المحاسبة والمالية (Accounting)
    'accounting': 'المحاسبة والمالية',
    'chartOfAccounts': 'شجرة الحسابات',
    'journalEntries': 'قيود اليومية',
    'paymentVouchers': 'سندات الصرف',
    'receiptVouchers': 'سندات القبض',
    'financialReports': 'التقارير المالية',

    // 7. المشتريات والموردين (Procurement)
    'procurement': 'المشتريات والتوريد',
    'suppliers': 'الموردون المعتمدون',
    'purchaseOrders': 'أوامر الشراء',
    'contracts': 'العقود الرسمية',
    'aiAnalysis': 'تحليل عروض الأسعار',

    // 8. الإعدادات والقوالب (Settings & Templates)
    'settings': 'الإعدادات',
    'settings.checklists': 'قواعد العمل والمسارات',
    'checklists': 'قواعد العمل المعتمدة',
    'usersManagement': 'المستخدمون والصلاحيات',
    'companyIdentity': 'بيانات الشركة والمظهر',
    'rolesPermissions': 'مصفوفة الأدوار',
    'workHours': 'مواعيد العمل والعطلات',
    'workHoursDesc': 'ضبط فترات الدوام الرسمي والراحة والعطلات.',
    'templates': 'مكتبة القوالب',
    'templatesDesc': 'إدارة النماذج المرجعية للمستندات والعقود والمقايسات.',
    'manageLibrary': 'إدارة المكتبة',
    'quotationTemplates': 'قوالب عروض الأسعار',
    'contractTemplates': 'قوالب العقود الرسمية',
    'boqTemplates': 'قوالب جداول الكميات',
    'quotationTemplates.desc': 'بناء قوالب تسعير مرنة مع صلاحيات العرض وشروط الدفع.',
    'contractTemplates.desc': 'صياغة العقود القانونية وربط الدفعات المالية بالمراحل الفنية.',
    'boqTemplates.desc': 'توصيف بنود الأعمال الهندسية، الكميات، والأسعار المرجعية.',
    'rolesRef': 'قوالب الصلاحيات',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',
    'boqMasterTree': 'شجرة المقايسات الموحدة',
    'halls': 'قاعات الاجتماعات',
    'referenceLists': 'القوائم المرجعية',

    // 9. الكلمات العامة (Common)
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.save': 'حفظ البيانات',
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
    'common.error': 'حدث خطأ تقني',
    'common.name': 'الاسم',
    'common.company': 'المنشأة',
    'common.contact': 'الاتصال',
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
    'common.addLabel': 'إضافة بند',

    // 10. المساعد الذكي (AI)
    'ai.hub': 'مركز Nova للذكاء الهندسي',
    'ai.desc': 'تحليل ذكي للبيانات المالية والهندسية لدعم اتخاذ القرار.',
    'aiAnalysis': 'التحليل الذكي'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Dashboard',
    'dashboard.export': 'Export Reports',
    'dashboard.recent': 'Recent Activity',
    'dashboard.missions': 'Field Tasks',
    'crm': 'CRM & Sales',
    'leads': 'Opportunities',
    'clients': 'Contacts',
    'projects': 'Projects',
    'projects.title': 'Projects & Transactions',
    'projects.boqExplorer': 'BOQ & Budget',
    'construction': 'Field Operations',
    'procurement': 'Procurement',
    'hr': 'HR & Payroll',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'accounting': 'Accounting',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'templates': 'Templates',
    'manageLibrary': 'Manage Library',
    'quotationTemplates': 'Quotation Templates',
    'contractTemplates': 'Contract Templates',
    'boqTemplates': 'BOQ Templates',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.status': 'Status',
    'common.total': 'Total'
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
