
'use client';
/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
 * تم تحديث الهيكل لدعم تفاصيل العمالة والمعدات المستخدمة في التنفيذ الميداني.
 */

import { BaseReference } from './reference';
import { PricingMode, MeasurementMode, QuotationItem, ContractMilestone } from './templates';

export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled' | 'paid';

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
  isPaid?: boolean; 
  pricingMode?: PricingMode;
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
  verifiedQuantity?: number; // الكمية المعتمدة مالياً للمستخلصات
  billedQuantity?: number;   // الكمية التي تم إصدار فاتورة/مستخلص بها فعلياً
  estimatedRate?: number;
  estimatedCostRate?: number;
  actualRate?: number;
  notes?: string;
  order: number;
}

/**
 * سجل تفاصيل العمالة (Labor Breakdown)
 */
export interface LaborDetail {
  trade: string;    // التخصص (نجار، حداد، عمالة عامة...)
  count: number;    // العدد
  hours?: number;   // ساعات العمل
  employeeIds?: string[]; // ربط الموظفين الفعليين بالزيارة (للتكاليف)
}

/**
 * سجل المعدات المستخدمة
 */
export interface EquipmentUsed {
  equipmentId: string;
  name: string;
  hoursUsed: number;
  costPerHour?: number;
}

export interface BOQItemExecutionEntry extends BaseReference {
  id?: string;
  boqId: string;
  boqItemId: string;
  transactionId?: string;
  appointmentId?: string; 
  technicalStageId: string;
  quantity: number;
  notes?: string;
  
  // حقول محرك الموارد الجديد
  laborDetails?: LaborDetail[];
  equipmentUsed?: EquipmentUsed[];
  
  recordedBy: string;
  recordedByName: string;
  isArchived?: boolean;
  archivedAt?: any;
  
  // حالة الاعتماد المالي
  isVerified?: boolean;     // هل اعتمدها المهندس المشرف؟
  verifiedAt?: any;
  verifiedBy?: string;
  ipcId?: string;           // معرف المستخلص الذي أدرجت فيه هذه الكمية
}

export interface BOQ extends BaseDocument {
  boqNumber: string;
  name: string;
  description?: string;
  templateName?: string;
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
  isComplementary?: boolean; 
  targetSectionId?: string | null;
  technicalStageIds?: string[];
}
