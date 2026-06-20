
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

export class InventoryService {
  constructor(private db: Firestore, private companyId: string) {}

  // --- إدارة المخازن ---
  async addWarehouse(data: any) {
    const path = paths.warehouses(this.companyId);
    return addDoc(collection(this.db, path), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async deleteWarehouse(id: string) {
    return deleteDoc(doc(this.db, paths.warehouses(this.companyId), id));
  }

  // --- إدارة الأصناف ---
  async addItem(data: any) {
    const path = paths.inventoryItems(this.companyId);
    return addDoc(collection(this.db, path), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async updateItem(id: string, data: any) {
    return updateDoc(doc(this.db, paths.inventoryItems(this.companyId), id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // --- إدارة العهد (Assignments) ---
  async assignAsset(data: any) {
    const batch = writeBatch(this.db);
    
    // 1. إنشاء سجل العهدة
    const assignmentRef = doc(collection(this.db, paths.assetAssignments(this.companyId)));
    batch.set(assignmentRef, {
      ...data,
      status: 'in-use',
      companyId: this.companyId,
      assignedAt: serverTimestamp()
    });

    // 2. خصم الكمية من المخزون
    const itemRef = doc(this.db, paths.inventoryItems(this.companyId), data.itemId);
    batch.update(itemRef, {
      quantity: increment(-data.quantity)
    });

    return batch.commit();
  }

  async returnAsset(assignmentId: string, itemId: string, quantity: number) {
    const batch = writeBatch(this.db);

    // 1. تحديث حالة العهدة
    const assignmentRef = doc(this.db, paths.assetAssignments(this.companyId), assignmentId);
    batch.update(assignmentRef, {
      status: 'returned',
      returnedAt: serverTimestamp()
    });

    // 2. إعادة الكمية للمخزون
    const itemRef = doc(this.db, paths.inventoryItems(this.companyId), itemId);
    batch.update(itemRef, {
      quantity: increment(quantity)
    });

    return batch.commit();
  }
}
