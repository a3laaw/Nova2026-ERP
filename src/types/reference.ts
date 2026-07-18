/**
 * @fileOverview تعريف واجهات البيانات المرجعية لنظام Nova ERP (الهيكل الموحد والقاموس السيادي).
 */

export interface BaseReference {
  id?: string;
  companyId: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * القالب الأساسي للقوائم النظامية القابلة للتوسعة
 */
export interface BaseReferenceList extends BaseReference {
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  isSystem: boolean;   // هل السجل مضاف بواسطة النظام؟
  isEditable: boolean; // هل يسمح للشركة بتعديل الاسم/الوصف?
  isActive: boolean;   // هل السجل متاح للاستخدام في القوائم؟
  order: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface UnitType extends BaseReferenceList {
  symbol?: string;
  category?: string; 
}

export interface PaymentMethod extends BaseReferenceList {}
export interface PaymentConditionType extends BaseReferenceList {}
export interface MilestoneTimingType extends BaseReferenceList {}
export interface ItemCategory extends BaseReferenceList {}
export interface CostTypeCategory extends BaseReferenceList {}

export interface ServiceType extends BaseReference {
  code: string;
  name: string;
  nameEn: string;
  description?: string;
  isActive: boolean;
  order: number;
  color?: string;
  moduleScope?: string;
}

// الهياكل الهندسية الرباعية للمسارات الفنية
export interface ActivityType extends BaseReference {
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Service extends BaseReference {
  activityTypeId: string;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface SubService extends BaseReference {
  activityTypeId: string;
  serviceId: string;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface TechnicalStage extends BaseReference {
  activityTypeId: string;
  serviceId: string;
  subServiceId: string;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  fullPathName?: string;
  order: number;
  isNumeric: boolean;
  numericTarget?: number | null;
  isTimed: boolean;
  timeTargetDays?: number | null;
  isRequired: boolean;
  isEditable: boolean;
  nextStageIds: string[];
  isActive: boolean;
}

export interface Department extends BaseReference {
  name: string;
  nameEn: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Job extends BaseReference {
  departmentId: string;
  name: string;
  nameEn: string;
  roleId?: string;
  roleName?: string;
  order: number;
  isActive: boolean;
}

export interface Governorate extends BaseReference {
  name: string;
  nameEn: string;
  order: number;
  isActive: boolean;
}

export interface Area extends BaseReference {
  governorateId: string;
  name: string;
  nameEn: string;
  order: number;
  isActive: boolean;
}

/**
 * --- المرجع الشجري الديناميكي الموحد لبنود BOQ (Single Source of Truth) ---
 * المصدر السيادي الوحيد لكافة بنود الأعمال في النظام.
 */
export type BOQNodeRole = 'group' | 'work_item';

export interface BOQReferenceNode extends BaseReference {
  code: string;               // كود البند الموحد
  title: string;              // مسمى العقدة
  description?: string;       // وصف تفصيلي
  parentId: string | null;    // مرجع العقدة الأب
  order: number;              // الترتيب داخل المستوى
  childrenCount: number;      // عدد الأبناء المباشرين
  depth: number;              // مستوى العمق (0 للجذر)
  ancestorIds: string[];      // مصفوفة كافة الأباء في المسار العلوي
  nodeRole: BOQNodeRole;      // دور العقدة (مجموعة أم بند تنفيذ)
  isExecutable: boolean;      // هل يمكن استخدامها كبند تنفيذ فعلي؟
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;

  // الربط التشغيلي (للجذور والطبقات العليا) - موروث أو معرف مباشرة
  activityTypeId?: string;
  activityTypeName?: string;
  serviceId?: string;
  serviceName?: string;
  subServiceId?: string;
  subServiceName?: string;
  
  // وراثة الخدمات
  inheritServices?: boolean;   // هل ترث الربط التشغيلي من الأب؟

  // الخصائص الفنية والتنفيذية للبنود (Executable Items)
  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  
  // الارتباط الفني المطور (متعدد)
  technicalStageId?: string;        // المرحلة الفنية الافتراضية (Default)
  technicalStageIds?: string[];     // كافة المراحل المرتبطة بهذا البند
  
  estimatedRate?: number;           // السعر المرجعي التقديري
  billingTriggerGroup?: string;
  allowedItemCategoryIds?: string[]; // تصنيف الأصناف (مخزني)

  // حقول الربط المسموح (للفلترة والوراثة)
  allowedServiceIds?: string[];
  allowedServiceNames?: string[];
  allowedActivityTypeIds?: string[];
  allowedActivityTypeNames?: string[];
}
