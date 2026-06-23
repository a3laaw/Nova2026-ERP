'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // القائمة الرئيسية (Odoo Style)
    dashboard: 'الرئيسية',
    crm: 'العملاء',
    leads: 'الفرص',
    clients: 'قاعدة العملاء',
    projects: 'المشاريع',
    activeProjects: 'المشاريع الجارية',
    accounting: 'الحسابات',
    hr: 'الموظفين',
    procurement: 'المشتريات',
    suppliers: 'الموردين',
    inventory: 'المخزن',
    warehouses: 'المستودعات',
    checklists: 'الإعدادات الفنية',
    reports: 'التقارير',
    ai: 'ذكاء Nova',
    settings: 'الإعدادات',
    
    // إجراءات عامة
    switchLang: 'English',
    logout: 'خروج',
    profile: 'حسابي',
    myProfile: 'ملفي الشخصي',
    staffRecords: 'سجل الموظفين',
    users: 'المستخدمين',
    billing: 'الاشتراك',
    save: 'حفظ',
    saved: 'تم الحفظ',
    error: 'خطأ',
    edit: 'تعديل',
    deleted: 'تم الحذف',
    entryAdded: 'تمت الإضافة بنجاح',
    saveFailed: 'فشل في الاتصال بالسحاب',
    confirmDelete: 'تأكيد الحذف؟',
    active: 'نشط',
    completed: 'مكتمل',
    suspended: 'موقوف',
    'on-hold': 'انتظار',
    search: 'بحث...',
    status: 'الحالة',
    name: 'الاسم',
    value: 'القيمة',
    summary: 'الملخص',
    reconciliation: 'المطابقة البنكية',

    // الإعدادات والهيكل
    orgRef: 'الهيكل الوظيفي',
    techRef: 'مسارات العمل',
    geoRef: 'المناطق',
    rolesRef: 'الصلاحيات',
    systemSetup: 'التهيئة',
    newDept: 'قسم جديد',
    newGov: 'محافظة جديدة',
    newArea: 'منطقة جديدة',
    newActivity: 'نشاط جديد',
    newService: 'خدمة جديدة',
    newPath: 'مسار جديد',
    addStage: 'إضافة مرحلة',
    editStage: 'تعديل مرحلة',
    nextStages: 'المراحل التالية',
    technicalLink: 'الربط الفني',
    operationalPath: 'مسار التنفيذ',
    totalStages: 'عدد المراحل',
    
    // العملاء
    addLead: 'إضافة فرصة',
    fileNumber: 'رقم الملف',
    civilId: 'الرقم المدني',
    mobile: 'الهاتف',
    email: 'البريد',

    // القوالب
    templateLibrary: 'القوالب',
    quotationTemplates: 'قوالب العروض',
    contractTemplates: 'قوالب العقود',
    boqTemplates: 'قوالب الكميات',
    newTemplate: 'قالب جديد',
    defaultTemplate: 'القالب الافتراضي',
    pricingMode: 'طريقة التسعير',
    fixed: 'مقطوع',
    itemized: 'بنود',
    percentage: 'نسبة مئوية',
    share: 'الحصة',
    amount: 'المبلغ',
    
    // العروض
    introText: 'المقدمة',
    defaultTerms: 'الشروط والالتزامات',
    validDays: 'صلاحية العرض (أيام)',
    validUntil: 'صالح لغاية',
    issueDate: 'تاريخ الإصدار',
    quotationFor: 'موجه إلى',
    subject: 'الموضوع',
    estimatedTotal: 'القيمة التقديرية',
    totalQuoteValue: 'إجمالي قيمة البنود',
    totalQuoteShare: 'إجمالي حصص العقد',
    addQuotationItem: 'إضافة بند مالي',
    quoteAnalysis: 'تحليل العروض',
    
    // العقود
    legalText: 'النصوص القانونية',
    closingText: 'الخاتمة',
    clauses: 'بنود العقد',
    addClause: 'إضافة بند',
    milestones: 'الدفعات',
    addMilestone: 'إضافة دفعة',
    milestoneTiming: 'التوقيت',
    event: 'الحدث المالي',
    contractSigning: 'توقيع العقد',
    contracting: 'التعاقد المبدئي',
    at: 'عند',
    during: 'أثناء',
    after: 'بعد',

    // الموظفين
    employees: 'سجل الموظفين',
    newHire: 'تعيين جديد',
    payroll: 'الرواتب',
    leaves: 'الإجازات',
    permissions: 'الاستئذانات',
    gratuity: 'نهاية الخدمة',
    attendance: 'الحضور',
    basicSalary: 'الراتب الأساسي',
    hireDate: 'تاريخ التعيين',
    workHours: 'مواعيد العمل',
    holidays: 'العطلات الرسمية',
    lastLogin: 'آخر دخول',
    personalInfo: 'البيانات الشخصية',
    displayName: 'الاسم المعروض',
    username: 'اسم المستخدم',
    currentRole: 'الدور الحالي',
    accountSecurity: 'أمان الحساب',
    changePassword: 'تغيير كلمة المرور',
    passwordDesc: 'تحديث بيانات الدخول لضمان حماية حسابك.',

    // المشاريع
    project: 'المشروع',
    newProject: 'مشروع جديد',
    startProject: 'بدء المشروع',
    budget: 'الميزانية',

    // التقارير والطباعة
    print: 'طباعة',
    download: 'تحميل',
    officialReport: 'تقرير رسمي',
    companyIdentity: 'بيانات الشركة',
    commercialRegistry: 'السجل التجاري',
    licenseExpiry: 'انتهاء الترخيص',
    laborExpiry: 'اعتماد الشؤون',
    address: 'العنوان',
    saveAllRules: 'حفظ كافة القواعد',
    backToSettings: 'رجوع للإعدادات',

    // نطاقات الوصول
    scopeNone: 'محجوب',
    scopeOwn: 'سجلاتي فقط',
    scopeDept: 'سجلات القسم',
    scopeAll: 'كل المنشأة'
  },
  en: {
    dashboard: 'Dashboard',
    crm: 'CRM',
    leads: 'Leads',
    clients: 'Clients',
    projects: 'Projects',
    activeProjects: 'Active Projects',
    accounting: 'Accounting',
    hr: 'Employees',
    procurement: 'Purchasing',
    suppliers: 'Suppliers',
    inventory: 'Inventory',
    warehouses: 'Warehouses',
    checklists: 'Technical Setup',
    reports: 'Reports',
    ai: 'Nova AI',
    settings: 'Settings',
    
    switchLang: 'العربية',
    logout: 'Logout',
    profile: 'Profile',
    myProfile: 'My Profile',
    staffRecords: 'Staff Records',
    users: 'Users',
    billing: 'Subscription',
    save: 'Save',
    saved: 'Saved',
    error: 'Error',
    edit: 'Edit',
    deleted: 'Deleted',
    entryAdded: 'Entry Added',
    saveFailed: 'Cloud Sync Failed',
    confirmDelete: 'Are you sure?',
    active: 'Active',
    completed: 'Completed',
    suspended: 'Suspended',
    'on-hold': 'On Hold',
    search: 'Search...',
    status: 'Status',
    name: 'Name',
    value: 'Value',
    summary: 'Summary',
    reconciliation: 'Reconciliation',

    orgRef: 'Org Structure',
    techRef: 'Workflows',
    geoRef: 'Areas',
    rolesRef: 'Permissions',
    systemSetup: 'Setup',
    newDept: 'New Dept',
    newGov: 'New Gov',
    newArea: 'New Area',
    newActivity: 'New Activity',
    newService: 'New Service',
    newPath: 'New Path',
    addStage: 'Add Stage',
    editStage: 'Edit Stage',
    nextStages: 'Next Stages',
    technicalLink: 'Tech Link',
    operationalPath: 'Ops Path',
    totalStages: 'Total Stages',

    addLead: 'Add Opportunity',
    fileNumber: 'File No.',
    civilId: 'Civil ID',
    mobile: 'Mobile',
    email: 'Email',

    templateLibrary: 'Templates',
    quotationTemplates: 'Quote Templates',
    contractTemplates: 'Contract Templates',
    boqTemplates: 'BOQ Templates',
    newTemplate: 'New Template',
    defaultTemplate: 'Default',
    pricingMode: 'Pricing',
    fixed: 'Fixed',
    itemized: 'Itemized',
    percentage: 'Percentage',
    share: 'Share',
    amount: 'Amount',
    
    introText: 'Introduction',
    defaultTerms: 'Terms & Conditions',
    validDays: 'Validity (Days)',
    validUntil: 'Valid Until',
    issueDate: 'Issue Date',
    quotationFor: 'Quotation For',
    subject: 'Subject',
    estimatedTotal: 'Estimated Total',
    totalQuoteValue: 'Total Items Value',
    totalQuoteShare: 'Total Contract Share',
    addQuotationItem: 'Add Item',
    quoteAnalysis: 'Quote Analysis',

    legalText: 'Legal Text',
    closingText: 'Closing',
    clauses: 'Clauses',
    addClause: 'Add Clause',
    milestones: 'Payments',
    addMilestone: 'Add Payment',
    milestoneTiming: 'Timing',
    event: 'Trigger Event',
    contractSigning: 'Signing',
    contracting: 'Contracting',
    at: 'At',
    during: 'During',
    after: 'After',

    employees: 'Staff',
    newHire: 'New Hire',
    payroll: 'Payroll',
    leaves: 'Leaves',
    permissions: 'Permissions',
    gratuity: 'Gratuity',
    attendance: 'Attendance',
    basicSalary: 'Basic Salary',
    hireDate: 'Hire Date',
    workHours: 'Schedules',
    holidays: 'Holidays',
    lastLogin: 'Last Login',
    personalInfo: 'Personal Info',
    displayName: 'Display Name',
    username: 'Username',
    currentRole: 'Current Role',
    accountSecurity: 'Account Security',
    changePassword: 'Change Password',
    passwordDesc: 'Update your login details to ensure account protection.',

    project: 'Project',
    newProject: 'New Project',
    startProject: 'Start Project',
    budget: 'Budget',

    print: 'Print',
    download: 'Download',
    officialReport: 'Official Report',
    companyIdentity: 'Company Profile',
    commercialRegistry: 'Comm. Registry',
    licenseExpiry: 'License Expiry',
    laborExpiry: 'HR Authorization',
    address: 'Address',
    saveAllRules: 'Save Rules',
    backToSettings: 'Back',

    scopeNone: 'None',
    scopeOwn: 'Own Records',
    scopeDept: 'Department',
    scopeAll: 'All Enterprise'
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

  const t = (key: string) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
