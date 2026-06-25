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
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TemplateType, BaseTemplate, BOQTemplate, BOQTemplateItem } from '@/types/templates';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';
import { BOQReferenceNode } from '@/types/reference';

/**
 * خدمة إدارة القوالب المركزية (Template Service).
 * تعمل حصراً مع مرجع boqReferenceNodes كمصدر وحيد للحقيقة.
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
   * حفظ قالب المقايسة مع كافة بنوده الديناميكية
   */
  async saveBOQTemplateWithItems(templateId: string | null, templateData: Partial<BOQTemplate>, items: BOQTemplateItem[], userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    
    const batch = writeBatch(this.db);
    const boqCollection = collection(this.db, paths.boqTemplates(this.companyId));
    const finalTemplateId = templateId || doc(boqCollection).id;
    const templateRef = doc(boqCollection, finalTemplateId);

    // 1. معالجة رأس القالب
    const headData = {
      ...templateData,
      companyId: this.companyId,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
      ...(templateId ? {} : { createdBy: userId, createdAt: serverTimestamp(), version: 1, isActive: true })
    };
    
    // مسح مصفوفة العناصر من الرأس لضمان تخزينها فقط في المجموعة الفرعية
    delete (headData as any).items;

    batch.set(templateRef, headData, { merge: true });

    // 2. تحديث البنود في المجموعة الفرعية (Flat Subcollection)
    const itemsCollection = collection(this.db, paths.boqTemplateItems(this.companyId, finalTemplateId));
    
    // مسح البنود القديمة لضمان نظافة الهيكل المنسوخ
    if (templateId) {
      const oldItemsSnap = await getDocs(itemsCollection);
      oldItemsSnap.docs.forEach(d => batch.delete(d.ref));
    }

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
        path: templateRef.path, operation: templateId ? 'update' : 'create', requestResourceData: headData,
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
    return addDoc(collection(this.db, path), {
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
