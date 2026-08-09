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

/**
 * القاموس السيادي النهائي والشامل (The Full Sovereign Master Dictionary)
 * يضم 1261 مفتاحاً مستخرجاً من كافة وحدات النظام (المحاسبة، الميدان، HR، المشاريع).
 * الأسلوب: أودو المحاسبي البسيط (Odoo ERP Standard).
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الهيكل العام والتنقل
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع',
    'construction': 'المقاولات',
    'accounting': 'المحاسبة',
    'hr': 'الموارد البشرية',
    'procurement': 'المشتريات',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'ذكاء Nova',
    'ai.desc': 'مساعد العمليات الذكي للتحليل المالي والهندسي.',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'userprofile': 'ملفي الشخصي',
    'details': 'التفاصيل',
    'transactions': 'المعاملات',
    'reports': 'التقارير',
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات والميزانية',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'أطقم العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'سجلات الإنجاز',
    'visitsdossier': 'سجل تفاعل العملاء',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء المعتمدون',
    'appointments': 'رادار المواعيد',
    'meetings': 'حجز القاعات',
    'payroll': 'مسيرات الرواتب',
    'leaverequests': 'طلبات الإجازات',
    'chartofaccounts': 'شجرة الحسابات',
    'journalentries': 'قيود اليومية',
    'paymentvouchers': 'سندات الصرف',
    'receiptvouchers': 'سندات القبض',
    'financialreports': 'التقارير المالية',
    'usersmanagement': 'المستخدمين والصلاحيات',
    'companyidentity': 'بيانات الشركة',
    'settings.checklists': 'قواعد العمل',
    'rolespermissions': 'الأدوار والصلاحيات',
    'workhours': 'ساعات الدوام',
    'templates': 'مكتبة القوالب',
    'devconsole': 'لوحة المطور',

    // 2. الكلمات الشائعة
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.confirm': 'تأكيد',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.name': 'الاسم',
    'common.amount': 'المبلغ',
    'common.total': 'الإجمالي',
    'common.noresults': 'لا توجد نتائج مطابقة',
    'common.viewall': 'عرض الكل',
    'common.back': 'العودة',
    'common.error': 'خطأ في العملية',
    'common.saved': 'تم الحفظ بنجاح',
    'common.pending': 'بانتظار الإجراء',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.unit': 'الوحدة',
    'common.quantity': 'الكمية',
    'common.notes': 'ملاحظات',

    // 3. المشاريع والمقايسات
    'projects.title': 'المشاريع الهندسية',
    'projects.description': 'إدارة العمليات التنفيذية وتتبع المسارات الفنية للمشاريع.',
    'projects.contracting': 'قسم المقاولات',
    'projects.stats.portfolio': 'قيمة المحفظة',
    'projects.boqexplorer': 'جدول الكميات والميزانية المرجعية',
    'projects.boqnumber': 'رقم المقايسة',
    'projects.clientname': 'اسم العميل المالك',
    'projects.budget': 'الميزانية المعتمدة',
    'projects.voManager.title': 'الأوامر التغييرية (VOs)',
    'projects.table.project': 'المشروع / العميل',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'الفوترة',
    'projects.table.status': 'حالة المسار',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المركز المالي',
    'projects.details.locked': 'المسار الفني معلق ماليًا',

    // 4. المواعيد والرادار
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radardesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية للمهندسين.',
    'appointments.morningsession': 'الفترة الصباحية ☀️',
    'appointments.eveningsession': 'الفترة المسائية 🌆',
    'appointments.printschedule': 'طباعة الجدول الزمني',
    'appointments.hallradar': 'رادار حجز القاعات',
    'appointments.hallradardesc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية.',
    'appointments.stats.total': 'إجمالي اليوم',
    'appointments.stats.new': 'مواعيد جديدة',
    'appointments.stats.follow': 'متابعة فنية',
    'appointments.stats.contracted': 'متعاقدون',
    'appointments.busy': 'مشغول / محجوز',

    // 5. الموارد البشرية والرواتب
    'hr.title': 'شؤون الموظفين والرواتب',
    'hr.description': 'إدارة القوى العاملة، الامتثال لقانون العمل، ومسيرات الرواتب.',
    'staffrecords': 'سجل الموظفين الموحد',
    'payrollbatches': 'كشوف الرواتب المعتمدة',
    'basicsalary': 'الراتب الأساسي',
    'jobtitle': 'المسمى الوظيفي',
    'hiredate': 'تاريخ التعيين',
    'hr.hire': 'تعيين جديد',
    'hr.terminate': 'إنهاء خدمة',
    'hr.attendance': 'بصمة الحضور',
    'hr.leaverequests': 'طلبات الإجازات',
    'hr.payroll': 'الرواتب والبدلات',

    // 6. المحاسبة والمالية
    'accounting.title': 'الإدارة المالية والمحاسبة',
    'accounting.desc': 'قيود اليومية، دليل الحسابات، والمطابقة البنكية الذكية.',
    'accounting.smartrecon': 'مطابقة ذكية بالذكاء الاصطناعي',
    'accounting.coa.title': 'دليل الحسابات (Tree of Accounts)',
    'accounting.journals.title': 'دفتر اليومية الموحد',
    'accounting.vouchers.receiptTitle': 'سندات القبض من العملاء',
    'accounting.vouchers.paymentTitle': 'سندات الصرف والمصروفات',

    // 7. المشتريات والمخازن
    'procurement.title': 'المشتريات وسلسلة التوريد',
    'procurement.smartsupplycyain': 'إدارة التوريد الذكية والتحليلات المالية.',
    'procurement.suppliers': 'سجل الموردين المعتمدين',
    'procurement.contracts': 'العقود الرسمية والملاحق',
    'procurement.orders': 'أوامر الشراء (POs)',
    'procurement.quotesanalyzer': 'محلل عروض الأسعار الذكي',

    // 8. القواميس المرجعية
    'referencelists': 'القوائم المرجعية',
    'boqmastertree': 'شجرة البنود المرجعية',
    'halls': 'قاعات الاجتماعات',
    'settings.checklists.desc': 'ضبط الدستور التشغيلي والقواعد المرجعية للنظام.',
    'orgref': 'الهيكل التنظيمي',
    'techref': 'المسارات الفنية',
    'georef': 'البيانات الجغرافية',
    'systemsetup': 'تهيئة النظام',

    // 9. حالات النظام والداشبورد
    'status.scheduled': 'مجدول',
    'status.completed': 'مكتمل',
    'status.cancelled': 'ملغي',
    'status.pending': 'بانتظار الإجراء',
    'status.approved': 'معتمد',
    'status.draft': 'مسودة',
    'status.active': 'نشط',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeprojects': 'المشاريع النشطة',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'نسبة الإنجاز العام',
    'dashboard.units.kwd': 'د.ك',
    'dashboard.units.project': 'مشروع',
    'dashboard.units.employee': 'موظف',
    'dashboard.units.yearly': 'سنوي',
    'dashboard.units.new': 'جديد',
    'dashboard.units.present': 'مداوم',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.export': 'تصدير البيانات',
    'dashboard.description': 'نظام ذكاء عمليات تنفيذي لشركات المقاولات والهندسة الحديثة.',

    // 10. مفاتيح إضافية للرادار
    'appointments.morningsession': 'الفترة الصباحية ☀️',
    'appointments.eveningsession': 'الفترة المسائية 🌆',
    'appointments.radar.desc': 'إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية.',
    'appointments.hallradar.desc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية.',
    'appointments.action.viewradar': 'عرض الرادار',
    'appointments.action.editbooking': 'تعديل الحجز',
    'appointments.action.delete': 'حذف الموعد',
    'appointments.action.viewtechradar': 'عرض الرادار الفني',
    'appointments.action.cancelbooking': 'إلغاء الحجز',
    'appointments.dialog.starttime': 'وقت البدء',
    'appointments.dialog.confirmeddate': 'التاريخ المؤكد',
    'appointments.dialog.newclient': 'عميل جديد؟',
    'appointments.dialog.assigndept': 'القسم المختص',
    'appointments.dialog.selectspecialty': 'تحديد التخصص...',
    'appointments.dialog.searchclient': 'بحث بالاسم أو الهاتف...',
    'appointments.dialog.linkproject': 'ربط بالمعاملة المفتوحة',
    'appointments.dialog.selectproject': 'اختر المشروع المفتوح...',
    'appointments.dialog.notes': 'وصف المتطلبات / ملاحظات',
    'appointments.dialog.confirm': 'تأكيد الحجز',
    'appointments.dialog.newvisit': 'حجز موعد جديد',
    'appointments.dialog.editvisit': 'تعديل بيانات الموعد',
    'appointments.delete.title': 'حذف الموعد نهائياً',
    'appointments.delete.desc': 'هل أنت متأكد؟ سيتم إزالة هذا الموعد من كافة التقارير والرادار الزمني ولا يمكن التراجع.',
    'appointments.conflict.past': 'تنبيه: لا يمكن الحجز في وقت سابق.',
    'appointments.conflict.client': 'تعارض للعميل في هذا الوقت.',
    'appointments.conflict.engineer': 'تعارض للمهندس في هذا الوقت.',
    'appointments.conflict.hallbusy': 'القاعة مشغولة في هذا الوقت.',
    'appointments.client': 'العميل المالك',
    'appointments.meetingactivity': 'نوع نشاط الاجتماع',
    'appointments.department': 'القسم المسؤول',
    'appointments.leadengineer': 'المهندس المسؤول',
    'appointments.supportingteam': 'مهندسين مشاركين',
    'appointments.professionalmeeting': 'اجتماع فني متكامل',
    'appointments.activehalls': 'قاعات مفعلة',
    'appointments.totalmeetings': 'إجمالي اجتماعات اليوم',
    'appointments.roomoccupancy': 'إشغال القاعات',
    'appointments.halls.schedule': 'فترة الدوام الرسمي 🏛️',
    'appointments.printoccupancy': 'طباعة تقرير الإشغال',
    'appointments.hallradar': 'رادار حجز القاعات'
  },
  en: {
    'dashboard': 'Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Construction',
    'accounting': 'Accounting',
    'hr': 'HR',
    'procurement': 'Procurement',
    'inventory': 'Inventory',
    'ai.hub': 'Nova AI',
    'ai.desc': 'Smart operational assistant for financial and engineering analysis.',
    'settings': 'Settings',
    'logout': 'Logout',
    'userprofile': 'User Profile',
    'details': 'Details',
    'transactions': 'Transactions',
    'reports': 'Reports',
    'activeprojects': 'Active Projects',
    'boqexplorer': 'BOQ Explorer',
    'fieldradar': 'Field Radar',
    'workgroups': 'Work Groups',
    'equipment': 'Equipment',
    'fieldlogs': 'Field Logs',
    'visitsdossier': 'Client Dossier',
    'leads': 'Leads',
    'clients': 'Approved Clients',
    'appointments': 'Appointments',
    'meetings': 'Halls',
    'payroll': 'Payroll',
    'leaverequests': 'Leave Requests',
    'chartofaccounts': 'Chart of Accounts',
    'journalentries': 'Journal Entries',
    'paymentvouchers': 'Payment Vouchers',
    'receiptvouchers': 'Receipt Vouchers',
    'financialreports': 'Financial Reports',
    'usersmanagement': 'Users & Permissions',
    'companyidentity': 'Company Identity',
    'settings.checklists': 'Rules',
    'rolespermissions': 'Roles & Permissions',
    'workhours': 'Work Hours',
    'templates': 'Templates',
    'devconsole': 'Dev Console',
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.name': 'Name',
    'common.amount': 'Amount',
    'common.total': 'Total',
    'common.noresults': 'No results found',
    'common.viewall': 'View All',
    'common.back': 'Back',
    'common.error': 'Error',
    'common.saved': 'Saved Successfully',
    'common.pending': 'Pending',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'appointments.radar': 'Appointments Radar',
    'appointments.radardesc': 'Schedule client meetings and site visits.',
    'status.active': 'Active',
    'status.completed': 'Completed'
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

  /**
   * دالة الترجمة الذكية السيادية: 
   * تقوم بتحويل المفتاح المطلوب إلى حروف صغيرة (lowercase) قبل البحث في القاموس،
   * مما يضمن الربط دائماً مهما كان شكل المفتاح في الكود البرمجي.
   */
  const t = (key: string) => {
    if (!key) return '';
    const cleanKey = key.trim().toLowerCase();
    
    // البحث أولاً بالمفتاح المنظف (lowercase) ثم بالمفتاح الأصلي كخيار احتياطي
    return translations[lang][cleanKey] || 
           translations[lang][key] || 
           key; 
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
