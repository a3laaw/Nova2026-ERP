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
  templateId: string; 
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

export interface BOQItem extends BaseReference {
  id: string;
  boqId: string;
  transactionId?: string;
  projectId?: string;
  boqReferenceNodeId: string;
  referenceCode: string;
  referenceTitle: string;
  referenceDescription?: string;
  parentId?: string | null;
  ancestorIds: string[];
  ancestorTitles?: string[];
  depth: number;
  unitTypeId?: string;
  unitName?: string;
  unitSymbol?: string;
  technicalStageId?: string;
  technicalStageIds?: string[];
  billingTriggerGroup?: string;
  allowedItemCategoryIds?: string[];
  plannedQuantity: number;
  executedQuantity: number; 
  estimatedRate?: number;
  estimatedCostRate?: number;
  actualRate?: number;
  notes?: string;
  order: number;
}

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
  totalAmount: number; 
  createdBy: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  activityTypeId?: string;
  serviceId?: string;
  subServiceId?: string;
}

export interface BOQVariationItem extends BaseReference {
  id: string;
  variationId: string;
  sourceBoqItemId?: string;     
  boqReferenceNodeId?: string;  
  technicalStageId?: string;    
  type: VariationType;
  description: string;
  unitName?: string;
  unitSymbol?: string;
  sourcePlannedQuantity?: number; 
  quantityDelta: number;         
  rate: number;
  total: number;                 
  reason?: string;
  stageMode?: VOStageMode;
  localStageName?: string;
  localStageCode?: string;
  insertAfterStageId?: string;   
  isComplementary?: boolean; // NEW: flag for parallel manual stages
  targetSectionId?: string | null;
  technicalStageIds?: string[];
}
