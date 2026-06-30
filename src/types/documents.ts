/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
 * تم تحديثها لتتوافق مع المرجع الشجري الديناميكي الجديد لبنود BOQ.
 */

import { BaseReference } from './reference';
import { PricingMode, MeasurementMode, QuotationItem, ContractMilestone } from './templates';

export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled';

export interface BaseDocument extends BaseReference {
  id: string;
  transactionId?: string;
  projectId?: string;
  clientId: string;
  clientName: string;
  templateId: string; // مرجع للقالب الأصلي
  status: DocumentStatus;
  totalAmount: number;
  version: number;
  createdBy: string;
  updatedBy: string;
}

export interface Quotation extends BaseDocument {
  name: string;
  introText?: string;
  defaultTerms?: string;
  validDays: number;
  pricingMode: PricingMode;
  items: QuotationItem[];
}

export interface Contract extends BaseDocument {
  name: string;
  introText?: string;
  legalText?: string;
  closingText?: string;
  clauses: string[];
  milestones: ContractMilestone[];
  contractType?: string;
}

/**
 * بند المقايسة الفعلي (Runtime BOQ Item)
 * تم تحديثه ليدعم النموذج الشجري الديناميكي (Dynamic Tree Structure)
 */
export interface BOQItem extends BaseReference {
  id: string;
  boqId: string;
  transactionId?: string;
  projectId?: string;
  
  // البيانات المرجعية المستنسخة من القاموس
  boqReferenceNodeId: string;
  referenceCode: string;
  referenceTitle: string;
  referenceDescription?: string;
  parentId?: string | null;
  ancestorIds: string[];
  ancestorTitles?: string[];
  depth: number;

  // الخصائص الفنية
  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;
  technicalStageIds?: string[];
  billingTriggerGroup?: string;
  allowedItemCategoryIds?: string[];

  // الحقول التنفيذية والمالية
  plannedQuantity: number;
  executedQuantity: number; // تبدأ دائماً بـ 0 عند الاستنساخ
  estimatedRate?: number;
  estimatedCostRate?: number;
  actualRate?: number;
  notes?: string;
  order: number;
}

/**
 * سجل تنفيذ مرحلي لبند BOQ (Execution Entry)
 */
export interface BOQItemExecutionEntry extends BaseReference {
  id?: string;
  boqId: string;
  boqItemId: string;
  transactionId?: string;
  technicalStageId: string;
  quantity: number;
  notes?: string;
  recordedBy: string;
  recordedByName?: string;
  isArchived?: boolean;
  archivedAt?: any;
}

/**
 * مستند المقايسة الفعلي (Runtime BOQ Document)
 */
export interface BOQ extends BaseDocument {
  boqNumber: string;
  name: string;
  description?: string;
  templateName?: string;
  activityTypeId?: string;
  serviceId?: string;
  subServiceId?: string;
  measurementMode: MeasurementMode;
}

/**
 * --- الأوامر التغييرية (Variation Orders - VO Lite) ---
 */
export type BOQVariationStatus = 'draft' | 'approved' | 'cancelled';
export type VariationType = 'increase_quantity' | 'decrease_quantity' | 'new_item' | 'omit_item';
export type VOStageMode = 'existing_stage' | 'new_local_stage';

export interface BOQVariation extends BaseReference {
  id: string;
  boqId: string;
  transactionId: string;
  boqNumber: string;
  title: string;
  reason: string;
  status: BOQVariationStatus;
  totalAmount: number; // صافي التغيير المالي
  createdBy: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  // حقول السياق لتسهيل الحقن
  activityTypeId?: string;
  serviceId?: string;
  subServiceId?: string;
}

export interface BOQVariationItem extends BaseReference {
  id: string;
  variationId: string;
  sourceBoqItemId?: string;     // إذا كان تعديلاً على بند موجود
  boqReferenceNodeId?: string;  // إذا كان بنداً مستجداً من الشجرة
  technicalStageId?: string;    // المرحلة الفنية المرتبطة (موجودة)
  type: VariationType;
  description: string;
  unitName?: string;
  unitSymbol?: string;
  sourcePlannedQuantity?: number; // الكمية الأصلية قبل التعديل
  quantityDelta: number;         // مقدار التغير (موجب أو سالب)
  rate: number;
  total: number;                 // (quantityDelta * rate)
  reason?: string;

  // حقول المرحلة المحلية الطارئة (Deferred Creation)
  stageMode?: VOStageMode;
  localStageName?: string;
  localStageCode?: string;
  insertAfterStageId?: string;   // المرحلة التي يتم إدراج المرحلة الجديدة بعدها
}
