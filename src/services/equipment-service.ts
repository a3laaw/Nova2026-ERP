'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خدمة إدارة المعدات والآليات (Equipment Service).
 * تم تحديثها لتدعم بنية تقارير الأخطاء السياقية لضمان الشفافية الأمنية.
 */
export class EquipmentService {
  constructor(private db: Firestore, private companyId: string) {}

  async createEquipment(data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      status: 'available',
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // تنفيذ الكتابة مع ربط محرك الأخطاء السياقية
    return addDoc(collection(this.db, path), docData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: `companies/${this.companyId}/equipment`,
          operation: 'create',
          requestResourceData: docData
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
      });
  }

  async updateEquipment(id: string, data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const ref = doc(this.db, path, id);
    const docData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    return updateDoc(ref, docData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: docData
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
      });
  }

  async deleteEquipment(id: string) {
    const ref = doc(this.db, paths.equipment(this.companyId), id);
    return updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: { isActive: false }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
      });
  }
}
