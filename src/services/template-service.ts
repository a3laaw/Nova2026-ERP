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
  getDocs,
  writeBatch,
  where,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TemplateType, BaseTemplate, BOQTemplate, BOQTemplateItem } from '@/types/templates';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

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
   * جلب قاموس بنود العمل المرجعي
   */
  async getWorkItemsMaster() {
    const q = query(
      collection(this.db, paths.boqWorkItemsMaster(this.companyId)),
      orderBy('sectionName')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * حفظ قالب المقايسة مع كافة بنوده في عملية واحدة (Batch Save)
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
    batch.set(templateRef, headData, { merge: true });

    // 2. معالجة البنود في المجموعة الفرعية (Sync Mode)
    const itemsCollection = collection(this.db, paths.boqTemplateItems(this.companyId, finalTemplateId));
    
    const oldItemsSnap = await getDocs(itemsCollection);
    oldItemsSnap.docs.forEach(d => batch.delete(d.ref));

    items.forEach((item, idx) => {
      const itemRef = doc(itemsCollection);
      batch.set(itemRef, {
        ...item,
        id: itemRef.id,
        order: idx,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    try {
      await batch.commit();
      return finalTemplateId;
    } catch (err) {
      this.handleError(templateRef.path, templateId ? 'update' : 'create', headData);
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

  private handleError(path: string, operation: any, data?: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path, operation, requestResourceData: data,
    }));
  }
}
