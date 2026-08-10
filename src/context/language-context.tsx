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
    // --- Common ---
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.add': 'إضافة',
    'common.close': 'إغلاق',
    'common.filter': 'تصفية',
    'common.confirm': 'تأكيد',
    'common.search': 'بحث...',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.name': 'الاسم',
    'common.nameAr': 'الاسم (عربي)',
    'common.nameEn': 'الاسم (EN)',
    'common.amount': 'المبلغ',
    'common.notes': 'الملاحظات',
    'common.error': 'خطأ في العملية',
    'common.saved': 'تم الحفظ بنجاح',
    'common.noResults': 'لا يوجد نتائج مطابقة',
    'common.overview': 'نظرة عامة',
    'common.reason': 'السبب',
    'common.company': 'الشركة',
    'common.email': 'البريد الإلكتروني',
    'common.unit': 'الوحدة',
    'common.quantity': 'الكمية',
    'common.total': 'الإجمالي',
    'common.days': 'أيام',
    'common.print': 'طباعة',
    'common.editItems': 'تعديل البنود',
    'common.quotation': 'عرض سعر',
    'common.unexpectedError': 'حدث خطأ غير متوقع',
    'common.addLabel': 'إضافة بند',
    'common.labor': 'العمالة والموارد البشرية',
    'common.loadFromGroup': 'تحميل من طاقم',
    'common.equipment': 'المعدات والآليات',
    'common.deleted': 'تم الحذف بنجاح',
    'common.confirmDelete': 'تأكيد الحذف',
    'common.retry': 'إعادة المحاولة',
    'common.back': 'العودة للقائمة',
    'common.response': 'رد المسؤول',
    'common.photosUploaded': 'تم رفع الصور',
    'common.saveChanges': 'حفظ التغييرات',
    'common.description': 'الوصف',
    'common.isActive': 'نشط',
    'common.code': 'الكود المرجعي',
    'common.alert': 'تنبيه',
    'common.viewAll': 'عرض الكل',
    'common.pending': 'معلق',
    'common.getStarted': 'ابدأ الآن',
    'common.records': 'سجلات',

    // --- Dashboard ---
    'dashboard': 'لوحة التحكم',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.description': 'متابعة شاملة لمؤشرات الأداء والعمليات الجارية.',
    'dashboard.export': 'تصدير التقارير',
    'dashboard.missions': 'المهمات المتأخرة',
    'dashboard.recent': 'آخر النشاطات',
    'dashboard.stats.revenue': 'إجمالي الإيرادات',
    'dashboard.stats.activeProjects': 'المشاريع الجارية',
    'dashboard.stats.workforce': 'القوى العاملة',
    'dashboard.stats.completion': 'معدل الإنجاز',
    'dashboard.units.kwd': 'د.ك',
    'dashboard.units.new': 'جديد',
    'dashboard.units.present': 'حاضر',
    'dashboard.units.yearly': 'سنوي',
    'dashboard.chart.revenue': 'الإيرادات',
    'dashboard.chart.expenses': 'المصروفات',

    // --- CRM & Clients ---
    'crm': 'العملاء والفرص',
    'crm.description': 'إدارة الفرص البيعية والمتابعة التجارية للعملاء',
    'crm.newLead': 'إضافة فرصة جديدة',
    'crm.leadValue': 'القيمة المتوقعة',
    'leads': 'الفرص والعملاء',
    'clients': 'العملاء',
    'clients.title': 'سجل العملاء المعتمد',
    'clients.registerNew': 'تسجيل عميل جديد',
    'clients.registerNewDesc': 'فتح ملف تجاري جديد لربطه بالمعاملات الفنية',
    'clients.editProfile': 'تعديل بيانات العميل',
    'clients.updateSuccess': 'تم تحديث بيانات العميل بنجاح.',
    'clients.unauthorizedEdit': 'لا تملك صلاحية تعديل بيانات العملاء.',
    'clients.table.profile': 'بيان العميل',
    'clients.table.staff': 'المهندس المسؤول',
    'clients.table.contact': 'الأتصال',
    'clients.details.transactions': 'المعاملات الفنية والمالية',
    'clients.details.location': 'رادار الموقع والعنوان',
    'clients.details.history': 'سجل تفاعل العميل',
    'clients.form.identity': 'البيانات الأساسية والقانونية',
    'clients.form.fileNumber': 'رقم الملف السيادي',
    'clients.form.civilId': 'الرقم المدني',
    'clients.form.mobile': 'رقم الهاتف',
    'clients.form.assignment': 'تعيين نطاق المسؤولية',
    'clients.form.engineer': 'المهندس المختص',
    'clients.form.autoAssigned': 'ربط تلقائي بالمسؤول',
    'clients.form.locationRadar': 'رادار الموقع والعنوان الذكي',
    'clients.form.mapLink': 'رابط الموقع (GOOGLE MAPS)',
    'clients.form.openMap': 'فتح الخريطة والبحث',
    'clients.form.governorate': 'المحافظة',
    'clients.form.area': 'المنطقة',
    'clients.form.block': 'القطعة',
    'clients.form.street': 'الشارع',
    'clients.form.house': 'المنزل',
    'clients.finance': 'المالية',
    'clients.newTransaction': 'فتح معاملة',

    // --- Appointments Radar ---
    'appointments': 'المواعيد',
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radarDesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية.',
    'appointments.printSchedule': 'طباعة الجدول',
    'appointments.hallRadar': 'رادار حجز القاعات',
    'appointments.hallRadarDesc': 'تنظيم إشغال قاعات الاجتماعات والورش الفنية.',
    'appointments.printOccupancy': 'طباعة تقرير إشغال القاعات',
    'appointments.morningSession': 'الفترة الصباحية ☀️',
    'appointments.eveningSession': 'الفترة المسائية 🌆',
    'appointments.totalToday': 'إجمالي اليوم',
    'appointments.busy': 'مشغول',
    'appointments.stats.total': 'إجمالي اليوم',
    'appointments.stats.new': 'زيارة أولى',
    'appointments.stats.follow': 'متابعة',
    'appointments.stats.contracted': 'متعاقدون',
    'appointments.action.viewRadar': 'عرض الرادار',
    'appointments.action.editBooking': 'تعديل الحجز',
    'appointments.action.delete': 'حذف وإلغاء الموعد',
    'appointments.dialog.editVisit': 'تعديل بيانات الزيارة',
    'appointments.dialog.newVisit': 'حجز موعد ميداني جديد',
    'appointments.dialog.confirmedDate': 'تاريخ الموعد المؤكد',
    'appointments.dialog.startTime': 'وقت البدء',
    'appointments.dialog.newClient': 'عميل جديد؟',
    'appointments.dialog.assignDept': 'القسم المختص بالزيارة',
    'appointments.dialog.selectSpecialty': 'تحديد التخصص المعماري...',
    'appointments.dialog.searchClient': 'بحث بالاسم أو الهاتف...',
    'appointments.dialog.linkProject': 'ربط بالمسار الفني (المشروع)',
    'appointments.dialog.selectProject': 'اختر المشروع المفتوح...',
    'appointments.dialog.notes': 'غرض الموعد',
    'appointments.dialog.confirm': 'تأكيد',
    'appointments.delete.title': 'تأكيد الحذف النهائي',
    'appointments.delete.desc': 'هل أنت متأكد؟ سيتم حذف الموعد نهائياً من كافة التقارير والرادار. لا يمكن التراجع عن هذا الإجراء.',
    'appointments.conflict.client': 'تعارض للعميل: يوجد موعد آخر في نفس الوقت.',
    'appointments.conflict.engineer': 'تعارض للمهندس: يوجد موعد آخر في نفس الوقت.',
    'appointments.conflict.past': 'تنبيه: لا يمكن الحجز في وقت سابق.',
    'appointments.client': 'العميل',
    'appointments.noProjectsForSpecialty': 'لا يوجد معاملات لهذا التخصص',

    // --- Projects ---
    'projects': 'المشاريع',
    'projects.title': 'المشاريع الجارية',
    'projects.addNew': 'بدء مشروع جديد',
    'projects.boqExplorer': 'جدول الكميات والميزانية',
    'projects.boqNumber': 'رقم المقايسة',
    'projects.clientName': 'العميل',
    'projects.budget': 'الميزانية',
    'projects.status': 'الحالة',
    'projects.contracting': 'المقاولات',
    'projects.stats.portfolio': 'إجمالي المحفظة',
    'projects.stats.claims': 'المطالبات الجارية',
    'projects.stats.collection': 'نسبة التحصيل',
    'projects.table.project': 'المشروع',
    'projects.table.progress': 'الإنجاز',
    'projects.table.billing': 'المبالغ المفوترة',
    'projects.noActiveProjects': 'لا يوجد مشاريع جارية.',
    'projects.details.radar': 'رادار التنفيذ',
    'projects.details.finance': 'المستندات والمالية',
    'projects.details.locked': 'المسار الفني مقفل. يرجى اعتماد العقد والمقايسة أولاً.',
    'projects.voManager.title': 'الأوامر التغييرية (VO)',

    // --- Settings & Reference ---
    'settings': 'الإعدادات',
    'settings.checklists': 'قواعد العمل',
    'settings.checklists.desc': 'إدارة القواعد المرجعية والمسارات الفنية',
    'orgRef': 'الهيكل التنظيمي',
    'techRef': 'المسارات الفنية',
    'geoRef': 'البيانات الجغرافية',
    'systemSetup': 'إعداد النظام',
    'referenceLists': 'القوائم المرجعية',
    'boqMasterTree': 'شجرة BOQ الموحدة',
    'halls': 'القاعات',
    'jobTitle': 'المسمى الوظيفي',
    'basicSalary': 'الراتب الأساسي',
    'unitTypes': 'وحدات القياس',
    'paymentMethods': 'طرق الدفع',
    'paymentConditionTypes': 'شروط الدفع',
    'milestoneTimingTypes': 'توقيت الدفعات',
    'itemCategories': 'تصنيفات المواد',
    'costTypeCategories': 'أنواع التكاليف',
    'workHours': 'ساعات العمل',
    'workHoursDesc': 'ضبط فترات الدوام والعطلات',
    'profile': 'الملف الشخصي',
    'companyIdentity': 'بيانات الشركة',
    'manageCompanyData': 'إدارة بيانات المنشأة وهويتها',
    'usersManagement': 'المستخدمون والصلاحيات',
    'rolesPermissions': 'الأدوار والوصول',
    'templates': 'القوالب',
    'templatesDesc': 'إدارة قوالب المستندات',
    'accounting': 'المحاسبة',
    'ref.tree.title': 'شجرة بنود الأعمال المرجعية',
    'ref.tree.subtitle': 'سجل بنود الأعمال الموحد والربط الفني',

    // --- HR & Payroll ---
    'staffRecords': 'الموظفون',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'leaverequests': 'الإجازات',
    'logout': 'خروج',

    // --- Reporting ---
    'reports.analytics.title': 'رادار الأداء المالي',
    'reports.executive.title': 'التقرير التنفيذي',
    'reports.hub.title': 'مركز التقارير',
    'visitsdossier': 'سجل الزيارات الشامل'
  },
  en: {
    // --- Common ---
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.close': 'Close',
    'common.filter': 'Filter',
    'common.confirm': 'Confirm',
    'common.search': 'Search...',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.name': 'Name',
    'common.nameAr': 'Name (Arabic)',
    'common.nameEn': 'Name (EN)',
    'common.amount': 'Amount',
    'common.notes': 'Notes',
    'common.error': 'Operation Error',
    'common.saved': 'Saved Successfully',
    'common.noResults': 'No matching results',
    'common.overview': 'Overview',
    'common.reason': 'Reason',
    'common.company': 'Company',
    'common.email': 'Email',
    'common.unit': 'Unit',
    'common.quantity': 'Quantity',
    'common.total': 'Total',
    'common.days': 'Days',
    'common.print': 'Print',
    'common.editItems': 'Edit Items',
    'common.quotation': 'Quotation',
    'common.unexpectedError': 'An unexpected error occurred',
    'common.addLabel': 'Add Item',
    'common.labor': 'Labor',
    'common.loadFromGroup': 'Load from Group',
    'common.equipment': 'Equipment',
    'common.deleted': 'Deleted',
    'common.confirmDelete': 'Confirm Delete',
    'common.retry': 'Retry',
    'common.back': 'Back',
    'common.response': 'Response',
    'common.photosUploaded': 'Photos uploaded',
    'common.saveChanges': 'Save Changes',
    'common.description': 'Description',
    'common.isActive': 'Active',
    'common.code': 'Code',
    'common.alert': 'Alert',
    'common.viewAll': 'View All',
    'common.pending': 'Pending',
    'common.getStarted': 'Get Started',
    'common.records': 'Records',

    // --- Dashboard ---
    'dashboard': 'Dashboard',
    'dashboard.title': 'Dashboard',
    'dashboard.description': 'Comprehensive tracking of performance indicators and ongoing operations.',
    'dashboard.export': 'Export',
    'dashboard.missions': 'Missions',
    'dashboard.recent': 'Recent',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.stats.activeProjects': 'Active Projects',
    'dashboard.stats.workforce': 'Workforce',
    'dashboard.stats.completion': 'Completion',
    'dashboard.units.kwd': 'KWD',
    'dashboard.units.new': 'new',
    'dashboard.units.present': 'present',
    'dashboard.units.yearly': 'Yearly',
    'dashboard.chart.revenue': 'Revenue',
    'dashboard.chart.expenses': 'Expenses',

    // --- CRM & Clients ---
    'crm': 'CRM',
    'crm.description': 'Leads and Client Management',
    'crm.newLead': 'New Lead',
    'crm.leadValue': 'Expected Value',
    'leads': 'Leads',
    'clients': 'Clients',
    'clients.title': 'Client Registry',
    'clients.registerNew': 'Register Client',
    'clients.registerNewDesc': 'Open new commercial file',
    'clients.editProfile': 'Edit Profile',
    'clients.updateSuccess': 'Updated',
    'clients.unauthorizedEdit': 'Unauthorized',
    'clients.table.profile': 'Profile',
    'clients.table.staff': 'Staff',
    'clients.table.contact': 'Contact',
    'clients.details.transactions': 'Transactions',
    'clients.details.location': 'Location',
    'clients.details.history': 'History',
    'clients.form.identity': 'Identity',
    'clients.form.fileNumber': 'File Number',
    'clients.form.civilId': 'Civil ID',
    'clients.form.mobile': 'Mobile',
    'clients.form.assignment': 'Assignment',
    'clients.form.engineer': 'Engineer',
    'clients.form.autoAssigned': 'Auto-Assigned',
    'clients.form.locationRadar': 'Location Radar',
    'clients.form.mapLink': 'Map Link',
    'clients.form.openMap': 'Open Map',
    'clients.form.governorate': 'Governorate',
    'clients.form.area': 'Area',
    'clients.form.block': 'Block',
    'clients.form.street': 'Street',
    'clients.form.house': 'House',
    'clients.finance': 'Finance',
    'clients.newTransaction': 'New Trans',

    // --- Appointments Radar ---
    'appointments': 'Appointments',
    'appointments.radar': 'Appointments Radar',
    'appointments.radarDesc': 'Schedule client meetings and site visits.',
    'appointments.printSchedule': 'Print Schedule',
    'appointments.hallRadar': 'Halls Radar',
    'appointments.hallRadarDesc': 'Manage meeting rooms.',
    'appointments.printOccupancy': 'Print Occupancy',
    'appointments.morningSession': 'Morning Session',
    'appointments.eveningSession': 'Evening Session',
    'appointments.totalToday': 'Total Today',
    'appointments.busy': 'Busy',
    'appointments.stats.total': 'Total',
    'appointments.stats.new': 'New',
    'appointments.stats.follow': 'Follow',
    'appointments.stats.contracted': 'Contracted',
    'appointments.action.viewRadar': 'View Radar',
    'appointments.action.editBooking': 'Edit',
    'appointments.action.delete': 'Delete',
    'appointments.dialog.editVisit': 'Edit Visit',
    'appointments.dialog.newVisit': 'New Visit',
    'appointments.dialog.confirmedDate': 'Confirmed Date',
    'appointments.dialog.startTime': 'Start Time',
    'appointments.dialog.newClient': 'New Client?',
    'appointments.dialog.assignDept': 'Assign Dept',
    'appointments.dialog.selectSpecialty': 'Select Specialty',
    'appointments.dialog.searchClient': 'Search Client',
    'appointments.dialog.linkProject': 'Link Project',
    'appointments.dialog.selectProject': 'Select Project',
    'appointments.dialog.notes': 'Notes',
    'appointments.dialog.confirm': 'Confirm',
    'appointments.delete.title': 'Permanent Deletion',
    'appointments.delete.desc': 'Are you sure?',
    'appointments.client': 'Client',
    'appointments.noProjectsForSpecialty': 'No projects for this specialty',

    // --- Projects ---
    'projects': 'Projects',
    'projects.title': 'Active Projects',
    'projects.addNew': 'Add Project',
    'projects.boqExplorer': 'BOQ Explorer',
    'projects.boqNumber': 'BOQ #',
    'projects.clientName': 'Client',
    'projects.budget': 'Budget',
    'projects.status': 'Status',
    'projects.contracting': 'Contracting',
    'projects.stats.portfolio': 'Portfolio',
    'projects.stats.claims': 'Claims',
    'projects.stats.collection': 'Collection',
    'projects.table.project': 'Project',
    'projects.table.progress': 'Progress',
    'projects.table.billing': 'Billing',
    'projects.noActiveProjects': 'No projects.',
    'projects.details.radar': 'Radar',
    'projects.details.finance': 'Finance',
    'projects.details.locked': 'Locked',
    'projects.voManager.title': 'VO Manager',

    // --- Settings & Reference ---
    'settings': 'Settings',
    'settings.checklists': 'Checklists',
    'settings.checklists.desc': 'Rules and Paths',
    'orgRef': 'Org Structure',
    'techRef': 'Technical Paths',
    'geoRef': 'Geography',
    'systemSetup': 'System Setup',
    'referenceLists': 'Reference Lists',
    'boqMasterTree': 'BOQ Master',
    'halls': 'Halls',
    'jobTitle': 'Job Title',
    'basicSalary': 'Basic Salary',
    'unitTypes': 'Unit Types',
    'paymentMethods': 'Payment Methods',
    'paymentConditionTypes': 'Conditions',
    'milestoneTimingTypes': 'Timing',
    'itemCategories': 'Item Categories',
    'costTypeCategories': 'Cost Categories',
    'workHours': 'Work Hours',
    'workHoursDesc': 'Manage shifts',
    'profile': 'Profile',
    'companyIdentity': 'Company Identity',
    'manageCompanyData': 'Manage Data',
    'usersManagement': 'Users Management',
    'rolesPermissions': 'Roles & Permissions',
    'templates': 'Templates',
    'templatesDesc': 'Manage templates',
    'accounting': 'Accounting',
    'ref.tree.title': 'Reference Tree',
    'ref.tree.subtitle': 'Master Registry',

    // --- HR & Payroll ---
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Leaves',
    'leaverequests': 'Leaves',
    'logout': 'Logout',

    // --- Reporting ---
    'reports.analytics.title': 'Financial Analytics',
    'reports.executive.title': 'Executive Report',
    'reports.hub.title': 'Reports Hub',
    'visitsdossier': 'Visits Dossier'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Language || 'ar';
    setLangState(savedLang);
    document.documentElement.lang = savedLang;
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  /**
   * Hardened Translation Function
   * دالة ترجمة محصنة تبحث عن المفتاح بغض النظر عن حالة الأحرف.
   */
  const t = (key: string) => {
    if (!key) return '';
    const lookupKey = key.toLowerCase();
    
    // محاولة البحث عن المفتاح كما هو أولاً لضمان السرعة، ثم تحويل الكل لصغير للبحث الشامل
    const currentDict = translations[lang];
    if (currentDict[key]) return currentDict[key];
    
    // بحث ذكي (Case-insensitive lookup)
    const foundKey = Object.keys(currentDict).find(k => k.toLowerCase() === lookupKey);
    return foundKey ? currentDict[foundKey] : key;
  };

  const tSafe = (key: string, fallbackAr: string, fallbackEn?: string) => {
    if (!key) return lang === 'ar' ? fallbackAr : (fallbackEn || key);
    const translated = t(key);
    if (translated !== key) return translated;
    return lang === 'ar' ? fallbackAr : (fallbackEn || key);
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