/**
 * @fileOverview تعريف واجهات البيانات لمكتبة القوالب في نظام NovaFlow ERP.
 */

import { BaseReference } from './reference';

export type TemplateType = 'quotation' | 'contract' | 'boq';

export type PricingMode = 'fixed' | 'itemized' | 'percentage';

export interface QuotationItem {
  description: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  percentage?: number;
  notes?: string;
}

export interface BaseTemplate extends BaseReference {
  id?: string;
  code: string;
  name: string;
  description?: string;
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
  percentage?: number;
  amount?: number;
  conditionText?: string;
  technicalStageId?: string; // الربط مع مرحلة فنية من المراجع
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

export interface BOQTemplate extends BaseTemplate {
  items: Array<{
    itemCode: string;
    description: string;
    unit: string;
    estimatedQty: number;
    estimatedRate?: number;
    category?: string;
  }>;
}
