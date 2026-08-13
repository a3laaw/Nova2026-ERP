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
import { AccountingService } from './accounting-service';
import { BillingService } from './billing-service';

export class DocumentService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تحديث بيانات العقد واعتماده مالياً
   */
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
    }
  }

  /**
   * تحديث بيانات عرض السعر (إصلاح الخطأ المطلوب)
   */
  async updateQuotation(id: string, data: Partial<Quotation>, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const docRef = doc(this.db, paths.quotations(this.companyId), id);
    
    const updates: any = {
      ...data,
      isHistoryRecorded: true,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    await updateDoc(docRef, updates);
  }

  /**
   * تحويل عرض السعر إلى عقد رسمي آلياً
   */
  async convertQuotationToContract(quotationId: string, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'projects:create');
    const quoteRef = doc(this.db, paths.quotations(this.companyId), quotationId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error('QUOTATION_NOT_FOUND');
    const quote = quoteSnap.data() as Quotation;

    const contractRef = doc(collection(this.db, paths.contracts(this.companyId)));
    const contractData = {
      ...quote,
      id: contractRef.id,
      templateId: quote.templateId || 'converted',
      status: 'draft',
      isHistoryRecorded: false,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
      milestones: (quote.items || []).map(item => ({
        name: item.label || item.description,
        percentage: item.percentage || 0,
        amount: item.amount || 0,
        timing: item.timing || 'at',
        technicalStageId: item.technicalStageId || '',
        contractualEvent: 'MANUAL'
      }))
    };

    const batch = writeBatch(this.db);
    batch.set(contractRef, contractData);
    batch.update(quoteRef, { status: 'approved', updatedAt: serverTimestamp() });
    
    await batch.commit();
    return contractRef.id;
  }

  /**
   * تهيئة مقايسة جديدة من قالب مرجعي
   */
  async instantiateBoqFromTemplate(
    templateId: string, 
    payload: { transactionId: string, clientId: string, clientName: string, name: string, activityTypeId: string, serviceId: string, subServiceId: string },
    userId: string,
    userName: string
  ) {
    const templateRef = doc(this.db, paths.boqTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) throw new Error('TEMPLATE_NOT_FOUND');
    const template = templateSnap.data() as BOQTemplate;

    const boqNumber = await this.getNextBOQNumber();
    const boqRef = doc(collection(this.db, paths.boqs(this.companyId)));

    const batch = writeBatch(this.db);
    batch.set(boqRef, {
      ...payload,
      id: boqRef.id,
      boqNumber,
      templateId,
      status: 'draft',
      totalAmount: template.baseAmount || 0,
      companyId: this.companyId,
      createdBy: userId,
      createdAt: serverTimestamp()
    });

    const templateItemsSnap = await getDocs(collection(this.db, paths.boqTemplateItems(this.companyId, templateId)));
    templateItemsSnap.docs.forEach(d => {
      const itemRef = doc(collection(this.db, paths.boqItems(this.companyId, boqRef.id)));
      batch.set(itemRef, {
        ...d.data(),
        id: itemRef.id,
        boqId: boqRef.id,
        transactionId: payload.transactionId,
        clientId: payload.clientId,
        executedQuantity: 0,
        billedQuantity: 0,
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    return boqRef.id;
  }

  /**
   * اعتماد المقايسة (Baseline Approval)
   */
  async approveBOQ(boqId: string, totalAmount: number, transactionId: string, userId: string, userName: string) {
    const boqRef = doc(this.db, paths.boqs(this.companyId), boqId);
    const batch = writeBatch(this.db);
    
    batch.update(boqRef, {
      status: 'approved',
      totalAmount,
      approvedBy: userId,
      approvedAt: serverTimestamp()
    });

    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'system',
      content: `تم اعتماد الميزانية المرجعية (BOQ Baseline) بقيمة ${totalAmount.toLocaleString()} KWD.`,
      userId,
      userName,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
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
    const quoteData = {
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
    };

    await setDoc(quoteRef, quoteData);
    return quoteRef.id;
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
    
    const contractData = {
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
    };

    await setDoc(contractRef, contractData);
    return contractRef.id;
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

  async deleteQuotation(id: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    return deleteDoc(doc(this.db, paths.quotations(this.companyId), id));
  }

  async deleteContract(id: string) {
    ensureActionPermission(this.permissions, 'projects:delete');
    return deleteDoc(doc(this.db, paths.contracts(this.companyId), id));
  }
}