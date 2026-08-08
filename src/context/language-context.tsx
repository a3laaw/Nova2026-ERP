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

const translations: Record<Language, Record<string, any>> = {
  ar: {
    // Common & Layout
    dashboard: 'لوحة التحكم',
    crm: 'العملاء والفرص',
    leads: 'الفرص والمبيعات',
    clients: 'قاعدة بيانات العملاء',
    projects: {
      title: 'المشاريع والمعاملات',
      radar: 'رادار المشاريع',
      contracting: 'قسم المقاولات',
      addNew: 'فتح معاملة جديدة',
      boqExplorer: 'مستكشف المقايسات',
      boqNumber: 'رقم المقايسة',
      clientName: 'اسم العميل',
      budget: 'الميزانية',
      status: 'الحالة',
      details: {
        radar: 'رادار التنفيذ',
        finance: 'المالية والوثائق',
        locked: 'المسار الفني مقفل',
        transactions: 'المعاملات المرتبطة',
        location: 'موقع المشروع',
        history: 'سجل الحركات'
      },
      table: {
        project: 'المشروع / العميل',
        progress: 'نسبة الإنجاز',
        billing: 'التحصيل المالي',
        status: 'حالة المشروع'
      },
      stats: {
        portfolio: 'إجمالي المحفظة',
        claims: 'المطالبات المالية',
        collection: 'نسبة التحصيل'
      }
    },
    construction: {
      radar: 'الرادار الميداني',
      groups: 'مجموعات العمل',
      equipment: 'سجل المعدات والآليات',
      reports: 'تقارير الميدان',
      context: 'السياق التشغيلي',
      siteProgress: 'توثيق الإنجاز الميداني'
    },
    procurement: 'المشتريات والتوريد',
    hr: 'الموارد البشرية',
    accounting: 'المحاسبة والمالية',
    inventory: 'المخازن والعهد',
    reports: 'التقارير والرقابة',
    settings: {
      title: 'الإعدادات',
      checklists: 'الدستور التشغيلي'
    },
    save: 'حفظ البيانات',
    cancel: 'إلغاء',
    edit: 'تعديل',
    delete: 'حذف',
    search: 'بحث...',
    actions: 'إجراءات',
    loading: 'جاري التحميل...',
    details: 'تفاصيل',
    new: 'إضافة جديد',
    confirm: 'تأكيد',
    all: 'الكل',
    active: 'نشط',
    completed: 'مكتمل',
    pending: 'قيد الانتظار',
    status: 'الحالة',
    date: 'التاريخ',
    value: 'القيمة',
    filter: 'تصفية',
    summary: 'ملخص',
    viewAll: 'عرض الكل',
    close: 'إغلاق',
    post: 'ترحيل',
    saved: 'تم الحفظ بنجاح',
    deleted: 'تم الحذف بنجاح',
    error: 'خطأ في النظام',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    isActive: 'نشط',
    order: 'الترتيب',
    name: 'الاسم',
    code: 'الكود',
    description: 'الوصف',
    logout: 'تسجيل الخروج',
    
    // Core Keys
    checklists: 'الدستور التشغيلي',
    templates: 'مكتبة القوالب',
    rolesRef: 'مصفوفة الصلاحيات',
    profile: 'الملف الشخصي',
    userProfile: 'الملف الشخصي',
    companyIdentity: 'هوية الشركة',
    usersManagement: 'إدارة المستخدمين',
    workHours: 'مواعيد العمل',
    systemSetup: 'تأسيس النظام',

    // Pricing Modes
    itemized: 'تسعير بنود',
    fixed: 'مبلغ مقطوع',
    percentage: 'نسبة مئوية',
    pricingMode: 'نمط التسعير',
    totalQuoteValue: 'إجمالي قيمة العقد النهائية',
    defaultTerms: 'الشروط والأحكام العامة',
    contractSigning: 'توقيع العقد',
    at: 'عند',
    before: 'قبل',
    during: 'أثناء',
    after: 'بعد',
    amount: 'المبلغ',
    unit: 'الوحدة',
    quantity: 'الكمية',
    notes: 'ملاحظات',
    technicalLink: 'الارتباط الفني',
    milestoneTiming: 'توقيت الاستحقاق',

    // Checklists & Settings Tabs
    referenceLists: 'القوائم المرجعية',
    boqMasterTree: 'شجرة الأعمال',
    halls: 'القاعات',
    orgRef: 'الهيكل التنظيمي',
    techRef: 'المسارات الفنية',
    geoRef: 'البيانات الجغرافية',
    templatesLibrary: 'مكتبة القوالب',
    rolesPermissions: 'مصفوفة الصلاحيات',

    // Specific Modules
    unitTypes: 'وحدات القياس',
    paymentMethods: 'طرق الدفع',
    paymentConditionTypes: 'شروط الدفع',
    milestoneTimingTypes: 'توقيت الدفعات',
    itemCategories: 'تصنيفات الأصناف',
    costTypeCategories: 'تصنيفات التكلفة',
    
    // HR
    staffRecords: 'سجل الموظفين',
    leaveRequests: 'طلبات الإجازات',
    payrollBatches: 'مسيرات الرواتب',
    indemnity: 'نهاية الخدمة',
    attendanceLogs: 'البصمة والحضور',
    permissions: 'الاستئذانات',

    // New Keys
    manageCompanyData: 'إدارة بيانات المنشأة والهوية البصرية',
    templatesDesc: 'نماذج العقود، عروض الأسعار، وجداول الكميات المرجعية.',
    workHoursDesc: 'ضبط فترات الدوام، العطلات الرسمية، وقواعد البصمة.'
  },
  en: {
    dashboard: 'Dashboard',
    crm: 'CRM',
    leads: 'Leads',
    clients: 'Clients',
    projects: {
      title: 'Projects & Transactions',
      radar: 'Project Radar',
      contracting: 'Contracting Div',
      addNew: 'New Transaction',
      boqExplorer: 'BOQ Explorer',
      boqNumber: 'BOQ Number',
      clientName: 'Client Name',
      budget: 'Budget',
      status: 'Status',
      details: {
        radar: 'Execution Radar',
        finance: 'Finance & Docs',
        locked: 'Technical Path Locked',
        transactions: 'Related Transactions',
        location: 'Project Location',
        history: 'Audit Log'
      },
      table: {
        project: 'Project / Client',
        progress: 'Progress %',
        billing: 'Financial Billing',
        status: 'Project Status'
      },
      stats: {
        portfolio: 'Portfolio Value',
        claims: 'Financial Claims',
        collection: 'Collection Rate'
      }
    },
    construction: {
      radar: 'Field Radar',
      groups: 'Work Groups',
      equipment: 'Equipment Master',
      reports: 'Field Logs',
      context: 'Operational Context',
      siteProgress: 'Site Progress Log'
    },
    procurement: 'Procurement',
    hr: 'Human Resources',
    accounting: 'Accounting',
    inventory: 'Inventory',
    reports: 'Reports',
    settings: {
      title: 'Settings',
      checklists: 'Operational Checklists'
    },
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search...',
    actions: 'Actions',
    loading: 'Loading...',
    details: 'Details',
    new: 'Add New',
    confirm: 'Confirm',
    all: 'All',
    active: 'Active',
    completed: 'Completed',
    pending: 'Pending',
    status: 'Status',
    date: 'Date',
    value: 'Value',
    filter: 'Filter',
    summary: 'Summary',
    viewAll: 'View All',
    close: 'Close',
    post: 'Post',
    saved: 'Saved Successfully',
    deleted: 'Deleted Successfully',
    error: 'System Error',
    confirmDelete: 'Are you sure?',
    isActive: 'Active',
    order: 'Order',
    name: 'Name',
    code: 'Code',
    description: 'Description',
    logout: 'Logout',

    checklists: 'Checklists',
    templates: 'Templates',
    rolesRef: 'Roles Matrix',
    profile: 'Profile',
    userProfile: 'User Profile',
    companyIdentity: 'Company Identity',
    usersManagement: 'Users Management',
    workHours: 'Work Hours',
    systemSetup: 'System Setup',

    itemized: 'Itemized',
    fixed: 'Fixed Amount',
    percentage: 'Percentage',
    pricingMode: 'Pricing Mode',
    totalQuoteValue: 'Total Contract Value',
    defaultTerms: 'General Terms & Conditions',
    contractSigning: 'Contract Signing',
    at: 'At',
    before: 'Before',
    during: 'During',
    after: 'After',
    amount: 'Amount',
    unit: 'Unit',
    quantity: 'Quantity',
    notes: 'Notes',
    technicalLink: 'Technical Link',
    milestoneTiming: 'Milestone Timing',

    referenceLists: 'Reference Lists',
    boqMasterTree: 'BOQ Master Tree',
    halls: 'Halls',
    orgRef: 'Org Structure',
    techRef: 'Technical Paths',
    geoRef: 'Geographic Data',
    templatesLibrary: 'Templates Library',
    rolesPermissions: 'Roles & Permissions',

    unitTypes: 'Unit Types',
    paymentMethods: 'Payment Methods',
    paymentConditionTypes: 'Payment Conditions',
    milestoneTimingTypes: 'Milestone Timing',
    itemCategories: 'Item Categories',
    costTypeCategories: 'Cost Categories',

    staffRecords: 'Staff Records',
    leaveRequests: 'Leave Requests',
    payrollBatches: 'Payroll Batches',
    indemnity: 'Indemnity',
    attendanceLogs: 'Attendance Logs',
    permissions: 'Permissions',

    manageCompanyData: 'Manage company data and branding.',
    templatesDesc: 'Contract, Quotation, and BOQ reference templates.',
    workHoursDesc: 'Set shifts, public holidays, and attendance rules.'
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
    const keys = key.split('.');
    let value: any = translations[lang];
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        // Fallback for flat keys
        const flatValue = translations[lang][key];
        if (typeof flatValue === 'string') return flatValue;
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
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
