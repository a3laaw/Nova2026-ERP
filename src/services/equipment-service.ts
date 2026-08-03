'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خدمة إدارة المعدات والآليات (Equipment Service).
 * تتبع نمط Pattern 1 (Non-blocking) لضمان سلاسة تجربة المستخدم.
 */
export class EquipmentService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء معدة جديدة - يتم الحفظ دون انتظار (Optimistic)
   */
  createEquipment(data: Partial<Equipment>, userId: string) {
    if (!this.db || !this.companyId) return;

    const path = paths.equipment(this.companyId);
    const equipRef = doc(collection(this.db, path));
    
    const docData = {
      ...data,
      id: equipRef.id,
      companyId: this.companyId,
      status: data.status || 'available',
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // تنفيذ الكتابة دون await (Pattern 1)
    setDoc(equipRef, docData)
      .catch(async (serverError) => {
        // إذا فشل الحفظ في السحاب، نطلق الخطأ السياقي للمستمع العالمي
        const permissionError = new FirestorePermissionError({
          path: equipRef.path,
          operation: 'create',
          requestResourceData: docData
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
      });
      
    return equipRef.id;
  }

  /**
   * تحديث معدة موجودة
   */
  updateEquipment(id: string, data: Partial<Equipment>, userId: string) {
    const ref = doc(this.db, paths.equipment(this.companyId), id);
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
}