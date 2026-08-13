/**
 * @fileOverview تعريف واجهات البيانات لمكتبة القوالب في نظام NovaFlow ERP.
 * تم تحديث الهياكل لتتوافق مع المرجع الشجري الديناميكي الجديد لبنود BOQ.
 */

import { BaseReference } from './reference';

export type TemplateType = 'quotation' | 'contract' | 'subcon_contract' | 'boq';

export type PricingMode = 'fixed' | 'itemized' | 'percentage';

export type MeasurementMode = 'quantity' | 'lumpsum' | 'hybrid';

export type MilestoneTiming = 'at' | 'before' | 'during' | 'after';

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
  boqReferenceNodeId?: string; // الرابط الجوهري بالقاموس الموحد
  contractualEvent?: 'SIGNING' | 'CONTRACTING' | 'MANUAL';
  deleted?: boolean;
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
  subServiceId: string;
  subServiceName?: string;
  version: number;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
}

export interface QuotationTemplate extends BaseTemplate {
  boqTemplateId?: string; // الربط السيادي بالمقايسة
  boqTemplateName?: string;
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
  boqTemplateId?: string; // الربط السيادي بالمقايسة
  boqTemplateName?: string;
  introText?: string;
  legalText?: string;
  closingText?: string;
  clauses: string[];
  defaultMilestones: ContractMilestone[];
  contractType?: string;
  durationNotes?: string;
  pricingMode?: PricingMode;
}

export interface SubConContractTemplate extends BaseTemplate {
  trade: string; // التخصص المعتمد للقالب (مثلاً: حدادة)
  legalText?: string;
  defaultMilestones: ContractMilestone[];
  pricingMode: PricingMode;
}

/**
 * بنية بند جدول الكميات المطور (Dynamic Reference Structure)
 */
export interface BOQTemplateItem {
  id?: string;
  boqReferenceNodeId: string;   
  referenceCode: string;         
  referenceTitle: string;        
  referenceDescription?: string; 
  parentId: string | null;       
  ancestorIds: string[];         
  ancestorTitles?: string[];     
  depth: number;                 

  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;    // الربط الفني الافتراضي
  technicalStageIds?: string[]; // قائمة بكافة المراحل التي يؤثر فيها هذا البند مالياً
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
 * الهيكل الشجري لعرض المقايسات في الواجهة
 */
export interface BOQTreeNode {
  id: string;
  title: string;
  depth: number;
  order: number;
  children: BOQTreeNode[];
  items: BOQTemplateItem[]; 
}

export interface BOQTemplate extends BaseTemplate {
  measurementMode?: MeasurementMode;
  itemsCount?: number;    
  sectionsCount?: number; 
  items?: BOQTemplateItem[];
  activityTypeIds?: string[];
  serviceIds?: string[];
}
