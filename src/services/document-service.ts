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
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem, QuotationTemplate, ContractTemplate } from '@/types/templates';
import { Quotation, Contract, BOQ, BOQItem } from '@/types/documents';
import { Transaction } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المستندات الحية (Document Service).
 * مسؤولة عن استنساخ القوالب وتحويلها إلى سجلات تنفيذية مرتبطة بالمعاملات والمشاريع.
 */
export class DocumentService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * توليد رقم متسلسل مهني للمقايسات (BOQ-2026-0001)
   */
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
      const nextSeq = (lastSeq + 1).toString().padStart(4, '0');
      
      return `${prefix}${nextSeq}`;
    } catch (e) {
      console.warn("Numbering fetch error, fallback to first:", e);
      return `${prefix}0001`;
    }
  }

  /**
   * استنساخ جدول كميات (BOQ) فعلي من قالب وربطه بالمعاملة أو المشروع.
   * الحالة تبدأ بـ 'draft' للسماح بتعديل الكميات المخصصة لهذا المشروع قبل الاعتماد النهائي.
   */
  async instantiateBoqFromTemplate(
    templateId: string, 
    payload: { 
      transactionId?: string, 
      projectId?: string, 
      clientId?: string, 
      clientName?: string,
      activityTypeId?: string,
      serviceId?: string,
      subServiceId?: string,
      name?: string,
      description?: string
    }, 
    userId: string,
    userName: string
  ): Promise<string> {
    
    ensureActionPermission(this.permissions, 'projects:create');

    const templateRef = doc(this.db, paths.boqTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) {
      throw new Error('TEMPLATE_NOT_FOUND: القالب المختار غير موجود في النظام.');
    }

    const template = templateSnap.data() as BOQTemplate;
    const templateItemsSnap = await getDocs(collection(this.db, paths.boqTemplateItems(this.companyId, templateId)));
    
    const boqNumber = await this.getNextBOQNumber();
    const boqRef = doc(collection(this.db, paths.boqs(this.companyId)));
    const boqId = boqRef.id;

    const boqData: BOQ = {
      id: boqId,
      boqNumber,
      transactionId: payload.transactionId || '',
      projectId: payload.projectId || '',
      clientId: payload.clientId || '',
      clientName: payload.clientName || '',
      templateId,
      templateName: template.name,
      name: payload.name || `${template.name} - ${boqNumber}`,
      description: payload.description || template.description || '',
      activityTypeId: payload.activityTypeId || template.activityTypeId,
      serviceId: payload.serviceId || template.serviceId,
      subServiceId: payload.subServiceId || template.subServiceId,
      measurementMode: template.measurementMode || 'quantity',
      status: 'draft', // تبدأ كمسودة للسماح بالتعديل المشروع-تلو-المشروع
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
      
      const technicalStageIds = item.technicalStageIds && item.technicalStageIds.length > 0
        ? item.technicalStageIds
        : (item.technicalStageId ? [item.technicalStageId] : []);

      const runtimeItem: BOQItem = {
        id: itemRef.id,
        boqId,
        transactionId: payload.transactionId || '',
        projectId: payload.projectId || '',
        
        boqReferenceNodeId: item.boqReferenceNodeId,
        referenceCode: item.referenceCode,
        referenceTitle: item.referenceTitle,
        referenceDescription: item.referenceDescription || '',
        parentId: item.parentId,
        ancestorIds: item.ancestorIds || [],
        ancestorTitles: item.ancestorTitles || [],
        depth: item.depth || 0,

        unitTypeId: item.unitTypeId || '',
        unitName: item.unitName || '',
        unitSymbol: item.unitSymbol || '',
        technicalStageId: item.technicalStageId || '',
        technicalStageIds,
        billingTriggerGroup: item.billingTriggerGroup || '',
        allowedItemCategoryIds: item.allowedItemCategoryIds || [],

        plannedQuantity: item.plannedQuantity || 0,
        executedQuantity: 0,
        estimatedRate: item.estimatedRate || 0,
        estimatedCostRate: item.estimatedCostRate || 0,
        notes: item.notes || '',
        order: item.order !== undefined ? item.order : 0,
        
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      batch.set(itemRef, runtimeItem);
    });

    if (payload.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, payload.transactionId)));
      batch.set(timelineRef, {
        transactionId: payload.transactionId,
        type: 'system',
        content: `تم استنساخ مسودة مقايسة للمشروع من القالب المرجعي برقم ${boqNumber}`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    try {
      await batch.commit();
      return boqId;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: boqRef.path, operation: 'write', requestResourceData: boqData
      }));
      throw err;
    }
  }

  /**
   * تحديث كمية وفئة بند في ميزانية المسودة (تعديل المشروع فقط)
   */
  async updateBOQItem(boqId: string, itemId: string, qty: number, rate: number) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), itemId);
    await updateDoc(itemRef, {
      plannedQuantity: qty,
      estimatedRate: rate,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * اعتماد المقايسة كـ Baseline رسمي للمشروع
   */
  async approveBOQ(boqId: string, totalAmount: number, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    
    await updateDoc(boqRef, {
      status: 'approved',
      totalAmount,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });

    // توثيق الاعتماد في التايم لاين
    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم اعتماد الميزانية المرجعية (Project Baseline) بقيمة إجمالية ${totalAmount.toLocaleString()} KWD. تم قفل التعديل المباشر.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
  }

  async deleteBOQ(boqId: string, transactionId?: string, userId?: string, userName?: string) {
    ensureActionPermission(this.permissions, 'projects:delete');

    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const itemsRef = collection(this.db, paths.boqItems(this.companyId, boqId));
    
    const itemsSnap = await getDocs(itemsRef);
    const batch = writeBatch(this.db);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(boqRef);

    if (transactionId && userId) {
       const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
       batch.set(timelineRef, {
         transactionId,
         type: 'system',
         content: `تم حذف المقايسة المربوطة لتصفير العمل والبدء من جديد.`,
         userId,
         userName,
         companyId: this.companyId,
         createdAt: serverTimestamp()
       });
    }

    await batch.commit().catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: boqRef.path, operation: 'delete'
      }));
      throw err;
    });
  }

  async instantiateQuotationFromTemplate(templateId: string, transactionId: string, userId: string): Promise<string> {
    const templateRef = doc(this.db, paths.quotationTemplates(this.companyId), templateId);
    const transRef = doc(this.db, paths.transactions(this.companyId), transactionId);

    const [templateSnap, transSnap] = await Promise.all([getDoc(templateRef), getDoc(transRef)]);

    if (!templateSnap.exists() || !transSnap.exists()) {
      throw new Error('MISSING_CONTEXT: القالب أو المعاملة غير موجودة.');
    }

    const template = templateSnap.data() as QuotationTemplate;
    const transaction = transSnap.data() as Transaction;

    const docRef = doc(collection(this.db, paths.quotations(this.companyId)));
    const quotationData: Quotation = {
      id: docRef.id,
      transactionId,
      clientId: transaction.clientId,
      clientName: transaction.clientName,
      templateId,
      name: `${template.name} - ${transaction.transactionNumber}`,
      introText: template.introText,
      defaultTerms: template.defaultTerms,
      validDays: template.validDays || 30,
      pricingMode: template.pricingMode,
      items: JSON.parse(JSON.stringify(template.items || [])),
      status: 'draft',
      totalAmount: 0, 
      version: 1,
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, quotationData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path, operation: 'create', requestResourceData: quotationData
      }));
      throw err;
    });

    return docRef.id;
  }
}
