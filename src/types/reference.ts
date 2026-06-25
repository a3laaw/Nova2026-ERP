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
  description?: string;
  order: number;
  isActive: boolean;
}

export interface Service extends BaseReference {
  activityTypeId: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface SubService extends BaseReference {
  activityTypeId: string;
  serviceId: string;
  code: string;
  name: string;
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
  description?: string;
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
 * --- مرجع بنود BOQ الشجري السيادي ---
 * يمثل Node واحدة في الشجرة المرجعية لبنود العمل الخاصة بالمنشأة.
 * المسار في Firestore: companies/{companyId}/boqWorkItemsMaster/{nodeId}
 */

export type WorkItemNodeType = 'section' | 'main_category' | 'component' | 'work_item';

export interface BOQWorkItemMasterNode extends BaseReference {
  code: string;               // كود البند الموحد (مثل CONC-001)
  title: string;              // مسمى العقدة (سواء قسم أو بند عمل)
  parentId: string | null;    // مرجع العقدة الأب (null للجذور/Sections)
  nodeType: WorkItemNodeType; // نوع العقدة في الهيكل
  level: number;              // المستوى العمقي (0: Section, 1: Category, 2: Component, 3: Item)
  order: number;              // الترتيب داخل المستوى الواحد
  childrenCount: number;      // عدد الأبناء المباشرين (للمراقبة السريعة)
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;

  // حقول إضافية خاصة فقط عندما يكون nodeType === 'work_item'
  unitTypeId?: string;        // معرف وحدة القياس المرجعي
  unitName?: string;          // مسمى الوحدة (للعرض السريع)
  unitSymbol?: string;        // رمز الوحدة (m2, kg, etc)
  technicalStageId?: string;  // معرف المرحلة الفنية الافتراضية المرتبطة
  billingTriggerGroup?: string; // مجموعة تحفيز الفوترة
  description?: string;       // وصف تفصيلي لبند العمل
  estimatedRate?: number;     // السعر التقديري المرجعي للبيع
}
