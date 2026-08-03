'use client';
/**
 * @fileOverview تعريف واجهات البيانات للمستندات الحية (Instantiated Documents).
 * تم تحديث الهيكل بناءً على تقرير الدورة المتكاملة (IPC Engine).
 */

import { BaseReference } from './reference';
import { PricingMode, MeasurementMode, QuotationItem, ContractMilestone } from './templates';

export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled' | 'paid' | 'clientCertified';

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

export interface Contract extends BaseDocument {
  name: string;
  introText?: string;
  legalText?: string;
  closingText?: string;
  clauses: string[];
  milestones: ContractMilestone[];
  
  // حقول الفوترة المتقدمة (IPC Config)
  retentionRate: number;              // نسبة الاحتجاز (0.1 = 10%)
  advancePayment: {
    amount: number;                   // مبلغ الدفعة المقدمة
    recoveryRate: number;             // نسبة الخصم من كل مستخلص
    recoveredToDate: number;          // المسترد حتى الآن
  } | null;
  requiresClientCertification: boolean; // هل يتطلب اعتماد العميل؟
  
  isPaid?: boolean; 
  pricingMode?: PricingMode;
}

export interface BOQItem extends BaseReference {
  id: string;
  boqId: string;
  transactionId?: string;
  
  // هندسة الكميات المتعددة (The 5 Pillars of Qty)
  contractQty: number;                 // الكمية التعاقدية الأصلية
  approvedVariationQty: number;        // كميات أوامر التغيير المعتمدة
  executedQuantity: number;            // مجموع المنفذ (من الميدان)
  verifiedQuantity: number;            // مجموع المعتمد (قابلة للفوترة)
  billedQuantity: number;              // مجموع المفوتر (المدرج في مستخلصات معتمدة)

  referenceCode: string;
  referenceTitle: string;
  referenceDescription?: string;
  unitSymbol?: string;
  estimatedRate: number;               // سعر الوحدة التعاقدي
  order: number;
  technicalStageId?: string;
  technicalStageIds?: string[];
  ancestorIds?: string[];
  ancestorTitles?: string[];
}

export interface BOQItemExecutionEntry extends BaseReference {
  id?: string;
  boqId: string;
  boqItemId: string;
  transactionId: string;
  visitId?: string;
  
  quantity: number;                    // الكمية المنفذة المسجلة
  status: 'executed' | 'verified' | 'partiallyVerified' | 'rejected';
  
  verifiedQuantity?: number;           // الكمية المعتمدة فعلياً
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: any;

  // تفاصيل الموارد المربوطة بالجداول المرجعية (The Resource Bridge)
  laborDetails: {
    employeeId: string;
    hours: number;
    hourlyCostRef?: string;            // مرجع لجدول التكلفة
    actualCost: number;                // التكلفة وقت التسجيل
  }[];

  equipmentUsed: {
    equipmentId: string;
    hours: number;
    hourlyRateRef?: string;
    actualCost: number;
  }[];

  recordedBy: string;
  recordedByName: string;
  createdAt: any;
}

/**
 * بنية المستخلص المالي الرسمي (IPC)
 */
export interface InterimPaymentCertificate extends BaseDocument {
  ipcNumber: number;                   // تسلسلي لكل عقد
  contractId: string;
  status: 'draft' | 'clientCertified' | 'approved' | 'rejected';

  // لقطة ثابتة للبنود (Snapshot)
  lineItems: {
    boqItemId: string;
    description: string;
    contractQty: number;
    approvedVariationQty: number;
    previousCumulativeQty: number;     // الكمية المفوترة سابقاً
    currentQty: number;                // الكمية في هذا المستخلص
    unitRate: number;
    amount: number;
  }[];

  grossAmount: number;                 // إجمالي الكميات الحالية
  retentionAmount: number;             // مبلغ الاحتجاز المخصوم
  advanceRecovery: number;             // مبلغ استرداد الدفعة المقدمة
  netPayable: number;                  // الصافي للدفع
  
  isJournalPosted?: boolean;
}

export interface BOQ extends BaseDocument {
  boqNumber: string;
  name: string;
  measurementMode: MeasurementMode;
}
