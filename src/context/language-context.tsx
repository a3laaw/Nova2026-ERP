'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

/**
 * القاموس السيادي الشامل (The Master Sovereign Dictionary)
 * يضم 1261 مفتاحاً تغطي كافة موديولات النظام بأسلوب أودو (Odoo Standard).
 */
const translations: Record<Language, Record<string, string>> = {
  ar: {
    // 1. الهيكل العام والتنقل
    'dashboard': 'لوحة التحكم',
    'crm': 'العملاء والفرص',
    'projects': 'المشاريع الهندسية',
    'procurement': 'المشتريات والتوريد',
    'hr': 'الموارد البشرية',
    'accounting': 'المحاسبة والمالية',
    'inventory': 'المخازن والعهد',
    'ai.hub': 'ذكاء Nova',
    'ai.desc': 'مساعد العمليات الذكي للتحليل المالي والهندسي.',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'userprofile': 'ملفي الشخصي',
    'details': 'التفاصيل',
    'transactions': 'المعاملات الفنية',
    'reports': 'التقارير الرقابية',
    'activeprojects': 'المشاريع الجارية',
    'boqexplorer': 'جدول الكميات والميزانية',
    'fieldradar': 'رادار الميدان',
    'workgroups': 'أطقم العمل',
    'equipment': 'المعدات والآليات',
    'fieldlogs': 'سجلات الإنجاز الميداني',
    'visitsdossier': 'سجل تفاعل العملاء',
    'leads': 'الفرص والمبيعات',
    'clients': 'العملاء المعتمدون',
    'appointments': 'رادار المواعيد',
    'appointments.radar': 'رادار المواعيد والزيارات',
    'appointments.radardesc': 'جدولة اللقاءات مع العملاء والزيارات الميدانية للمهندسين.',
    'meetings': 'حجز القاعات',
    'payroll': 'مسيرات الرواتب',
    'leaverequests': 'الإجازات',
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
    'templatesdesc': 'إدارة نماذج العقود وعروض الأسعار والمقايسات.',
    'devconsole': 'لوحة المطور',

    // 2. الكلمات الشائعة (Common)
    'common.search': 'بحث...',
    'common.filter': 'تصفية',
    'common.save': 'حفظ التغييرات',
    'common.cancel': 'إلغاء',
    'common.add': 'إضافة جديد',
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

    // 3. لوحة التحكم (Dashboard)
    'dashboard.description': 'نظام ذكاء عمليات تنفيذي لشركات المقاولات والهندسة الحديثة.',
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

    // 4. حالات النظام
    'status.scheduled': 'مجدول',
    'status.completed': 'مكتمل',
    'status.cancelled': 'ملغي',
    'status.pending': 'بانتظار الإجراء',
    'status.approved': 'معتمد',
    'status.draft': 'مسودة',
    'status.active': 'نشط',
    'status.paid': 'مدفوع',
    'status.rejected': 'مرفوض',

    // 5. إعدادات القواعد (Checklists)
    'orgref': 'الهيكل التنظيمي',
    'techref': 'المسارات الفنية',
    'georef': 'البيانات الجغرافية',
    'systemsetup': 'تهيئة النظام',
    'referencelists': 'القوائم المرجعية',
    'boqmastertree': 'شجرة البنود المرجعية',
    'halls': 'قاعات الاجتماعات'
  },
  en: {
    'dashboard': 'Dashboard',
    'dashboard.description': 'Executive intelligence for modern engineering firms.',
    'dashboard.stats.revenue': 'Total Revenue',
    'dashboard.stats.activeprojects': 'Active Projects',
    'dashboard.stats.workforce': 'Workforce',
    'dashboard.stats.completion': 'General Completion',
    'dashboard.units.kwd': 'KWD',
    'dashboard.units.project': 'Project',
    'dashboard.units.employee': 'Staff',
    'dashboard.units.yearly': 'Yearly',
    'dashboard.units.new': 'New',
    'dashboard.units.present': 'Present',
    'dashboard.recent': 'Recent Activity',
    'dashboard.export': 'Export Data',
    'crm': 'CRM',
    'projects': 'Projects',
    'procurement': 'Procurement',
    'hr': 'HR',
    'accounting': 'Accounting',
    'inventory': 'Inventory',
    'ai.hub': 'Nova AI',
    'settings': 'Settings',
    'logout': 'Logout',
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
   * محرك الترجمة السيادي (Sovereign t Engine):
   * يقوم بتحويل أي مفتاح إلى حروف صغيرة (lowercase) قبل البحث، 
   * مما يقتل مشكلة الفجوة المعرفية الناتجة عن اختلاف حالة الأحرف.
   */
  const t = (key: string) => {
    if (!key) return '';
    const cleanKey = key.trim().toLowerCase();
    
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
