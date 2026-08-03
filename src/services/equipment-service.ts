'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خدمة إدارة المعدات والآليات (Equipment Service).
 * تم تحديثها لتتوافق مع Pattern 1 (Non-blocking mutations) وتفعيل محرك الأخطاء السياقية.
 */
export class EquipmentService {
  constructor(private db: Firestore, private companyId: string) {}

  createEquipment(data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const equipRef = doc(collection(this.db, path));
    
    const docData = {
      ...data,
      id: equipRef.id,
      companyId: this.companyId,
      status: 'available',
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // تنفيذ الكتابة بدون await (Optimistic Write)
    setDoc(equipRef, docData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: equipRef.path,
          operation: 'create',
          requestResourceData: docData
        } satisfies SecurityRuleContext);

        // إرسال الخطأ للمستمع العالمي ليظهر في واجهة المطور/المالك
        errorEmitter.emit('permission-error', permissionError);
      });
      
    return equipRef.id;
  }

  updateEquipment(id: string, data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const ref = doc(this.db, path, id);
    const docData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    updateDoc(ref, docData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: docData
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
      });
  }

  deleteEquipment(id: string) {
    const ref = doc(this.db, paths.equipment(this.companyId), id);
    updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: { isActive: false }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
  }
}