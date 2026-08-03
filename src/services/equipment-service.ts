'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { handleWriteError } from '@/lib/write-error';

export class EquipmentService {
  constructor(private db: Firestore, private companyId: string) {}

  async createRentedEquipment(data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const docData = {
      ...data,
      type: 'rented_asset',
      ownershipType: 'rented',
      companyId: this.companyId,
      status: 'available',
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    try {
      return await addDoc(collection(this.db, path), docData);
    } catch (err: any) {
      await handleWriteError(err, { path, operation: 'create', requestResourceData: docData });
    }
  }

  async deleteEquipment(id: string) {
    const ref = doc(this.db, paths.equipment(this.companyId), id);
    await updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() });
  }
}
