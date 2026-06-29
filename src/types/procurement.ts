import { BaseReference } from './reference';

export type POStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrder extends BaseReference {
  id: string;
  poNumber: string; // e.g., PO-2026-0001
  supplierId: string;
  supplierName: string;
  projectId?: string;
  transactionId?: string;
  date: string;
  deliveryDate?: string;
  status: POStatus;
  totalAmount: number;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  approvedBy?: string;
  approvedAt?: any;
}

export interface POItem extends BaseReference {
  id: string;
  poId: string;
  itemId?: string;      // Link to inventoryItems (Runtime)
  itemName: string;     // Denormalized for faster display
  description?: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  unit: string;
  totalPrice: number;
  
  // الربط السيادي بالمقايسة والميدان (The Real Link)
  boqId?: string;
  boqItemId?: string;      // ربط التكلفة ببند مقايسة محدد للمقارنة
  technicalStageId?: string; // ربط التكلفة بمرحلة تنفيذية محددة
}
