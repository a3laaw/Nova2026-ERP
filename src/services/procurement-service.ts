'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  serverTimestamp, 
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
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

  /**
   * توليد رقم متسلسل لأمر الشراء (PO-2026-0001)
   */
  async getNextPONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    
    const q = query(
      collection(this.db, paths.purchaseOrders(this.companyId)),
      where('poNumber', '>=', `${prefix}0000`),
      where('poNumber', '<=', `${prefix}9999`),
      orderBy('poNumber', 'desc'),
      limit(1)
    );
    
    const snap = await getDocs(q);
    if (snap.empty) return `${prefix}0001`;
    
    const lastNumStr = snap.docs[0].data().poNumber;
    const parts = lastNumStr.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    return `${prefix}${(lastSeq + 1).toString().padStart(4, '0')}`;
  }

  /**
   * إنشاء أمر شراء جديد مع البنود في خطوة واحدة (Atomic Write)
   */
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
