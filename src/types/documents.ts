/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
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
 */
export interface BOQItem extends BaseReference {
  id: string;
  boqId: string;
  workItemMasterId?: string;
  sectionId: string;
  sectionName: string;
  mainCategoryId: string;
  mainCategoryName: string;
  componentId: string;
  componentName: string;
  itemCode?: string;
  description: string;
  unit: string;
  unitTypeId?: string;
  unitSymbol?: string;
  plannedQuantity: number;
  executedQuantity: number;
  estimatedRate?: number;
  estimatedCostRate?: number;
  actualRate?: number;
  notes?: string;
  technicalStageId?: string;
  billingTriggerGroup?: string;
  materialCodes: string[];
  order: number;
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
