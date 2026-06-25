/**
 * @fileOverview تعريف واجهات البيانات لمكتبة القوالب في نظام NovaFlow ERP.
 * تم تحديث الهياكل لتتوافق مع المرجع الشجري الديناميكي الجديد لبنود BOQ.
 */

import { BaseReference } from './reference';

export type TemplateType = 'quotation' | 'contract' | 'boq';

export type PricingMode = 'fixed' | 'itemized' | 'percentage';

export type MeasurementMode = 'quantity' | 'lumpsum' | 'hybrid';

export type MilestoneTiming = 'at' | 'during' | 'after';

export interface QuotationItem {
  description: string;
  label?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  percentage?: number;
  amount?: number;
  notes?: string;
  timing?: MilestoneTiming;
  technicalStageId?: string;
  contractualEvent?: 'SIGNING' | 'CONTRACTING' | 'MANUAL';
}

export interface BaseTemplate extends BaseReference {
  id?: string;
  code: string;
  name: string;
  description?: string;
  baseAmount?: number;
  activityTypeId: string;
  activityTypeName?: string;
  serviceId: string;
  serviceName?: string;
  subServiceId?: string;
  subServiceName?: string;
  version: number;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
}

export interface QuotationTemplate extends BaseTemplate {
  introText?: string;
  defaultTerms?: string;
  validDays?: number;
  pricingMode: PricingMode;
  items: QuotationItem[];
}

export interface ContractMilestone {
  name: string;
  percentage: number;
  amount?: number;
  conditionText?: string;
  timing: MilestoneTiming;
  technicalStageId?: string;
  contractualEvent?: 'SIGNING' | 'CONTRACTING' | 'MANUAL';
}

export interface ContractTemplate extends BaseTemplate {
  introText?: string;
  legalText?: string;
  closingText?: string;
  clauses: string[];
  defaultMilestones: ContractMilestone[];
  contractType?: string;
  durationNotes?: string;
}

/**
 * بنية بند جدول الكميات المطور (Dynamic Reference Structure)
 * تم إلغاء المستويات الثابتة والاعتماد على العقد المرجعية
 */
export interface BOQTemplateItem {
  id?: string;
  boqReferenceNodeId: string;   // الرابط بالقاموس المرجعي
  referenceCode: string;         // كود البند المرجعي
  referenceTitle: string;        // مسمى البند المرجعي
  referenceDescription?: string; 
  parentId: string | null;       // الأب المباشر في الشجرة
  ancestorIds: string[];         // سلسلة النسب الكاملة
  ancestorTitles?: string[];     // مسميات الأسلاف (للعرض السريع)
  depth: number;                 // مستوى العمق

  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;
  billingTriggerGroup?: string;
  allowedItemCategoryIds?: string[];

  plannedQuantity: number;
  executedQuantity: number;
  estimatedRate?: number;
  estimatedCostRate?: number;
  notes?: string;
  order: number;
  companyId: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * الهيكل الشجري لعرض المقايسات في الواجهة (Generic Tree Node)
 */
export interface BOQTreeNode {
  id: string;
  title: string;
  depth: number;
  order: number;
  children: BOQTreeNode[];
  items: BOQTemplateItem[]; // البنود التنفيذية التابعة لهذه العقدة
}

export interface BOQTemplate extends BaseTemplate {
  measurementMode?: MeasurementMode;
  items?: BOQTemplateItem[]; 
}
