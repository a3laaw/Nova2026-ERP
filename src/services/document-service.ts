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
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { nextSequential } from '@/lib/counters';
import { paths } from '@/firebase/multi-tenant';
import { BOQTemplate, BOQTemplateItem, QuotationTemplate, ContractTemplate, SubConContractTemplate } from '@/types/templates';
import { Quotation, Contract, BOQ, BOQItem } from '@/types/documents';
import { ensureActionPermission } from '@/lib/permissions';
import { TransactionService } from './transaction-service';
import { BOQReferenceNode } from '@/types/reference';
import { ClientService } from './client-service';
import { AccountingService } from './accounting-service';
import { BillingService } from './billing-service';

export class DocumentService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async updateContract(id: string, data: Partial<Contract>, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const docRef = doc(this.db, paths.contracts(this.companyId), id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const currentData = snap.data() as Contract;

    const updates: any = {
      ...data,
      isHistoryRecorded: true,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    await updateDoc(docRef, updates);

    const finalStatus = data.status || currentData.status;
    
    if (['approved', 'paid', 'active', 'signed'].includes(finalStatus)) {
       const clientRef = doc(this.db, paths.clients(this.companyId), currentData.clientId);
       await updateDoc(clientRef, { status: 'contracted', updatedAt: serverTimestamp() });

       const accService = new AccountingService(this.db, this.companyId);
       await accService.ensureControlAccount('1202', 'ذمم العملاء', 'Accounts Receivable', 'asset');
       await accService.createAutomaticSubAccount('1202', currentData.clientId, currentData.clientName, 'asset');

       const billing = new BillingService(this.db, this.companyId);
       await billing.triggerMilestoneBilling(currentData.transactionId || '', 'SIGNING', 'at', userId, 'System System');

       if (currentData.transactionId) {
          const transSnap = await getDoc(doc(this.db, paths.transactions(this.companyId), currentData.transactionId));
          const transData = transSnap.data();
          const isConsulting = transData?.activityTypeName?.includes('استشارات') || 
                               transData?.activityTypeName?.includes('Consulting') ||
                               transData?.activityTypeName?.includes('تصميم') ||
                               transData?.activityTypeName?.includes('Design');

          if (isConsulting) {
            const transService = new TransactionService(this.db, this.companyId, this.permissions);
            await transService.initializeTechnicalPath(
              currentData.transactionId,
              currentData.activityTypeId || '',
              currentData.serviceId || '',
              currentData.subServiceId || '',
              userId
            );
          }
       }
    }
  }

  async getNextBOQNumber(): Promise<string> {
    const year = new Date().getFullYear();
    return nextSequential(this.db, this.companyId, 'boq', `BOQ-${year}-`, 4);
  }

  async instantiateQuotationFromTemplate(
    templateId: string,
    payload: { transactionId: string, clientId: string, clientName: string, name: string },
    userId: string,
    userName: string
  ) {
    ensureActionPermission(this.permissions, 'projects:create');
    const templateRef = doc(this.db, paths.quotationTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) throw new Error('TEMPLATE_NOT_FOUND');
    const template = templateSnap.data() as QuotationTemplate;

    const quoteRef = doc(collection(this.db, paths.quotations(this.companyId)));
    const quoteData: Quotation = {
      ...template,
      ...payload,
      id: quoteRef.id,
      status: 'draft',
      version: 1,
      totalAmount: template.baseAmount || 0,
      boqTemplateId: template.boqTemplateId || '', 
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isHistoryRecorded: false 
    } as any;

    await setDoc(quoteRef, quoteData);
    return quoteRef.id;
  }

  async updateQuotation(id: string, data: Partial<Quotation>, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const docRef = doc(this.db, paths.quotations(this.companyId), id);
    const snap = await getDoc(docRef);
    const currentData = snap.data();

    await updateDoc(docRef, {
      ...data,
      isHistoryRecorded: true,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });

    if (currentData && !currentData.isHistoryRecorded) {
      const clientService = new ClientService(this.db, this.companyId);
      await clientService.addHistory(currentData.clientId, {
        type: 'system_log',
        content: `تم اعتماد وحفظ عرض سعر جديد للمعاملة: ${currentData.name}`,
        userId, 
        userName: (data as any).updatedByName || 'User', 
        companyId: this.companyId
      });
    }
  }

  async deleteQuotation(id: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    const docRef = doc(this.db, paths.quotations(this.companyId), id);
    return deleteDoc(docRef);
  }

  async convertQuotationToContract(quotationId: string, userId: string, userName: string): Promise<string> {
    ensureActionPermission(this.permissions, 'projects:create');
    
    const quoteRef = doc(this.db, paths.quotations(this.companyId), quotationId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error('QUOTATION_NOT_FOUND');
    
    const quote = quoteSnap.data() as Quotation;
    
    const templatesQuery = query(
      collection(this.db, paths.contractTemplates(this.companyId)),
      where('subServiceId', '==', quote.subServiceId),
      limit(1)
    );
    const templatesSnap = await getDocs(templatesQuery);
    const template = !templatesSnap.empty ? templatesSnap.docs[0].data() as ContractTemplate : null;

    const contractRef = doc(collection(this.db, paths.contracts(this.companyId)));
    const contractData: Contract = {
      id: contractRef.id,
      transactionId: quote.transactionId,
      clientId: quote.clientId,
      clientName: quote.clientName,
      templateId: template?.id || 'manual_conversion',
      name: quote.name.replace('عرض سعر', 'عقد').replace('Quotation', 'Contract'),
      status: 'draft',
      totalAmount: quote.totalAmount,
      pricingMode: quote.pricingMode,
      activityTypeId: quote.activityTypeId || '',
      serviceId: quote.serviceId || '',
      subServiceId: quote.subServiceId || '',
      boqTemplateId: quote.boqTemplateId || template?.boqTemplateId || '', 
      version: 1,
      isPaid: false,
      isHistoryRecorded: true,
      legalText: template?.legalText || '',
      introText: template?.introText || quote.introText || '',
      clauses: template?.clauses || [],
      milestones: (quote.items || []).map(item => ({
        name: item.label || item.description,
        percentage: item.percentage || 0,
        amount: item.amount || (item.unitPrice || 0) * (item.quantity || 1),
        timing: 'at',
        technicalStageId: item.technicalStageId || 'SIGNING',
        contractualEvent: item.technicalStageId === 'SIGNING' ? 'SIGNING' : 'MANUAL'
      })),
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as any;

    await setDoc(contractRef, contractData);

    const clientService = new ClientService(this.db, this.companyId);
    await clientService.addHistory(quote.clientId, {
      type: 'system_log',
      content: `تم تحويل عرض السعر إلى مسودة عقد رسمي للمعاملة: ${quote.name}`,
      userId, 
      userName, 
      companyId: this.companyId
    });

    return contractRef.id;
  }

  async instantiateContractFromTemplate(
    templateId: string,
    payload: { transactionId: string, clientId: string, clientName: string, name: string },
    userId: string,
    userName: string
  ) {
    ensureActionPermission(this.permissions, 'projects:create');
    const templateRef = doc(this.db, paths.contractTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) throw new Error('TEMPLATE_NOT_FOUND');
    const template = templateSnap.data() as ContractTemplate;

    const contractRef = doc(collection(this.db, paths.contracts(this.companyId)));
    
    const contractData: Contract = {
      ...template,
      ...payload,
      id: contractRef.id,
      status: 'draft',
      version: 1,
      totalAmount: template.baseAmount || 0,
      milestones: template.defaultMilestones || [], 
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isHistoryRecorded: false
    } as any;

    await setDoc(contractRef, contractData);

    if (template.boqTemplateId) {
       try {
         await this.instantiateBoqFromTemplate(template.boqTemplateId, {
            ...payload,
            activityTypeId: template.activityTypeId,
            serviceId: template.serviceId,
            subServiceId: template.subServiceId,
            name: `دراسة مقايسة آلية - ${payload.name}`
         }, userId, userName);
       } catch (e) {
         console.warn("Auto BOQ instantiation skipped:", e);
       }
    }

    return contractRef.id;
  }

  async deleteContract(id: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    const docRef = doc(this.db, paths.contracts(this.companyId), id);
    return deleteDoc(docRef);
  }

  async instantiateSubConContractFromTemplate(
    templateId: string,
    payload: { 
      transactionId: string, 
      subcontractorId: string, 
      subcontractorName: string, 
      name: string,
      projectTitle: string
    },
    userId: string
  ) {
    ensureActionPermission(this.permissions, 'procurement:create');
    const templateRef = doc(this.db, paths.subconContractTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) throw new Error('TEMPLATE_NOT_FOUND');
    const template = templateSnap.data() as SubConContractTemplate;

    const contractRef = doc(collection(this.db, paths.subconContracts(this.companyId)));
    
    const contractData = {
      ...template,
      ...payload,
      id: contractRef.id,
      status: 'active',
      totalAmount: template.baseAmount || 0,
      milestones: template.defaultMilestones || [],
      companyId: this.companyId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(contractRef, contractData);
    return contractRef.id;
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
    await updateDoc(itemRef, { 
      plannedQuantity: Number(qty) || 0, 
      estimatedRate: Number(rate) || 0, 
      updatedAt: serverTimestamp() 
    });
  }

  async approveBOQ(boqId: string, totalAmount: number, transactionId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const boqSnap = await getDoc(boqRef);
    if (!boqSnap.exists()) return;
    const boq = boqSnap.data() as BOQ;

    await updateDoc(boqRef, {
      status: 'approved',
      totalAmount,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });

    const transService = new TransactionService(this.db, this.companyId, this.permissions);
    await transService.initializeTechnicalPath(transactionId, boq.activityTypeId!, boq.serviceId!, boq.subServiceId!, userId);

    const timelineRef = collection(this.db, paths.transactionTimeline(this.companyId, transactionId));
    await addDoc(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم اعتماد الميزانية المرجعية بقيمة ${totalAmount.toLocaleString()} KWD. تم تفعيل المسار الفني وبدء التنفيذ الميداني.`,
      userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
    });
  }

  async deleteBOQ(boqId: string, transactionId?: string, userId?: string, userName?: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const batch = writeBatch(this.db);
    
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(boqRef);
    
    if (transactionId) {
       const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
       stagesSnap.docs.forEach(d => batch.delete(d.ref));

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