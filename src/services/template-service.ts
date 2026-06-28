'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc, 
  serverTimestamp,
  query,
  getDocs,
  writeBatch,
  orderBy,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TemplateType, BaseTemplate, BOQTemplate, BOQTemplateItem } from '@/types/templates';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';
import { BOQReferenceNode } from '@/types/reference';

/**
 * خدمة إدارة القوالب المركزية (Template Service).
 * تعتمد حصراً على المرجع الشجري الموحد boqReferenceNodes.
 */
export class TemplateService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private userPermissions: string[] = []
  ) {}

  private getCollectionPath(type: TemplateType) {
    switch (type) {
      case 'quotation': return paths.quotationTemplates(this.companyId);
      case 'contract': return paths.contractTemplates(this.companyId);
      case 'boq': return paths.boqTemplates(this.companyId);
    }
  }

  /**
   * جلب العقد المرجعية من المصدر الموحد (boqReferenceNodes)
   */
  async getWorkItemsMaster(): Promise<BOQReferenceNode[]> {
    const q = query(
      collection(this.db, paths.boqReferenceNodes(this.companyId)),
      orderBy('depth'),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQReferenceNode));
  }

  /**
   * حفظ قالب المقايسة مع البنود من الشجرة الموحدة
   * تم تحسينه لضمان تخزين مفاتيح المطابقة الفنية للبحث الافتراضي
   */
  async saveBOQTemplateWithItems(templateId: string | null, templateData: Partial<BOQTemplate>, items: BOQTemplateItem[], userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    
    const batch = writeBatch(this.db);
    const boqCollection = collection(this.db, paths.boqTemplates(this.companyId));
    const finalTemplateId = templateId || doc(boqCollection).id;
    const templateRef = doc(boqCollection, finalTemplateId);

    // حساب العدادات للتخزين في الرأس لسرعة العرض في القائمة
    const itemsCount = items.length;
    const sectionsCount = new Set(items.flatMap(i => i.ancestorIds || [])).size;

    const headData = {
      ...templateData,
      // ضمان تخزين مفاتيح المطابقة الفنية كحقول مستقلة في قاعدة البيانات للبحث
      activityTypeId: templateData.activityTypeId || '',
      serviceId: templateData.serviceId || '',
      subServiceId: templateData.subServiceId || '',
      isDefault: !!templateData.isDefault,
      isActive: templateData.isActive !== false, // الافتراضي نشط إذا لم يحدد غير ذلك
      itemsCount,
      sectionsCount,
      companyId: this.companyId,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
      ...(templateId ? {} : { createdBy: userId, createdAt: serverTimestamp(), version: 1 })
    };
    
    // إزالة البنود من رأس القالب لتخزينها في المجموعة الفرعية (نظافة المعمارية)
    delete (headData as any).items;
    batch.set(templateRef, headData, { merge: true });

    const itemsCollection = collection(this.db, paths.boqTemplateItems(this.companyId, finalTemplateId));
    
    // إذا كان تحديثاً، نحذف البنود القديمة أولاً
    if (templateId) {
      const oldItemsSnap = await getDocs(itemsCollection);
      oldItemsSnap.docs.forEach(d => batch.delete(d.ref));
    }

    // إضافة البنود الجديدة مع كامل مسارها المرجعي
    items.forEach((item, idx) => {
      const itemRef = doc(itemsCollection);
      const itemToSave = {
        ...item,
        id: itemRef.id,
        order: idx,
        companyId: this.companyId,
        createdAt: item.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(itemRef, itemToSave);
    });

    try {
      await batch.commit();
      return finalTemplateId;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: templateRef.path, operation: templateId ? 'update' : 'create'
      }));
      throw err;
    }
  }

  async getBOQTemplateItems(templateId: string): Promise<BOQTemplateItem[]> {
    const q = query(
      collection(this.db, paths.boqTemplateItems(this.companyId, templateId)),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQTemplateItem));
  }

  async deleteTemplate(type: TemplateType, id: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    return deleteDoc(docRef);
  }

  async updateTemplate(type: TemplateType, id: string, data: Partial<BaseTemplate>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const path = this.getCollectionPath(type);
    const docRef = doc(this.db, path, id);
    return updateDoc(docRef, { ...data, updatedBy: userId, updatedAt: serverTimestamp() });
  }

  async addTemplate(type: TemplateType, data: Partial<BaseTemplate>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const path = this.getCollectionPath(type);
    const collRef = collection(this.db, path);
    return addDoc(collRef, {
      ...data,
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      version: 1
    });
  }
}
