'use client';
/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
 */

import { BaseReference } from './reference';
import { PricingMode, MeasurementMode, QuotationItem, ContractMilestone } from './templates';

export type DocumentStatus = 'cancelled' | 'draft' | 'sent' | 'rejected' | 'active' | 'completed' | 'paid' | 'clientCertified' | 'signed' | 'approved';

export interface BaseDocument extends BaseReference {
  id: string;
  transactionId?: string;
  projectId?: string;
  clientId: string;
  clientName: string;
  templateId: string; 
  status: DocumentStatus;
  totalAmount: number;
  version: number;
  createdBy: string;
  updatedBy: string;
  activityTypeId?: string;
  serviceId?: string;
  subServiceId?: string;
  isHistoryRecorded?: boolean;
}

export interface Quotation extends BaseDocument {
  name: string;
  items: QuotationItem[];
  pricingMode: PricingMode;
  introText?: string;
  defaultTerms?: string;
  boqTemplateId?: string;
}

export interface Contract extends BaseDocument {
  name: string;
  introText?: string;
  legalText?: string;
  closingText?: string;
  clauses: string[];
  milestones: ContractMilestone[];
  retentionRate: number;
  advancePayment: {
    amount: number;
    recoveryRate: number;
    recoveredToDate: number;
  } | null;
  requiresClientCertification: boolean;
  isPaid?: boolean; 
  pricingMode?: PricingMode;
  boqTemplateId?: string;
}

export interface BOQItem extends BaseReference {
  id: string;
  boqId: string;
  transactionId?: string;
  clientId?: string;
  contractQty: number;
  plannedQuantity: number; 
  approvedVariationQty: number;
  executedQuantity: number;
  verifiedQuantity: number;
  billedQuantity: number;
  referenceCode: string;
  referenceTitle: string;
  referenceDescription?: string;
  unitSymbol?: string;
  unitName?: string;
  estimatedRate: number;
  order: number;
  technicalStageId?: string;
  technicalStageIds?: string[];
  ancestorIds?: string[];
  ancestorTitles?: string[];
  subcontractorId?: string;
  subcontractorName?: string;
}

export interface LaborDetail {
  trade: string;
  count: number;
  hours: number;
  hourlyCostRef: number;    
  totalCost: number;        
  subcontractorId?: string;
  subcontractorName?: string;
}

export interface EquipmentUsed {
  equipmentId: string;
  name: string;
  hoursUsed: number;
  hourlyRateRef: number;    
  totalCost: number;        
}

export interface BOQItemExecutionEntry extends BaseReference {
  id: string;
  boqId: string;
  boqItemId: string;
  transactionId: string;
  visitId?: string;
  appointmentId?: string;
  quantity: number;
  status: 'executed' | 'verified' | 'partiallyVerified' | 'rejected';
  verifiedQuantity?: number;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: any;
  laborDetails: LaborDetail[];
  equipmentUsed: EquipmentUsed[];
  recordedBy: string;
  recordedByName: string;
  createdAt: any;
  subcontractorId?: string;
  subcontractorName?: string;
}

export interface InterimPaymentCertificate extends BaseDocument {
  ipcNumber: string;
  contractId: string;
  status: 'draft' | 'clientCertified' | 'approved' | 'rejected';
  lineItems: {
    boqItemId: string;
    description: string;
    contractQty: number;
    approvedVariationQty: number;
    previousCumulativeQty: number;
    currentQty: number;
    unitRate: number;
    amount: number;
  }[];
  grossAmount: number;
  retentionAmount: number;
  advanceRecovery: number;
  netPayable: number;
  isJournalPosted?: boolean;
}

export interface BOQ extends BaseDocument {
  boqNumber: string;
  name: string;
  measurementMode: MeasurementMode;
}
