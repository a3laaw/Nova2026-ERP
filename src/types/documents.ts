/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
 */

import { BaseReference } from './reference';
import { PricingMode, MeasurementMode, QuotationItem, BOQSection, BOQItem, ContractMilestone } from './templates';

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

export interface BOQ extends BaseDocument {
  name: string;
  sections: BOQSection[];
  items: BOQItem[];
  measurementMode: MeasurementMode;
}
