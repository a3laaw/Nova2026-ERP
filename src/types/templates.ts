/**
 * @fileOverview تعريف واجهات البيانات لمكتبة القوالب في نظام NovaFlow ERP.
 * تم تحديث الهياكل لتشمل جداول الكميات (BOQ) بالهيكل الرباعي المعتمد.
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
 * بنية بند جدول الكميات المطور (Flat Firestore Structure)
 */
export interface BOQTemplateItem {
  id?: string;
  workItemMasterId?: string; // رابط للقاموس المرجعي
  sectionId: string;
  sectionName: string;
  mainCategoryId: string;
  mainCategoryName: string;
  componentId: string;
  componentName: string;
  itemCode?: string;
  name?: string;
  description: string;
  unit: string;
  unitSymbol?: string;
  unitTypeId?: string;
  plannedQuantity: number;
  executedQuantity: number;
  estimatedRate?: number;
  estimatedCostRate?: number;
  notes?: string;
  order: number;
  technicalStageId?: string;
  billingTriggerGroup?: string;
  materialCodes: string[];
  companyId: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * الهيكل الشجري لعرض المقايسات في الواجهة
 */
export interface BOQTreeComponent {
  id: string;
  name: string;
  order: number;
  children: BOQTemplateItem[];
}

export interface BOQTreeMainCategory {
  id: string;
  name: string;
  order: number;
  children: BOQTreeComponent[];
}

export interface BOQTreeSection {
  id: string;
  name: string;
  order: number;
  children: BOQTreeMainCategory[];
}

export interface BOQTemplate extends BaseTemplate {
  measurementMode?: MeasurementMode;
  items?: BOQTemplateItem[]; 
}
