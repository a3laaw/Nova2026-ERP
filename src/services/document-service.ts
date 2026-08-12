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
