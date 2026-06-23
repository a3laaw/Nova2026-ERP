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
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TemplateType, BaseTemplate, BOQTemplateItem } from '@/types/templates';
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

  async deleteTemplate(type: TemplateType, id: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const path = this.getCollectionPath(type);
    return deleteDoc(doc(this.db, path, id));
  }

  // --- BOQ Template Item Operations ---

  async getBOQTemplateItems(templateId: string): Promise<BOQTemplateItem[]> {
    const q = query(
      collection(this.db, paths.boqTemplateItems(this.companyId, templateId)),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQTemplateItem));
  }

  async saveBOQTemplateWithItems(templateId: string | null, templateData: any, items: BOQTemplateItem[], userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const batch = writeBatch(this.db);
    let finalTemplateId = templateId;

    // 1. Save Template Doc
    if (!templateId) {
      const newRef = doc(collection(this.db, paths.boqTemplates(this.companyId)));
      finalTemplateId = newRef.id;
      batch.set(newRef, {
        ...templateData,
        companyId: this.companyId,
        version: 1,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      const ref = doc(this.db, paths.boqTemplates(this.companyId), templateId);
      batch.update(ref, {
        ...templateData,
        updatedBy: userId,
        updatedAt: serverTimestamp()
      });

      // Clear old items for rewrite (Safe approach for template maintenance)
      const oldItems = await this.getBOQTemplateItems(templateId);
      oldItems.forEach(oi => {
        const itemRef = doc(this.db, paths.boqTemplateItems(this.companyId, templateId), oi.id!);
        batch.delete(itemRef);
      });
    }

    // 2. Save Items
    const itemsColl = collection(this.db, paths.boqTemplateItems(this.companyId, finalTemplateId!));
    items.forEach((item, idx) => {
      const itemRef = doc(itemsColl);
      batch.set(itemRef, {
        ...item,
        order: idx,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    return finalTemplateId;
  }

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
