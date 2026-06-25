/**
 * @fileOverview تعريف واجهات البيانات المرجعية لنظام Nova ERP (الهيكل الرباعي الجديد والقوائم الموحدة).
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
  isEditable: boolean; // هل يسمح للشركة بتعديل الاسم/الوصف؟
  isActive: boolean;   // هل السجل متاح للاستخدام في القوائم؟
  order: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface UnitType extends BaseReferenceList {
  symbol?: string;
  category?: string; // (e.g., weight, area, volume, count)
}

export interface PaymentMethod extends BaseReferenceList {}

export interface PaymentConditionType extends BaseReferenceList {}

export interface MilestoneTimingType extends BaseReferenceList {}

export interface ItemCategory extends BaseReferenceList {}

export interface CostTypeCategory extends BaseReferenceList {}

// الهياكل الهندسية الرباعية الحالية
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
  fullPathName?: string; // مسار النشاط والخدمة المخزن للعرض السريع
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
 * --- المرجع الشجري الديناميكي لبنود BOQ ---
 * يمثل Node واحدة في الشجرة المرجعية المرنة للمنشأة.
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

  // الربط بالأنشطة (للعقد الجذرية)
  activityTypeIds?: string[];
  activityTypeNames?: string[];

  // الحقول التنفيذية (تظهر لو العقدة executable)
  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;  // المرحلة الفنية المرتبطة افتراضياً
  billingTriggerGroup?: string;
  allowedItemCategoryIds?: string[];
  allowedItemCategoryNames?: string[];
}

/**
 * @deprecated استخدام BOQReferenceNode بدلاً منه في المعمارية الجديدة
 */
export type WorkItemNodeType = 'section' | 'main_category' | 'component' | 'work_item';

export interface BOQWorkItemMasterNode extends BaseReference {
  code: string;
  title: string;
  parentId: string | null;
  nodeType: WorkItemNodeType;
  level: number;
  order: number;
  childrenCount: number;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;
  billingTriggerGroup?: string;
  description?: string;
  estimatedRate?: number;
}
