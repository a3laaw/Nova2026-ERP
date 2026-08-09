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

    // --- Status ---
    'status.active': 'نشط',
    'status.terminated': 'منتهي الخدمة',
    'status.pending': 'بانتظار المراجعة',
    'status.approved': 'معتمد',
    'status.rejected': 'مرفوض',
    'status.on-leave': 'في إجازة',
    'status.returned': 'عاد للعمل',
    'status.commenced': 'باشر العمل',

    // --- HR ---
    'hr.title': 'الموظفون',
    'hr.description': 'إدارة القوى العاملة والامتثال',
    'hr.addNew': 'إضافة موظف جديد',
    'hr.hire': 'تعيين',
    'hr.notFound': 'الموظف غير موجود',
    'hr.empNumLabel': 'رقم الموظف:',
    'hr.terminate': 'إنهاء الخدمة',
    'hr.confirmTermination': 'تأكيد إنهاء الخدمة',
    'hr.terminateWarning': 'تنبيه: سيتم إيقاف صرف الرواتب وتعطيل وصول الموظف للنظام فوراً.',
    'hr.terminationDate': 'تاريخ الإنهاء',
    'hr.confirmTerminationBtn': 'تأكيد الإنهاء النهائي',
    'hr.auditHistory': 'سجل التدقيق (Audit)',
    'hr.noAuditLogs': 'لا يوجد تغييرات مسجلة.',
    'hr.changedField': 'تغيير في',
    'hr.leaveRequestsTitle': 'طلبات الإجازات',
    'hr.ownRecordsOnly': 'عرض سجلاتك الشخصية فقط',
    'hr.manageAbsences': 'إدارة الغيابات والأرصدة',
    'hr.noRequests': 'لا يوجد طلبات.',
    'hr.requestNotFound': 'الطلب غير موجود',
    'hr.leaveStatus': 'حالة طلب الإجازة',
    'hr.officialAuthorization': 'إقرار إجازة رسمية',
    'hr.operationalConflict': 'تنبيه: تداخل تخصصي حرج',
    'hr.departmentOverlap': 'يوجد موظفون آخرون من نفس القسم لديهم إجازات في نفس الفترة.',
    'hr.reviewSchedule': 'يرجى مراجعة الجدول الزمني للقسم قبل اتمام الموافقة لتجنب توقف العمل.',
    'hr.adminDecision': 'قرار الإدارة وتصحيح البيانات',
    'hr.approveStart': 'تاريخ البدء المعتمد',
    'hr.approveReturn': 'تاريخ العودة المعتمد',
    'hr.deductionDays': 'أيام الخصم الفعلي (للمحاسبة)',
    'hr.internalNotes': 'ملاحظات الإدارة',
    'hr.requestDetails': 'بيانات طلب الإجازة',
    'hr.netDeduction': 'الخصم الفعلي',
    'hr.returnDate': 'تاريخ العودة',
    'hr.justification': 'المبررات والأسباب',
    'hr.auditTrail': 'سجل الحركات (Audit)',
    'hr.requestCreated': 'تقديم الطلب',
    'hr.art70Notice': 'بناءً على مادة 70: لا يحق للموظف القيام بالإجازة إلا بموافقة الإدارة. يحق للمدير تعديل تواريخ الإجازة بما يتناسب مع مصلحة العمل وضمان استمرارية القسم.',
    'hr.accessRestricted': 'وصول محجوب',
    'hr.noPayrollAccess': 'لا تملك صلاحية عرض مسيرات الرواتب.',
    'hr.payrollTitle': 'مسيرات الرواتب',
    'hr.manageFinancials': 'إدارة المستحقات المالية والخصومات التشغيلية',
    'hr.newPayrollBatch': 'توليد كشف جديد',

    // --- Navigation ---
    'dashboard': 'لوحة التحكم',
    'staffRecords': 'سجل الموظفين',
    'payroll': 'الرواتب',
    'leaveRequests': 'الإجازات',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',

    // --- Legacy Keys (Preserving for sync) ---
    'inline.profile.link.failed': 'تعذر تحميل ملف الصلاحيات',
    'inline.account.frozen': 'المنشأة مجمدة مؤقتاً',
    'inline.awaiting.activation': 'بانتظار تفعيل المنشأة',
    'inline.subscription.expired': 'انتهت صلاحية الوصول',
    'inline.personal.workspace': 'شؤوني الوظيفية',
    'inline.tax...reg.no': 'الرقم الضريبي / السجل:',
    'inline.generated.on': 'تاريخ الاستخراج'
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

    // --- Status ---
    'status.active': 'Active',
    'status.terminated': 'Terminated',
    'status.pending': 'Pending Review',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.on-leave': 'On Leave',
    'status.returned': 'Returned',
    'status.commenced': 'Commenced',

    // --- HR ---
    'hr.title': 'Employees',
    'hr.description': 'Workforce & Compliance',
    'hr.addNew': 'Add New Employee',
    'hr.hire': 'Hire',
    'hr.notFound': 'Employee Not Found',
    'hr.empNumLabel': 'Emp #:',
    'hr.terminate': 'Terminate',
    'hr.confirmTermination': 'Confirm Termination',
    'hr.terminateWarning': 'Warning: Payroll and system access will be disabled immediately.',
    'hr.terminationDate': 'Effective Date',
    'hr.confirmTerminationBtn': 'Confirm Termination',
    'hr.auditHistory': 'Audit History',
    'hr.noAuditLogs': 'No audit logs found.',
    'hr.changedField': 'Changed',
    'hr.leaveRequestsTitle': 'Leave Requests',
    'hr.ownRecordsOnly': 'Viewing your own records only',
    'hr.manageAbsences': 'Manage absences and balances',
    'hr.noRequests': 'No requests found.',
    'hr.requestNotFound': 'Request not found',
    'hr.leaveStatus': 'Leave Request Status',
    'hr.officialAuthorization': 'Official Leave Authorization',
    'hr.operationalConflict': 'Operational Conflict Warning',
    'hr.departmentOverlap': 'Other department staff are away during this period.',
    'hr.reviewSchedule': 'Review department schedule before approval to prevent downtime.',
    'hr.adminDecision': 'Admin Decision',
    'hr.approveStart': 'Approve Start',
    'hr.approveReturn': 'Approve Return',
    'hr.deductionDays': 'Deduction Days',
    'hr.internalNotes': 'Internal Notes',
    'hr.requestDetails': 'Request Details',
    'hr.netDeduction': 'Net Deduction',
    'hr.returnDate': 'Return Date',
    'hr.justification': 'Reason / Justification',
    'hr.auditTrail': 'Audit Trail',
    'hr.requestCreated': 'Request Created',
    'hr.art70Notice': 'Art 70: Leave requires admin approval. Manager can adjust dates to suit operational needs and department continuity.',
    'hr.accessRestricted': 'Access Restricted',
    'hr.noPayrollAccess': 'You lack permissions to view payroll batches.',
    'hr.payrollTitle': 'Payroll',
    'hr.manageFinancials': 'Manage financial entitlements and operational deductions',
    'hr.newPayrollBatch': 'New Payroll Batch',

    // --- Navigation ---
    'dashboard': 'Dashboard',
    'staffRecords': 'Employees',
    'payroll': 'Payroll',
    'leaveRequests': 'Time Off',
    'settings': 'Settings',
    'logout': 'Logout',

    // --- Legacy Keys (Preserving for sync) ---
    'inline.profile.link.failed': 'Profile Link Failed',
    'inline.account.frozen': 'Account Frozen',
    'inline.awaiting.activation': 'Awaiting Activation',
    'inline.subscription.expired': 'Subscription Expired',
    'inline.personal.workspace': 'Personal Workspace',
    'inline.tax...reg.no': 'TAX / REG NO:',
    'inline.generated.on': 'Generated On'
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
    if (translated) return translated;
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
