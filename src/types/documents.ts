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
