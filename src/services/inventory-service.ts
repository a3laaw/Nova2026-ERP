'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خدمة إدارة المخازن والعهد الميدانية (Inventory & Assets Service).
 * تدعم عمليات الصرف والاسترجاع مع التحديث التلقائي للكميات.
 */
export class InventoryService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- إدارة المستودعات ---
  async addWarehouse(data: { name: string; location?: string }) {
    const path = paths.warehouses(this.companyId);
    return addDoc(collection(this.db, path), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // --- إدارة الأصناف ---
  async addItem(data: { name: string; sku: string; quantity: number; unit: string; warehouseId: string }) {
    const path = paths.inventoryItems(this.companyId);
    return addDoc(collection(this.db, path), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * صرف عهدة لموظف:
   * 1. إنشاء سجل في assetAssignments بحالة in-use.
   * 2. خصم الكمية المصروفة من المخزون.
   */
  async assignAsset(data: { 
    employeeId: string; 
    employeeName: string; 
    itemId: string; 
    itemName: string; 
    quantity: number 
  }) {
    const batch = writeBatch(this.db);
    
    // 1. إنشاء سجل العهدة
    const assignmentRef = doc(collection(this.db, paths.assetAssignments(this.companyId)));
    batch.set(assignmentRef, {
      ...data,
      status: 'in-use',
      companyId: this.companyId,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. خصم الكمية من المخزون الأصلي
    const itemRef = doc(this.db, paths.inventoryItems(this.companyId), data.itemId);
    batch.update(itemRef, {
      quantity: increment(-data.quantity),
      updatedAt: serverTimestamp()
    });

    return batch.commit().catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'inventory_assignment_batch',
        operation: 'write'
      }));
      throw err;
    });
  }

  /**
   * استرجاع عهدة للمخزن:
   * 1. تحديث حالة السجل إلى returned.
   * 2. إعادة الكمية إلى المخزون.
   */
  async returnAsset(assignmentId: string, itemId: string, quantity: number, userId: string) {
    const batch = writeBatch(this.db);

    // 1. تحديث حالة العهدة
    const assignmentRef = doc(this.db, paths.assetAssignments(this.companyId), assignmentId);
    batch.update(assignmentRef, {
      status: 'returned',
      returnedAt: serverTimestamp(),
      returnedBy: userId,
      updatedAt: serverTimestamp()
    });

    // 2. إعادة الكمية للمخزون
    const itemRef = doc(this.db, paths.inventoryItems(this.companyId), itemId);
    batch.update(itemRef, {
      quantity: increment(quantity),
      updatedAt: serverTimestamp()
    });

    return batch.commit().catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'inventory_return_batch',
        operation: 'write'
      }));
      throw err;
    });
  }
}
