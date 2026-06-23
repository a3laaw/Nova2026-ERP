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
    // Navigation & General
    dashboard: 'لوحة التحكم',
    crm: 'العملاء والفرص',
    projects: 'المشاريع والمهام',
    accounting: 'المحاسبة والمالية',
    hr: 'الموارد البشرية',
    procurement: 'المشتريات والتوريد',
    inventory: 'المخازن والعهد',
    checklists: 'مركز المراجع',
    reports: 'التقارير التنفيذية',
    ai: 'ذكاء Nova AI',
    settings: 'الإعدادات',
    switchLang: 'English',
    logout: 'تسجيل الخروج',
    profile: 'الملف الشخصي',
    billing: 'الفواتير',
    save: 'حفظ',
    saved: 'تم الحفظ بنجاح',
    error: 'خطأ',
    edit: 'تعديل',
    deleted: 'تم الحذف',
    entryAdded: 'تمت العملية بنجاح.',
    saveFailed: 'فشل في حفظ البيانات بالسحاب.',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    active: 'نشط',
    completed: 'مكتمل',
    suspended: 'موقوف',
    'on-hold': 'انتظار',
    search: 'بحث...',
    status: 'الحالة',
    name: 'الاسم',
    value: 'القيمة',
    summary: 'الملخص',

    // References & Org
    orgRef: 'الهيكل التنظيمي',
    techRef: 'المسارات الفنية',
    geoRef: 'الجغرافيا',
    rolesRef: 'الأدوار والصلاحيات',
    systemSetup: 'التهيئة',
    newDept: 'قسم جديد',
    newGov: 'محافظة جديدة',
    newArea: 'منطقة جديدة',
    newActivity: 'نشاط جديد',
    newService: 'خدمة جديدة',
    newPath: 'مسار جديد',
    addStage: 'إضافة مرحلة',
    editStage: 'تعديل مرحلة',
    nextStages: 'المراحل اللاحقة',
    technicalLink: 'الارتباط الفني',
    operationalPath: 'المسار التشغيلي',
    totalStages: 'إجمالي المراحل',
    
    // CRM & Clients
    addLead: 'إضافة عميل محتمل',
    leads: 'الفرص البيعية',
    clients: 'قاعدة العملاء',
    fileNumber: 'رقم الملف',
    civilId: 'الرقم المدني',
    mobile: 'رقم الهاتف',
    email: 'البريد الإلكتروني',

    // Templates Library
    templateLibrary: 'مكتبة القوالب',
    quotationTemplates: 'قوالب عروض الأسعار',
    contractTemplates: 'قوالب العقود الرسمية',
    boqTemplates: 'قوالب جداول الكميات (BOQ)',
    newTemplate: 'إنشاء قالب جديد',
    defaultTemplate: 'النموذج الافتراضي',
    pricingMode: 'نمط التسعير',
    fixed: 'سعر مقطوع (Fixed)',
    itemized: 'بنود تفصيلية (Units)',
    percentage: 'نسب مئوية (Percentage %)',
    
    // Quotation Specific
    introText: 'مقدمة العرض (خطاب التقديم)',
    defaultTerms: 'الشروط والأحكام والالتزامات',
    validDays: 'صلاحية العرض (أيام)',
    validUntil: 'صلاحية العرض لغاية',
    issueDate: 'تاريخ الإصدار',
    quotationFor: 'موجه إلى السيد/السادة',
    subject: 'بخصوص / الموضوع',
    estimatedTotal: 'إجمالي القيمة التقديرية',
    totalQuoteValue: 'إجمالي قيمة العرض المقدرة',
    addQuotationItem: 'إضافة بند مالي جديد',
    
    // Contract Specific
    legalText: 'المواد القانونية',
    closingText: 'خاتمة المستند',
    clauses: 'بنود العقد التفصيلية',
    addClause: 'إضافة بند قانوني',
    milestones: 'دفعات التعاقد',
    addMilestone: 'إضافة دفعة مالية',
    milestoneTiming: 'توقيت الاستحقاق',
    event: 'الحدث المالي',
    contractSigning: 'توقيع العقد الرسمي',
    contracting: 'التعاقد المبدئي',
    at: 'عند (At Start)',
    during: 'أثناء (During)',
    after: 'بعد (Upon Completion)',

    // HR & Payroll
    employees: 'سجل الموظفين',
    newHire: 'توظيف جديد',
    payroll: 'كشف الرواتب',
    leaves: 'الإجازات',
    permissions: 'الاستئذانات',
    gratuity: 'مكافأة نهاية الخدمة',
    attendance: 'الحضور والانصراف',
    basicSalary: 'الراتب الأساسي',
    hireDate: 'تاريخ التعيين',
    workHours: 'ساعات العمل',
    holidays: 'العطلات الرسمية',

    // Print & Documents
    print: 'طباعة',
    download: 'تحميل',
    officialReport: 'تقرير رسمي',
    companyIdentity: 'هوية المنشأة',
    commercialRegistry: 'السجل التجاري',
    licenseExpiry: 'انتهاء الترخيص',
    laborExpiry: 'اعتماد الشؤون',
    address: 'العنوان الرسمي',
    saveAllRules: 'حفظ كافة القواعد',
    backToSettings: 'العودة للإعدادات'
  },
  en: {
    // Navigation & General
    dashboard: 'Dashboard',
    crm: 'CRM',
    projects: 'Projects',
    accounting: 'Accounting',
    hr: 'Human Resources',
    procurement: 'Procurement',
    inventory: 'Inventory',
    checklists: 'Reference Hub',
    reports: 'Reports',
    ai: 'Nova AI',
    settings: 'Settings',
    switchLang: 'العربية',
    logout: 'Logout',
    profile: 'Profile',
    billing: 'Billing',
    save: 'Save',
    saved: 'Saved Successfully',
    error: 'Error',
    edit: 'Edit',
    deleted: 'Deleted',
    entryAdded: 'Entry added successfully.',
    saveFailed: 'Cloud synchronization failed.',
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

    // References & Org
    orgRef: 'Organization',
    techRef: 'Technical',
    geoRef: 'Geography',
    rolesRef: 'Roles',
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
    technicalLink: 'Technical Link',
    operationalPath: 'Ops Path',
    totalStages: 'Total Stages',

    // CRM & Clients
    addLead: 'Add Lead',
    leads: 'Sales Leads',
    clients: 'Clients Database',
    fileNumber: 'File Number',
    civilId: 'Civil ID',
    mobile: 'Mobile',
    email: 'Email',

    // Templates Library
    templateLibrary: 'Template Library',
    quotationTemplates: 'Quotation Templates',
    contractTemplates: 'Contract Templates',
    boqTemplates: 'BOQ Templates',
    newTemplate: 'New Template',
    defaultTemplate: 'Default Template',
    pricingMode: 'Pricing Mode',
    fixed: 'Fixed Price',
    itemized: 'Itemized Units',
    percentage: 'Percentage %',
    
    // Quotation Specific
    introText: 'Quotation Intro (Letter)',
    defaultTerms: 'Terms & Conditions',
    validDays: 'Validity (Days)',
    validUntil: 'Valid Until',
    issueDate: 'Issue Date',
    quotationFor: 'Quotation For',
    subject: 'Subject',
    estimatedTotal: 'Estimated Total Value',
    totalQuoteValue: 'Total Estimated Quote Value',
    addQuotationItem: 'Add Financial Item',

    // Contract Specific
    legalText: 'Legal Provisions',
    closingText: 'Closing Statement',
    clauses: 'Contract Clauses',
    addClause: 'Add Clause',
    milestones: 'Payment Milestones',
    addMilestone: 'Add Milestone',
    milestoneTiming: 'Timing',
    event: 'Financial Event',
    contractSigning: 'Contract Signing',
    contracting: 'Contracting',
    at: 'At Start',
    during: 'During',
    after: 'Upon Completion',

    // HR & Payroll
    employees: 'Staff Records',
    newHire: 'New Hire',
    payroll: 'Payroll',
    leaves: 'Leaves',
    permissions: 'Permissions',
    gratuity: 'Gratuity',
    attendance: 'Attendance',
    basicSalary: 'Basic Salary',
    hireDate: 'Hire Date',
    workHours: 'Work Hours',
    holidays: 'Public Holidays',

    // Print & Documents
    print: 'Print',
    download: 'Download',
    officialReport: 'Official Report',
    companyIdentity: 'Company Identity',
    commercialRegistry: 'Comm. Registry',
    licenseExpiry: 'License Expiry',
    laborExpiry: 'Labor Expiry',
    address: 'Official Address',
    saveAllRules: 'Save All Rules',
    backToSettings: 'Back'
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
