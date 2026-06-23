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
  where
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, ContractTemplate, BOQTemplate } from '@/types/templates';
import { Quotation, Contract, BOQ } from '@/types/documents';
import { Transaction, StageInstance } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خدمة إدارة المستندات الحية (Document Service).
 * مسؤولة عن استنساخ القوالب وتحويلها إلى سجلات تنفيذية مرتبطة بالمعاملات.
 */
export class DocumentService {
  constructor(private db: Firestore, private companyId: string) {}

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
      items: JSON.parse(JSON.stringify(template.items)), // Deep Copy
      status: 'draft',
      totalAmount: 0, // سيتم حسابه لاحقاً عند تعديل البنود
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

    // جلب مراحل المعاملة الفعلية لربط الدفعات بها
    const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, transactionId)));
    const stageInstances = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StageInstance));

    const docRef = doc(collection(this.db, paths.contracts(this.companyId)));
    
    // ربط ذكي: البحث عن ID نسخة المرحلة التي تطابق معرف المرحلة المرجعية في القالب
    const linkedMilestones = template.defaultMilestones.map(m => {
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
      clauses: JSON.parse(JSON.stringify(template.clauses)),
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
   * استنساخ جدول كميات (BOQ) من قالب
   */
  async instantiateBoqFromTemplate(templateId: string, context: { transactionId?: string, projectId?: string }, userId: string): Promise<string> {
    const templateRef = doc(this.db, paths.boqTemplates(this.companyId), templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) throw new Error('TEMPLATE_NOT_FOUND');

    const template = templateSnap.data() as BOQTemplate;
    const docRef = doc(collection(this.db, paths.boqs(this.companyId)));

    const boqData: BOQ = {
      id: docRef.id,
      transactionId: context.transactionId,
      projectId: context.projectId,
      clientId: '', // سيتم جلبه من سياق المعاملة أو المشروع
      clientName: '',
      templateId,
      name: `${template.name} - Execution Copy`,
      sections: JSON.parse(JSON.stringify(template.sections)),
      items: JSON.parse(JSON.stringify(template.items)),
      measurementMode: template.measurementMode || 'quantity',
      status: 'draft',
      totalAmount: 0,
      version: 1,
      companyId: this.companyId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, boqData);
    return docRef.id;
  }
}
