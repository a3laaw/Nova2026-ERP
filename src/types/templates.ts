/**
 * @fileOverview تعريف واجهات البيانات لمكتبة القوالب في نظام NovaFlow ERP.
 */

import { BaseReference } from './reference';

export type TemplateType = 'quotation' | 'contract' | 'boq';

export interface BaseTemplate extends BaseReference {
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
  content?: any; // سيتم تعريفه لاحقاً حسب نوع القالب (Markdown, JSON, الخ)
}

export interface QuotationTemplate extends BaseTemplate {
  termsAndConditions?: string;
  validityDays?: number;
  currency?: string;
}

export interface ContractTemplate extends BaseTemplate {
  legalText: string;
  paymentTerms?: string;
  penaltyClause?: string;
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
