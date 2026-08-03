
'use client';
/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
 * تم تحديث الهيكل لدعم تفاصيل العمالة والمعدات المستهلكة ونظام المستخلصات (IPC).
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
  verifiedQuantity?: number; // الكمية المعتمدة من الاستشاري/المدير
  billedQuantity?: number;   // الكمية التي أدرجت في مستخلصات سابقة
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
  trade: string;    
  count: number;    
  hours?: number;   
  employeeIds?: string[]; 
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
  laborDetails?: LaborDetail[];
  equipmentUsed?: EquipmentUsed[];
  recordedBy: string;
  recordedByName: string;
  isArchived?: boolean;
  isVerified?: boolean;     // هل اعتمدها المدير للصرف؟
  verifiedAt?: any;
  verifiedBy?: string;
  ipcId?: string;           // ربط الكمية بمستخلص محدد
  createdAt?: any;
  updatedAt?: any;
}

/**
 * بنية المستخلص المالي (Interim Payment Certificate - IPC)
 */
export interface InterimPaymentCertificate extends BaseDocument {
  ipcNumber: string;        // تسلسلي مثل IPC-01
  periodMonth: number;
  periodYear: number;
  totalCurrentClaim: number;
  totalPreviousClaim: number;
  totalToDate: number;
  retentionAmount: number;  // المحتجز (عادة 10%)
  netPayable: number;       
  isJournalPosted?: boolean;
}

export interface IPCItem extends BaseReference {
  ipcId: string;
  boqItemId: string;
  description: string;
  unit: string;
  rate: number;
  plannedQty: number;
  previousQty: number;
  currentQty: number;
  totalToDateQty: number;
  totalAmount: number;
}

export interface BOQ extends BaseDocument {
  boqNumber: string;
  name: string;
  description?: string;
  templateName?: string;
  measurementMode: MeasurementMode;
}
