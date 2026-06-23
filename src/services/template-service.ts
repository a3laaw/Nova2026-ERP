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
  writeBatch,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TemplateType, BaseTemplate, BOQTemplateItem } from '@/types/templates';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المكتبة المركزية للقوالب (Template Service).
 * تدعم: عروض الأسعار، العقود، والمقايسات (BOQ) مع بنودها الفرعية.
 */
export class TemplateService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private userPermissions: string[] = []
  ) {}

  /**
   * جلب المسار الصحيح بناءً على نوع القالب
   */
  private getCollectionPath(type: TemplateType) {
    switch (type) {
      case 'quotation': return paths.quotationTemplates(this.companyId);
      case 'contract': return paths.contractTemplates(this.companyId);
      case 'boq': return paths.boqTemplates(this.companyId);
    }
  }

  // --- 1. عمليات القوالب العامة (Add, Update, Delete) ---

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
      // إذا تم تعيينه كافتراضي، يجب إلغاء الافتراضي عن البقية في نفس الفئة
      if (docData.isDefault) {
        await this.clearDefaultTemplates(type, docData.activityTypeId, docData.serviceId);
      }
      return await addDoc(collection(this.db, path), docData);
    } catch (err) {
      this.handleError(path, 'create', docData);
      throw err;
    }
  }

  async updateTemplate(type: TemplateType, id: string, data: Partial<BaseTemplate>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);

    const updateData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    try {
      if (data.isDefault) {
        await this.clearDefaultTemplates(type, data.activityTypeId!, data.serviceId!);
      }
      await updateDoc(docRef, updateData);
    } catch (err) {
      this.handleError(docRef.path, 'update', data);
      throw err;
    }
  }

  async deleteTemplate(type: TemplateType, id: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    
    return deleteDoc(docRef).catch(err => {
      this.handleError(docRef.path, 'delete');
      throw err;
    });
  }

  // --- 2. عمليات بنود المقايسات (BOQ Template Items) - Source of Truth: Subcollection ---

  /**
   * جلب كافة بنود مقايسة معينة مرتبة حسب الحقل order
   */
  async listBOQTemplateItems(templateId: string): Promise<BOQTemplateItem[]> {
    const path = paths.boqTemplateItems(this.companyId, templateId);
    const q = query(collection(this.db, path), orderBy('order'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQTemplateItem));
  }

  /**
   * إضافة بند جديد لمقايسة (يُحفظ في المجموعة الفرعية)
   */
  async addBOQTemplateItem(templateId: string, item: Omit<BOQTemplateItem, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>, userId?: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const path = paths.boqTemplateItems(this.companyId, templateId);
    const itemRef = doc(collection(this.db, path));
    
    const docData = {
      ...item,
      id: itemRef.id,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return setDoc(itemRef, docData).catch(err => {
      this.handleError(itemRef.path, 'create', docData);
      throw err;
    });
  }

  /**
   * تحديث بند مقايسة موجود
   */
  async updateBOQTemplateItem(templateId: string, itemId: string, data: Partial<BOQTemplateItem>, userId?: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const path = paths.boqTemplateItems(this.companyId, templateId);
    const docRef = doc(this.db, path, itemId);

    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };

    return updateDoc(docRef, updateData).catch(err => {
      this.handleError(docRef.path, 'update', data);
      throw err;
    });
  }

  /**
   * حذف بند من المقايسة
   */
  async deleteBOQTemplateItem(templateId: string, itemId: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const path = paths.boqTemplateItems(this.companyId, templateId);
    const docRef = doc(this.db, path, itemId);
    
    return deleteDoc(docRef).catch(err => {
      this.handleError(docRef.path, 'delete');
      throw err;
    });
  }

  // --- 3. الدوال المساعدة (Private Helpers) ---

  /**
   * تنظيف حالة "الافتراضي" من القوالب الأخرى لضمان وجود قالب واحد فقط كمرجع لكل خدمة
   */
  private async clearDefaultTemplates(type: TemplateType, activityTypeId?: string, serviceId?: string) {
    if (!activityTypeId || !serviceId) return;
    
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

  /**
   * معالجة أخطاء الصلاحيات والارتباط مع واجهة المستخدم
   */
  private handleError(path: string, operation: any, data?: any) {
    const permissionError = new FirestorePermissionError({
      path,
      operation,
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}
