'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  serverTimestamp, 
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem, QuotationTemplate, ContractTemplate } from '@/types/templates';
import { Quotation, Contract, BOQ, BOQItem } from '@/types/documents';
import { Transaction } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';
import { TransactionService } from './transaction-service';
import { BOQReferenceNode } from '@/types/reference';

export class DocumentService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async getNextBOQNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BOQ-${year}-`;
    try {
      const q = query(
        collection(this.db, paths.boqs(this.companyId)),
        where('boqNumber', '>=', `${prefix}0000`),
        where('boqNumber', '<=', `${prefix}9999`),
        orderBy('boqNumber', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return `${prefix}0001`;
      const lastNumStr = snap.docs[0].data().boqNumber;
      const parts = lastNumStr.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      return `${prefix}${(lastSeq + 1).toString().padStart(4, '0')}`;
    } catch (e) {
      return `${prefix}0001`;
    }
  }

  async instantiateBoqFromTemplate(
    templateId: string, 
    payload: { 
      transactionId: string, 
      clientId: string, 
      clientName: string,
      activityTypeId: string,
      serviceId: string,
      subServiceId: string,
      name: string
    }, 
    userId: string,
    userName: string
  ): Promise<string> {
    ensureActionPermission(this.permissions, 'projects:create');

    const templateRef = doc(this.db, paths.boqTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) throw new Error('TEMPLATE_NOT_FOUND');

    const template = templateSnap.data() as BOQTemplate;
    const templateItemsSnap = await getDocs(collection(this.db, paths.boqTemplateItems(this.companyId, templateId)));
    
    const boqNumber = await this.getNextBOQNumber();
    const boqRef = doc(collection(this.db, paths.boqs(this.companyId)));
    const boqId = boqRef.id;

    // البدء كحالة APPROVED تلقائياً كما تم الاتفاق عليه، ولكن للسماح بالتعديل نتركها DRAFT حتى يضغط "اعتماد"
    const boqData: BOQ = {
      id: boqId,
      boqNumber,
      transactionId: payload.transactionId,
      clientId: payload.clientId,
      clientName: payload.clientName,
      templateId,
      templateName: template.name,
      name: payload.name || `${template.name} - ${boqNumber}`,
      activityTypeId: payload.activityTypeId,
      serviceId: payload.serviceId,
      subServiceId: payload.subServiceId,
      measurementMode: template.measurementMode || 'quantity',
      status: 'draft', 
      totalAmount: template.baseAmount || 0,
      version: 1,
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const batch = writeBatch(this.db);
    batch.set(boqRef, boqData);

    templateItemsSnap.docs.forEach(itemDoc => {
      const item = itemDoc.data() as BOQTemplateItem;
      const itemRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
      const runtimeItem: BOQItem = {
        ...item,
        id: itemRef.id,
        boqId,
        transactionId: payload.transactionId,
        executedQuantity: 0,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(itemRef, runtimeItem);
    });

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, payload.transactionId));
    await addDoc(timelineRef, {
      transactionId: payload.transactionId,
      type: 'system',
      content: `تم استنساخ مسودة مقايسة للمشروع (${boqNumber}). يرجى تخصيص الكميات والبنود قبل الاعتماد الميداني.`,
      userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
    });

    await batch.commit();
    return boqId;
  }

  /**
   * إضافة بند مستجد يدوياً للمقايسة (في مرحلة المسودة)
   */
  async addBOQItemFromNode(boqId: string, transactionId: string, node: BOQReferenceNode, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const itemRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
    
    const newItem: BOQItem = {
      id: itemRef.id,
      boqId,
      transactionId,
      boqReferenceNodeId: node.id!,
      referenceCode: node.code,
      referenceTitle: node.title,
      referenceDescription: node.description || '',
      parentId: node.parentId,
      ancestorIds: node.ancestorIds || [],
      depth: node.depth || 0,
      unitTypeId: node.unitTypeId,
      unitName: node.unitName,
      unitSymbol: node.unitSymbol,
      technicalStageId: node.technicalStageId || '',
      technicalStageIds: node.technicalStageIds || [],
      plannedQuantity: 1,
      executedQuantity: 0,
      estimatedRate: node.estimatedRate || 0,
      order: 99,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(itemRef, newItem);
    return itemRef.id;
  }

  async updateBOQItem(boqId: string, itemId: string, qty: number, rate: number) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    await updateDoc(itemRef, { plannedQuantity: qty, estimatedRate: rate, updatedAt: serverTimestamp() });
  }

  /**
   * الاعتماد السيادي: قفل المقايسة وتوليد المسار الفني للمعاملة
   */
  async approveBOQ(boqId: string, totalAmount: number, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const boqSnap = await getDoc(boqRef);
    if (!boqSnap.exists()) return;
    const boq = boqSnap.data() as BOQ;

    // 1. تحديث حالة المقايسة
    await updateDoc(boqRef, {
      status: 'approved',
      totalAmount,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });

    // 2. حقن المسار الفني للمعاملة فوراً
    const transService = new TransactionService(this.db, this.companyId, this.permissions);
    await transService.initializeTechnicalPath(transactionId, boq.activityTypeId!, boq.serviceId!, boq.subServiceId!, userId);

    // 3. توثيق الاعتماد
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم اعتماد الميزانية المرجعية بقيمة ${totalAmount.toLocaleString()} KWD. تم تفعيل المسار الفني وبدء التنفيذ الميداني.`,
      userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
    });
  }

  /**
   * حذف المقايسة وتطهير المسار الفني المرتبط بها تماماً للسماح بإعادة التهيئة بدون تكرار (Duplicates)
   */
  async deleteBOQ(boqId: string, transactionId?: string, userId?: string, userName?: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const batch = writeBatch(this.db);
    
    // 1. حذف بنود المقايسة والمقايسة نفسها
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(boqRef);
    
    // 2. إذا كانت مرتبطة بمعاملة، نقوم بـ "تطهير" مراحل التنفيذ الميدانية لمنع التكرار (Duplicates)
    if (transactionId) {
       const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
       stagesSnap.docs.forEach(d => batch.delete(d.ref));

       // توثيق عملية التطهير في التايم لاين
       const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
       batch.set(timelineRef, {
         transactionId, 
         type: 'system', 
         content: `تنبيه: تم حذف المقايسة المربوطة وتطهير المسار الفني بالكامل لإعادة هندسة المشروع من جديد.`,
         userId, 
         userName, 
         companyId: this.companyId, 
         createdAt: serverTimestamp()
       });
    }
    
    await batch.commit();
  }
}
