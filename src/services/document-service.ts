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
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, ContractTemplate, BOQTemplate, BOQTemplateItem } from '@/types/templates';
import { Quotation, Contract, BOQ, BOQItem } from '@/types/documents';
import { Transaction, StageInstance } from '@/types/transaction';
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
   * استنساخ عرض سعر من قالب
   */
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
      items: JSON.parse(JSON.stringify(template.items || [])), // Deep Copy
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

  /**
   * استنساخ عقد من قالب مع ربط الدفعات بمراحل المعاملة
   */
  async instantiateContractFromTemplate(templateId: string, transactionId: string, userId: string): Promise<string> {
    const templateRef = doc(this.db, paths.contractTemplates(this.companyId), templateId);
    const transRef = doc(this.db, paths.transactions(this.companyId), transactionId);

    const [templateSnap, transSnap] = await Promise.all([getDoc(templateRef), getDoc(transRef)]);

    if (!templateSnap.exists() || !transSnap.exists()) {
      throw new Error('MISSING_CONTEXT');
    }

    const template = templateSnap.data() as ContractTemplate;
    const transaction = transSnap.data() as Transaction;

    const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
    const stageInstances = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageInstance));

    const docRef = doc(collection(this.db, paths.contracts(this.companyId)));
    
    const linkedMilestones = (template.defaultMilestones || []).map(m => {
      const instance = stageInstances.find(si => si.technicalStageId === m.technicalStageId);
      return {
        ...m,
        linkedStageInstanceId: instance?.id || null
      };
    });

    const contractData: Contract = {
      id: docRef.id,
      transactionId,
      clientId: transaction.clientId,
      clientName: transaction.clientName,
      templateId,
      name: `${template.name} - ${transaction.transactionNumber}`,
      introText: template.introText,
      legalText: template.legalText,
      closingText: template.closingText,
      clauses: JSON.parse(JSON.stringify(template.clauses || [])),
      milestones: linkedMilestones as any,
      status: 'draft',
      totalAmount: 0,
      version: 1,
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, contractData);
    return docRef.id;
  }

  /**
   * استنساخ جدول كميات (BOQ) فعلي من قالب وربطه بالمعاملة أو المشروع
   * محرك الاستنساخ السيادي - NovaFlow Core
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
    
    // 1. التحقق من صلاحية الإنشاء
    ensureActionPermission(this.permissions, 'projects:create');

    // 2. جلب بيانات القالب ورأس القالب
    const templateRef = doc(this.db, paths.boqTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) {
      throw new Error('TEMPLATE_NOT_FOUND: القالب غير موجود في النظام.');
    }

    const template = templateSnap.data() as BOQTemplate;
    
    // 3. جلب كافة بنود القالب من المجموعة الفرعية
    const templateItemsSnap = await getDocs(collection(this.db, paths.boqTemplateItems(this.companyId, templateId)));
    
    // 4. توليد رقم المقايسة والمسار الجديد
    const boqNumber = await this.getNextBOQNumber();
    const boqRef = doc(collection(this.db, paths.boqs(this.companyId)));
    const boqId = boqRef.id;

    // 5. بناء كائن المقايسة الفعلي (Runtime BOQ Header)
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
    
    // كتابة رأس المقايسة
    batch.set(boqRef, boqData);

    // 6. استنساخ البنود إلى المجموعة الفرعية (Runtime Items)
    templateItemsSnap.docs.forEach(itemDoc => {
      const item = itemDoc.data() as BOQTemplateItem;
      const itemRef = doc(collection(this.db, paths.boqItems(this.companyId, boqId)));
      
      const runtimeItem: BOQItem = {
        id: itemRef.id,
        boqId,
        workItemMasterId: item.workItemMasterId || '',
        sectionId: item.sectionId,
        sectionName: item.sectionName,
        mainCategoryId: item.mainCategoryId,
        mainCategoryName: item.mainCategoryName,
        componentId: item.componentId,
        componentName: item.componentName,
        itemCode: item.itemCode || '',
        description: item.description || item.name || '',
        unit: item.unit,
        unitTypeId: item.unitTypeId || '',
        unitSymbol: item.unitSymbol || '',
        plannedQuantity: item.plannedQuantity || 0,
        executedQuantity: 0, // تصفير الإنجاز الفعلي عند البدء
        estimatedRate: item.estimatedRate || 0,
        estimatedCostRate: item.estimatedCostRate || 0,
        notes: item.notes || '',
        technicalStageId: item.technicalStageId || '',
        billingTriggerGroup: item.billingTriggerGroup || '',
        materialCodes: item.materialCodes || [],
        order: item.order !== undefined ? item.order : 0,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      batch.set(itemRef, runtimeItem);
    });

    // 7. توثيق الحدث في المعاملة (إذا تم الربط)
    if (payload.transactionId) {
      const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, payload.transactionId)));
      batch.set(timelineRef, {
        transactionId: payload.transactionId,
        type: 'system',
        content: `تم إنشاء جدول كميات فعلي برقم ${boqNumber} من القالب المرجعي: ${template.name}`,
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
}