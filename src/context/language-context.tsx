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
 * القاموس الشامل والمسطح (Flat Master Dictionary) - إصدار Nova2026-ERP
 * تم اعتماده بناءً على المواصفات القياسية (Odoo Style).
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 📁 1. الهيكل العام والملاحة
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'leads': 'الفرص والعملاء المحتملين',
    'clients': 'سجل العملاء المعتمدين',
    'appointments': 'رادار المواعيد والزيارات',
    'meetings': 'حجز القاعات والاجتماعات',
    'visitsDossier': 'سجل تفاعل العملاء (Dossier)',
    'projects': 'المشاريع والمعاملات',
    'activeProjects': 'المشاريع الجارية',
    'boqExplorer': 'مستكشف المقايسات والميزانيات',
    'reports': 'التقارير والرقابة',
    'construction': 'العمليات الميدانية',
    'fieldRadar': 'الرادار الميداني',
    'workGroups': 'مجموعات العمل',
    'equipment': 'سجل المعدات والآليات',
    'fieldLogs': 'تقارير الميدان',
    'procurement': 'المشتريات والتوريد',
    'suppliers': 'الموردين المعتمدين',
    'contracts': 'العقود الرسمية والملاحق',
    'aiAnalysis': 'تحليل العروض بالذكاء الاصطناعي',
    'hr': 'الموارد البشرية',
    'staffRecords': 'سجل شؤون الموظفين',
    'leaveRequests': 'طلبات الإجازات السنوية',
    'payrollBatches': 'مسيرات الرواتب الشهرية',
    'accounting': 'المحاسبة والمالية',
    'chartOfAccounts': 'دليل الحسابات الموحد',
    'receiptVouchers': 'سندات القبض المالية',
    'paymentVouchers': 'سندات الصرف والمدفوعات',
    'journalEntries': 'قيود اليومية المزدوجة',
    'financialReports': 'التقارير والقوائم المالية',
    'inventory': 'المخازن والعهد',
    'settings': 'إعدادات النظام',
    'usersManagement': 'إدارة مستخدمي النظام',
    'companyIdentity': 'هوية المنشأة والمظهر',
    'checklists': 'الدستور التشغيلي',
    'rolesPermissions': 'مصفوفة الصلاحيات والأدوار',
    'workHours': 'مواعيد العمل والعطلات',
    'userProfile': 'إعدادات ملفي الشخصي',
    'systemSetup': 'تهيئة النظام (Seed)',
    'templates': 'مكتبة القوالب الفنية',
    'referenceLists': 'القوائم المرجعية الموحدة',
    'boqMasterTree': 'شجرة بنود الأعمال المرجعية',
    'halls': 'إدارة قاعات الاجتماعات',
    'orgRef': 'الهيكل التنظيمي المرجعي',
    'techRef': 'هندسة المسارات الفنية',
    'geoRef': 'المرجع الجغرافي (الكويت)',
    'logout': 'تسجيل الخروج',
    'devConsole': 'لوحة تحكم المطور',
    'details': 'تفاصيل',
    'transactions': 'المعاملات',

    // 📁 2. لوحة التحكم (Dashboard)
    'dashboard.title': 'لوحة التحكم القيادية',
    'dashboard.export': 'تصدير التقارير',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.missions': 'مهمات ميدانية متأخرة',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'معدل الإنجاز',

    // 📁 3. المشاريع والـ BOQ
    'projects.title': 'المشاريع والمعاملات الفنية',
    'projects.radar': 'رادار تتبع العمليات المفتوحة',
    'projects.addNew': 'فتح معاملة جديدة',
    'projects.contracting': 'قسم المقاولات فقط',
    'projects.boqExplorer': 'مستكشف المقايسات والميزانيات',
    'projects.boqExplorer.noBoqs': 'لا توجد مقايسات مسجلة حالياً لهذه المعاملة',
    'projects.details.radar': 'رادار التنفيذ الميداني',
    'projects.details.finance': 'المالية والوثائق',
    'projects.details.locked': 'المسار الفني مقفل (يتطلب عقداً ومقايسة معتمدة)',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'اسم العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',

    // 📁 4. العملاء (CRM)
    'clients.title': 'سجل العملاء المعتمدين',
    'clients.addNew': 'تسجيل عميل جديد',
    'clients.table.profile': 'ملف العميل',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'الاتصال',
    'clients.table.status': 'الحالة',
    'clients.details.transactions': 'المعاملات الجارية',
    'clients.details.location': 'الموقع والعنوان',
    'clients.details.history': 'سجل التفاعلات',

    // 📁 5. الشؤون الإدارية (HR)
    'payroll': 'نظام الرواتب والامتثال',
    'staff.records': 'سجل شؤون الموظفين',
    'leave.requests': 'طلبات الإجازات',
    'addLead': 'إضافة فرصة',
    'company': 'المنشأة',
    'status': 'الحالة',
    'name': 'الاسم',
    'code': 'الكود',
    'order': 'الترتيب',
    'symbol': 'الرمز',
    'category': 'الفئة',
    'isActive': 'نشط؟',

    // 📁 6. Common
    'common.search': 'بحث سريع في السجلات...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ البيانات',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف نهائي',
    'common.edit': 'تعديل',
    'common.addLabel': 'إضافة بند',
    'common.quantity': 'الكمية',
    'common.notes': 'ملاحظات',
    'common.labor': 'العمالة',
    'common.loadFromGroup': 'تحميل من مجموعة',
    'common.equipment': 'المعدات',
    'common.close': 'إغلاق',
    'common.confirm': 'تأكيد',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.saved': 'تم الحفظ بنجاح',
    'common.deleted': 'تم الحذف بنجاح',
    'common.error': 'حدث خطأ غير متوقع',
    'common.pending': 'قيد الانتظار',

    // 📁 7. المساعد الذكي
    'ai.hub': 'مركز Nova للذكاء الهندسي',
    'ai.desc': 'تحليلات GenAI المتقدمة للمشتريات والمالية والميدان.',

    // 📁 8. Inline Keys (Required for UI logic)
    'inline.account.frozen': 'المنشأة مجمدة مؤقتاً',
    'inline.awaiting.activation': 'بانتظار تفعيل المنشأة',
    'inline.subscription.expired': 'انتهت صلاحية الوصول',
    'inline.personal.workspace': 'شؤوني الوظيفية',
    'inline.official.engineering.contract': 'عقد خدمات هندسية رسمي',
    'inline.contract.signing': 'توقيع العقد'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.title': 'Executive Dashboard',
    'crm': 'CRM',
    'projects': 'Projects',
    'construction': 'Field Operations',
    'procurement': 'Procurement',
    'hr': 'Human Resources',
    'accounting': 'Accounting',
    'inventory': 'Inventory',
    'settings': 'Settings',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'logout': 'Logout'
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
    return translations[lang][key] || key;
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
