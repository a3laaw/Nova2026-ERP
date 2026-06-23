'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TemplateType, BaseTemplate } from '@/types/templates';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class TemplateService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private userPermissions: string[] = []
  ) {}

  /**
   * جلب مسار المجموعة بناءً على النوع
   */
  private getCollectionPath(type: TemplateType) {
    switch (type) {
      case 'quotation': return paths.quotationTemplates(this.companyId);
      case 'contract': return paths.contractTemplates(this.companyId);
      case 'boq': return paths.boqTemplates(this.companyId);
    }
  }

  /**
   * إضافة قالب جديد
   */
  async addTemplate(type: TemplateType, data: Partial<BaseTemplate>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    
    const path = this.getCollectionPath(type);
    const docData = {
      ...data,
      companyId: this.companyId,
      version: 1,
      isActive: true,
      isDefault: data.isDefault || false,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      // إذا كان القالب افتراضياً، يجب إلغاء الافتراضي عن الآخرين لنفس النشاط والخدمة
      if (docData.isDefault) {
        await this.clearDefaultTemplates(type, docData.activityTypeId, docData.serviceId);
      }

      return await addDoc(collection(this.db, path), docData);
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
      throw err;
    }
  }

  /**
   * تحديث قالب موجود
   */
  async updateTemplate(type: TemplateType, id: string, data: Partial<BaseTemplate>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);

    try {
      if (data.isDefault) {
        await this.clearDefaultTemplates(type, data.activityTypeId!, data.serviceId!);
      }

      await updateDoc(docRef, {
        ...data,
        updatedBy: userId,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
      }));
      throw err;
    }
  }

  /**
   * حذف قالب
   */
  async deleteTemplate(type: TemplateType, id: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const path = this.getCollectionPath(type);
    return deleteDoc(doc(this.db, path, id));
  }

  /**
   * وظيفة خاصة لإلغاء القوالب الافتراضية السابقة لضمان وجود افتراضي واحد فقط لكل خدمة
   */
  private async clearDefaultTemplates(type: TemplateType, activityTypeId: string, serviceId: string) {
    const path = this.getCollectionPath(type);
    const q = query(
      collection(this.db, path),
      where('activityTypeId', '==', activityTypeId),
      where('serviceId', '==', serviceId),
      where('isDefault', '==', true)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(this.db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { isDefault: false, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  }
}
