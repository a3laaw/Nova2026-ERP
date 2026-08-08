
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
    projects: 'المشاريع والمعاملات',
    construction: 'العمليات الميدانية',
    procurement: 'المشتريات والتوريد',
    hr: 'الموارد البشرية',
    accounting: 'المحاسبة والمالية',
    inventory: 'المخازن والعهد',
    reports: 'التقارير والرقابة',
    settings: 'الإعدادات',
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
    
    // Checklists & Settings Tabs
    referenceLists: 'القوائم المرجعية',
    boqMasterTree: 'شجرة الأعمال',
    halls: 'القاعات',
    orgRef: 'الهيكل التنظيمي',
    techRef: 'المسارات الفنية',
    geoRef: 'البيانات الجغرافية',
    systemSetup: 'تأسيس النظام',
    companyIdentity: 'هوية الشركة',
    usersManagement: 'إدارة المستخدمين',
    templatesLibrary: 'مكتبة القوالب',
    rolesPermissions: 'مصفوفة الصلاحيات',
    workHours: 'مواعيد العمل',
    userProfile: 'الملف الشخصي',

    // Specific Modules
    unitTypes: 'وحدات القياس',
    paymentMethods: 'طرق الدفع',
    paymentConditionTypes: 'شروط الدفع',
    milestoneTimingTypes: 'توقيت الدفعات',
    itemCategories: 'تصنيفات الأصناف',
    costTypeCategories: 'تصنيفات التكلفة',
    
    // Projects & BOQ
    boqExplorer: 'مستكشف المقايسات',
    boqs: 'المقايسات المعتمدة',
    variations: 'الأوامر التغييرية',
    boqNumber: 'رقم المقايسة',
    clientName: 'اسم العميل',
    budget: 'الميزانية',
    financialImpact: 'الأثر المالي',
    review: 'مراجعة',
    approveAndCommit: 'اعتماد وحقن التعديل',
    item: 'البند',
    planned: 'المخطط',
    executed: 'المنفذ',
    rate: 'التعرفة',
    total: 'الإجمالي',
    progress: 'الإنجاز',
    
    // Accounting
    chartOfAccounts: 'دليل الحسابات',
    receiptVouchers: 'سندات القبض',
    paymentVouchers: 'سندات الصرف',
    journalEntries: 'قيود اليومية',
    financialReports: 'التقارير المالية',
    bankReconciliation: 'المطابقة البنكية',
    debit: 'مدين',
    credit: 'دائن',
    balance: 'الرصيد',
    amount: 'المبلغ',

    // HR
    staffRecords: 'سجل الموظفين',
    leaveRequests: 'طلبات الإجازات',
    payrollBatches: 'مسيرات الرواتب',
    indemnity: 'نهاية الخدمة',
    attendanceLogs: 'البصمة والحضور',
    permissions: 'الاستئذانات',
  },
  en: {
    dashboard: 'Dashboard',
    crm: 'CRM',
    leads: 'Leads',
    clients: 'Clients',
    projects: 'Projects',
    construction: 'Field Operations',
    procurement: 'Procurement',
    hr: 'Human Resources',
    accounting: 'Accounting',
    inventory: 'Inventory',
    reports: 'Reports',
    settings: 'Settings',
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

    referenceLists: 'Reference Lists',
    boqMasterTree: 'BOQ Master Tree',
    halls: 'Halls',
    orgRef: 'Org Structure',
    techRef: 'Technical Paths',
    geoRef: 'Geographic Data',
    systemSetup: 'System Setup',
    companyIdentity: 'Company Identity',
    usersManagement: 'Users Management',
    templatesLibrary: 'Templates Library',
    rolesPermissions: 'Roles & Permissions',
    workHours: 'Work Hours',
    userProfile: 'User Profile',

    unitTypes: 'Unit Types',
    paymentMethods: 'Payment Methods',
    paymentConditionTypes: 'Payment Conditions',
    milestoneTimingTypes: 'Milestone Timing',
    itemCategories: 'Item Categories',
    costTypeCategories: 'Cost Categories',

    boqExplorer: 'BOQ Explorer',
    boqs: 'Approved BOQs',
    variations: 'Variations',
    boqNumber: 'BOQ Number',
    clientName: 'Client Name',
    budget: 'Budget',
    financialImpact: 'Financial Impact',
    review: 'Review',
    approveAndCommit: 'Approve & Commit',
    item: 'Item',
    planned: 'Planned',
    executed: 'Executed',
    rate: 'Rate',
    total: 'Total',
    progress: 'Progress',

    chartOfAccounts: 'Chart of Accounts',
    receiptVouchers: 'Receipt Vouchers',
    paymentVouchers: 'Payment Vouchers',
    journalEntries: 'Journal Entries',
    financialReports: 'Financial Reports',
    bankReconciliation: 'Bank Reconciliation',
    debit: 'Debit',
    credit: 'Credit',
    balance: 'Balance',
    amount: 'Amount',

    staffRecords: 'Staff Records',
    leaveRequests: 'Leave Requests',
    payrollBatches: 'Payroll Batches',
    indemnity: 'Indemnity',
    attendanceLogs: 'Attendance Logs',
    permissions: 'Permissions',
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
