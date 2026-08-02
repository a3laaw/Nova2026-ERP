'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  serverTimestamp, 
  query,
  where,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { nextSequential } from '@/lib/counters';
import { paths } from '@/firebase/multi-tenant';
import { PurchaseOrder, POItem, POStatus } from '@/types/procurement';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class ProcurementService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async getNextPONumber(): Promise<string> {
    const year = new Date().getFullYear();
    return nextSequential(this.db, this.companyId, 'po', `PO-${year}-`, 4);
  }

  async createPurchaseOrder(data: Partial<PurchaseOrder>, items: Partial<POItem>[], userId: string) {
    ensureActionPermission(this.permissions, 'procurement:create');

    const poRef = doc(collection(this.db, paths.purchaseOrders(this.companyId)));
    const poNumber = await this.getNextPONumber();
    const batch = writeBatch(this.db);

    const poData: PurchaseOrder = {
      ...data,
      id: poRef.id,
      poNumber,
      status: 'draft',
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as PurchaseOrder;

    batch.set(poRef, poData);

    const itemsPath = paths.poItems(this.companyId, poRef.id);
    items.forEach((item, idx) => {
      const itemRef = doc(collection(this.db, itemsPath));
      batch.set(itemRef, {
        ...item,
        id: itemRef.id,
        poId: poRef.id,
        receivedQuantity: 0,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    });

    try {
      await batch.commit();
      return poRef.id;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: poRef.path, operation: 'create', requestResourceData: poData
      }));
      throw err;
    }
  }

  async updatePOStatus(poId: string, status: POStatus, userId: string) {
    const poRef = doc(this.db, paths.purchaseOrders(this.companyId), poId);
    const updateData: any = { status, updatedBy: userId, updatedAt: serverTimestamp() };
    
    if (status === 'approved') {
      ensureActionPermission(this.permissions, 'procurement:approve');
      updateData.approvedBy = userId;
      updateData.approvedAt = serverTimestamp();
    }

    return updateDoc(poRef, updateData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: poRef.path, operation: 'update', requestResourceData: updateData
      }));
      throw err;
    });
  }
}
