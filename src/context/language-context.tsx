
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
    common: {
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
      save: 'حفظ',
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
      post: 'ترحيل السجلات',
      saved: 'تم الحفظ بنجاح',
      deleted: 'تم الحذف بنجاح',
      error: 'خطأ في النظام',
      confirmDelete: 'هل أنت متأكد من الحذف؟',
      isActive: 'نشط',
      order: 'الترتيب',
      name: 'الاسم',
      code: 'الكود',
      description: 'الوصف',
      switchLang: 'English',
      logout: 'تسجيل الخروج',
      addLabel: 'إضافة سطر',
      saveReport: 'حفظ التقرير الميداني',
      labor: 'العمالة والموارد البشرية',
      equipment: 'المعدات والآليات الميدانية',
      quantity: 'الكمية',
      unit: 'الوحدة',
      notes: 'ملاحظات',
      photos: 'الصور',
      workGroups: 'مجموعات العمل',
      loadFromGroup: 'تحميل طاقم كامل',
      companyIdentity: 'هوية الشركة',
      manageCompanyData: 'إدارة بيانات المنشأة',
      referenceLists: 'القوائم المرجعية',
      templates: 'مكتبة القوالب',
      templatesDesc: 'إدارة نماذج العقود، المقايسات، وعروض الأسعار.',
      workHours: 'مواعيد العمل',
      workHoursDesc: 'ضبط فترات الدوام، العطلات، ونظام النوبات.',
      profile: 'الملف الشخصي',
      rolesRef: 'الأدوار والصلاحيات',
      systemSetup: 'تأسيس النظام',
      personalInfo: 'المعلومات الشخصية',
      username: 'اسم المستخدم',
      saveChanges: 'حفظ التغييرات',
      unitTypes: 'وحدات القياس',
      paymentMethods: 'طرق الدفع',
      paymentConditionTypes: 'شروط الدفع',
      milestoneTimingTypes: 'توقيت الدفعات',
      itemCategories: 'تصنيفات الأصناف',
      costTypeCategories: 'تصنيفات التكلفة',
      boqTemplates: 'قوالب المقايسات',
      contractTemplates: 'قوالب العقود',
      quotationTemplates: 'قوالب العروض',
      newTemplate: 'قالب جديد',
      pricingMode: 'نمط التسعير',
      itemized: 'بنود مفصلة',
      fixed: 'مقطوعية ثابتة',
      percentage: 'نسبة مئوية',
      at: 'عند الاستحقاق',
      before: 'قبل الموعد',
      during: 'أثناء التنفيذ',
      after: 'بعد الانتهاء',
      totalQuoteValue: 'إجمالي قيمة العرض',
      contractSigning: 'توقيع العقد',
      defaultTerms: 'الشروط والأحكام الافتراضية',
      legalText: 'البنود القانونية',
      introText: 'النص الافتتاحي',
      technicalLink: 'الارتباط الفني',
      milestoneTiming: 'توقيت الاستحقاق',
      amount: 'المبلغ',
      convertToContract: 'تحويل لعقد رسمي',
      orgRef: 'الهيكل التنظيمي',
      techRef: 'المسارات الفنية',
      geoRef: 'البيانات الجغرافية',
      newDept: 'قسم جديد',
      newActivity: 'نشاط جديد',
      newPath: 'مسار جديد',
      newService: 'خدمة جديدة',
      newGov: 'محافظة جديدة',
      editStage: 'تعديل المرحلة',
      addStage: 'إضافة مرحلة',
      nextStages: 'المراحل التالية'
    },
    dashboard: {
      title: 'نظرة عامة على العمليات',
      stats: {
        revenue: 'إيرادات المشاريع',
        activeProjects: 'المشاريع النشطة',
        workforce: 'القوى العاملة',
        completion: 'معدل الإنجاز'
      },
      missions: 'مهمات بانتظار الإغلاق',
      recent: 'سجل العمليات المباشر',
      export: 'تصدير التقرير'
    },
    clients: {
      title: 'قاعدة بيانات العملاء',
      addNew: 'تسجيل عميل جديد',
      table: {
        profile: 'العميل المالك',
        staff: 'المسؤول',
        contact: 'الهاتف',
        status: 'الحالة'
      },
      details: {
        transactions: 'المعاملات الجارية',
        location: 'الموقع الجغرافي',
        history: 'سجل التفاعل'
      }
    },
    projects: {
      title: 'رادار المشاريع والفوترة',
      radar: 'تتبع الإنجاز الميداني والمطالبات',
      contracting: 'المقاولات',
      addNew: 'بدء مشروع',
      boqExplorer: {
        title: 'مستكشف المقايسات',
        boqs: 'المقايسات المعتمدة',
        variations: 'الأوامر التغييرية',
        boqAndClient: 'رقم المقايسة / العميل',
        voSummary: 'ملخص التعديلات',
        budget: 'الميزانية',
        variation: 'التعديل',
        amount: 'القيمة',
        review: 'مراجعة التعديل',
        financialImpact: 'الأثر المالي',
        justification: 'المبرر الفني',
        approveAndCommit: 'اعتماد وحقن التعديل',
        action: 'الإجراء',
        item: 'البند',
        delta: 'الفارق',
        rate: 'التعرفة',
        total: 'الإجمالي',
        noBoqs: 'لا يوجد مقايسات حالياً.',
        noVariations: 'لا يوجد أوامر تغييرية مسجلة.',
        newVO: 'أمر تغييري جديد',
        items: 'البنود',
        sections: 'الأقسام',
        planned: 'المخطط',
        previous: 'سابق',
        current: 'حالي',
        progress: 'إنجاز'
      },
      voManager: {
        title: 'إصدار أمر تغييري',
        reason: 'المبرر الفني',
        voTitle: 'عنوان التعديل',
        addAdjustment: 'إضافة تعديل',
        increase: 'زيادة كمية',
        decrease: 'نقص كمية',
        omit: 'حذف بند',
        newItem: 'بند مستجد',
        targetItem: 'البند المستهدف',
        deltaQty: 'الفارق',
        financialSection: 'القسم المالي',
        executionPath: 'مسار المباشرة',
        linkExisting: 'ربط بمرحلة موجودة',
        injectNew: 'حقن مرحلة جديدة',
        stageName: 'اسم المرحلة',
        stageCode: 'كود المرحلة',
        insertAfter: 'مكان الإدراج',
        parallel: 'مرحلة موازية',
        confirmVO: 'تأكيد وحفظ الأمر'
      },
      table: {
        project: 'المشروع / العميل',
        progress: 'الإنجاز',
        billing: 'المطالبات',
        status: 'الحالة'
      },
      details: {
        radar: 'رادار التنفيذ',
        finance: 'المستندات المالية',
        locked: 'المسار مقفل - مطلوب ربط مالي'
      }
    },
    construction: {
      radar: 'رادار العمليات الميدانية',
      groups: 'مجموعات العمل',
      equipment: 'سجل المعدات والآليات',
      reports: 'زيارات المواقع المنفذة',
      context: 'سياق العمل والموقع',
      siteProgress: 'الأعمال والكميات المنجزة',
      siteResources: 'الموارد والمعدات'
    },
    hr: {
      title: 'HR والامتثال',
      staff: 'سجل الموظفين',
      leaves: 'طلبات الإجازات',
      payroll: 'مسيرات الرواتب',
      gratuity: 'نهاية الخدمة',
      permissions: 'الاستئذانات',
      attendance: 'البصمة والحضور'
    },
    accounting: {
      title: 'المحاسبة والمالية'
    }
  },
  en: {
    common: {
      dashboard: 'Dashboard',
      crm: 'CRM & Sales',
      leads: 'Leads & Pipeline',
      clients: 'Client Database',
      projects: 'Projects & Transactions',
      construction: 'Field Operations',
      procurement: 'Procurement & Supply',
      hr: 'HR & People',
      accounting: 'Accounting & Finance',
      inventory: 'Inventory & Assets',
      reports: 'Reports & Analytics',
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
      post: 'Post Records',
      saved: 'Saved Successfully',
      deleted: 'Deleted Successfully',
      error: 'System Error',
      confirmDelete: 'Are you sure?',
      isActive: 'Active',
      order: 'Order',
      name: 'Name',
      code: 'Code',
      description: 'Description',
      switchLang: 'العربية',
      logout: 'Logout',
      addLabel: 'Add Row',
      saveReport: 'Save Field Report',
      labor: 'Labor & Manpower',
      equipment: 'Site Equipment & Assets',
      quantity: 'Qty',
      unit: 'Unit',
      notes: 'Notes',
      photos: 'Photos',
      workGroups: 'Work Crews',
      loadFromGroup: 'Load Whole Crew',
      companyIdentity: 'Company Identity',
      manageCompanyData: 'Manage Organization Data',
      referenceLists: 'Reference Lists',
      templates: 'Templates Library',
      templatesDesc: 'Manage contracts, BOQs, and quotations.',
      workHours: 'Work Hours',
      workHoursDesc: 'Set duty periods, holidays, and shifts.',
      profile: 'User Profile',
      rolesRef: 'Roles & Permissions',
      systemSetup: 'System Setup',
      personalInfo: 'Personal Information',
      username: 'Username',
      saveChanges: 'Save Changes',
      unitTypes: 'Unit Types',
      paymentMethods: 'Payment Methods',
      paymentConditionTypes: 'Payment Conditions',
      milestoneTimingTypes: 'Milestone Timing',
      itemCategories: 'Item Categories',
      costTypeCategories: 'Cost Categories',
      boqTemplates: 'BOQ Templates',
      contractTemplates: 'Contract Templates',
      quotationTemplates: 'Quotation Templates',
      newTemplate: 'New Template',
      pricingMode: 'Pricing Mode',
      itemized: 'Itemized',
      fixed: 'Fixed Lumpsum',
      percentage: 'Percentage Based',
      at: 'At Trigger',
      before: 'Before',
      during: 'During',
      after: 'After',
      totalQuoteValue: 'Total Quote Value',
      contractSigning: 'Contract Signing',
      defaultTerms: 'Default Terms & Conditions',
      legalText: 'Legal Clauses',
      introText: 'Introduction',
      technicalLink: 'Technical Link',
      milestoneTiming: 'Timing',
      amount: 'Amount',
      convertToContract: 'Convert to Contract',
      orgRef: 'Org Structure',
      techRef: 'Technical Paths',
      geoRef: 'Geographic Data',
      newDept: 'New Dept',
      newActivity: 'New Activity',
      newPath: 'New Path',
      newService: 'New Service',
      newGov: 'New Governorate',
      editStage: 'Edit Stage',
      addStage: 'Add Stage',
      nextStages: 'Next Stages'
    },
    dashboard: {
      title: 'Operations Overview',
      stats: {
        revenue: 'Project Revenue',
        activeProjects: 'Active Projects',
        workforce: 'Workforce',
        completion: 'Completion Rate'
      },
      missions: 'Missions Awaiting Closure',
      recent: 'Live Activity',
      export: 'Export'
    },
    clients: {
      title: 'Clients Database',
      addNew: 'New Registration',
      table: {
        profile: 'Client Profile',
        staff: 'Assigned Staff',
        contact: 'Mobile',
        status: 'Status'
      },
      details: {
        transactions: 'Active Projects',
        location: 'Location Map',
        history: 'Interaction Logs'
      }
    },
    projects: {
      title: 'Projects & Billing Radar',
      radar: 'Field progress and Interim Payments',
      contracting: 'Contracting',
      addNew: 'New Project',
      boqExplorer: {
        title: 'BOQ Explorer',
        boqs: 'Approved BOQs',
        variations: 'Variation Orders (VO)',
        boqAndClient: 'BOQ / Client',
        voSummary: 'VO Summary',
        budget: 'Budget',
        variation: 'Variation',
        amount: 'Amount',
        review: 'Review Variation',
        financialImpact: 'Financial Impact',
        justification: 'Technical Justification',
        approveAndCommit: 'Approve & Commit',
        action: 'Action',
        item: 'Item',
        delta: 'Delta',
        rate: 'Rate',
        total: 'Total',
        noBoqs: 'No BOQs found.',
        noVariations: 'No variations found.',
        newVO: 'New Variation',
        items: 'Items',
        sections: 'Sections',
        planned: 'Planned',
        previous: 'Prev',
        current: 'Curr',
        progress: 'Progress'
      },
      voManager: {
        title: 'Issue Variation Order',
        reason: 'Technical Justification',
        voTitle: 'Variation Title',
        addAdjustment: 'Add Adjustment',
        increase: 'Increase Qty',
        decrease: 'Decrease Qty',
        omit: 'Omit Item',
        newItem: 'New Work Item',
        targetItem: 'Target BOQ Item',
        deltaQty: 'Qty Delta',
        financialSection: 'Financial Section',
        executionPath: 'Execution Path',
        linkExisting: 'Link to Existing Stage',
        injectNew: 'Inject New Stage',
        stageName: 'Stage Name',
        stageCode: 'Stage Code',
        insertAfter: 'Insert After',
        parallel: 'Parallel Stage',
        confirmVO: 'Confirm & Save VO'
      },
      table: {
        project: 'Project / Client',
        progress: 'Progress',
        billing: 'Billing',
        status: 'Status'
      },
      details: {
        radar: 'Execution Radar',
        finance: 'Financial Documents',
        locked: 'Pipeline Locked - Financial Link Required'
      }
    },
    construction: {
      radar: 'Field Ops Radar',
      groups: 'Work Crews',
      equipment: 'Equipment Registry',
      reports: 'Site Reports',
      context: 'Work Context & Project',
      siteProgress: 'Work Progress & Quantities',
      siteResources: 'Resources & Equipment'
    },
    hr: {
      title: 'HR & Compliance',
      staff: 'Staff Records',
      leaves: 'Leave Requests',
      payroll: 'Payroll',
      gratuity: 'Indemnity',
      permissions: 'Permissions',
      attendance: 'Attendance'
    },
    accounting: {
      title: 'Accounting & Finance'
    }
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
      value = value?.[k];
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
