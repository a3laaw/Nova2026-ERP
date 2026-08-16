'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { 
  Account, 
  JournalEntry, 
  Voucher, 
  JournalEntryLine
} from '@/types/accounting';
import { nextSequential } from '@/lib/counters';
import { AnalyticalValidationService } from './analytical-validation-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export class AccountingService {
  private validationService: AnalyticalValidationService;

  constructor(private db: Firestore, private companyId: string) {
    this.validationService = new AnalyticalValidationService();
  }

  async createAccount(data: Partial<Account>, userId: string) {
    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    const accountData = {
      ...data,
      id: ref.id,
      companyId: this.companyId,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId
    };
    await setDoc(ref, accountData);
    return ref.id;
  }

  async createAutomaticCostCenter(referenceId: string, name: string, code: string, projectId?: string) {
    const ccPath = paths.costCenters(this.companyId);
    const ccRef = doc(this.db, ccPath, `cc_${referenceId}`);
    
    const docData = {
      id: ccRef.id,
      code: code,
      name: name,
      projectId: projectId || '',
      isAdministrative: !projectId,
      isActive: true,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(ccRef, docData);
    return ccRef.id;
  }

  async createAutomaticProfitCenter(projectId: string, name: string, code: string) {
    const pcPath = paths.profitCenters(this.companyId);
    const pcRef = doc(this.db, pcPath, `pc_${projectId}`);
    
    const docData = {
      id: pcRef.id,
      code: code,
      name: name,
      projectId: projectId,
      isActive: true,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(pcRef, docData);
    return pcRef.id;
  }

  async createJournalEntry(data: Partial<JournalEntry>, userId: string) {
    const totalDebit = data.lines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
    const totalCredit = data.lines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error('القيد غير متوازن: يجب أن يتساوى المدين مع الدائن.');
    }

    if (data.lines) {
      const accountsSnap = await getDocs(collection(this.db, paths.accounts(this.companyId)));
      const allAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

      // استخدام محرك التحقق والحوكمة (Validation Engine)
      const validation = this.validationService.validateJournalEntry(data.lines, allAccounts);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    const ref = doc(collection(this.db, paths.journalEntries(this.companyId)));
    const entryNumber = await nextSequential(this.db, this.companyId, 'journal_entry', 'JV-', 5);
    
    const entryData = {
      ...data,
      id: ref.id,
      entryNumber,
      status: data.status || 'posted',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId
    };

    await setDoc(ref, entryData);
    return ref.id;
  }

  async createVoucher(data: Partial<Voucher>, userId: string) {
    const batch = writeBatch(this.db);
    const voucherRef = doc(collection(this.db, paths.vouchers(this.companyId)));
    const journalRef = doc(collection(this.db, paths.journalEntries(this.companyId)));
    
    const prefix = data.type === 'receipt' ? 'RV-' : 'PV-';
    const voucherNumber = await nextSequential(this.db, this.companyId, `voucher_${data.type}`, prefix, 5);
    const entryNumber = await nextSequential(this.db, this.companyId, 'journal_entry', 'JV-', 5);

    const lines: JournalEntryLine[] = [];
    const feeAmount = data.feeAmount || 0;
    const netAmount = (data.amount || 0) - feeAmount;

    if (data.type === 'receipt') {
        lines.push({ accountId: data.cashAccountId!, accountName: 'حساب البنك/النقدية (صافي)', debit: netAmount, credit: 0, profitCenterId: data.profitCenterId });
        if (feeAmount > 0) {
            const chargesAccId = await this.ensureControlAccount('50203', 'عمولات ومصاريف بنكية', 'Bank Charges', 'expense');
            lines.push({ accountId: chargesAccId, accountName: 'عمولات بنكية', debit: feeAmount, credit: 0, profitCenterId: data.profitCenterId, costCenterId: data.costCenterId, projectId: data.projectId });
        }
        lines.push({ 
          accountId: data.accountId!, 
          accountName: 'حساب الطرف الآخر', 
          debit: 0, 
          credit: data.amount!, 
          projectId: data.projectId,
          costCenterId: data.costCenterId,
          profitCenterId: data.profitCenterId
        });
    } else {
        lines.push({ 
          accountId: data.accountId!, 
          accountName: 'حساب المصروف', 
          debit: data.amount!, 
          credit: 0, 
          projectId: data.projectId,
          costCenterId: data.costCenterId,
          profitCenterId: data.profitCenterId
        });
        lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: 0, credit: data.amount!, profitCenterId: data.profitCenterId });
    }

    batch.set(voucherRef, {
      ...data,
      id: voucherRef.id,
      voucherNumber,
      journalEntryId: journalRef.id,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      createdBy: userId
    });

    batch.set(journalRef, {
      id: journalRef.id,
      entryNumber,
      date: data.date,
      description: `${data.type === 'receipt' ? 'سند قبض' : 'سند صرف'} رقم ${voucherNumber}: ${data.notes}`,
      status: 'posted', 
      lines,
      sourceType: data.type,
      sourceId: voucherRef.id,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      createdBy: userId
    });

    await batch.commit();
    return voucherRef.id;
  }

  async ensureControlAccount(code: string, nameAr: string, nameEn: string, type: any) {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', code), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    await setDoc(ref, {
      id: ref.id, code, nameAr, nameEn, type,
      isActive: true, companyId: this.companyId, createdAt: serverTimestamp(),
      isGroup: true,
      level: code.length
    });
    return ref.id;
  }

  async createAutomaticSubAccount(parentCode: string, referenceId: string, referenceName: string, type: any) {
    const parentQ = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', parentCode), limit(1));
    const parentSnap = await getDocs(parentQ);
    const parentId = parentSnap.empty ? null : parentSnap.docs[0].id;
    const parentLevel = parentSnap.empty ? 0 : (parentSnap.docs[0].data().level || 0);

    const q = query(collection(this.db, paths.accounts(this.companyId)), where('referenceId', '==', referenceId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const subCode = await nextSequential(this.db, this.companyId, `acc_${parentCode}`, parentCode, 4);
    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    
    await setDoc(ref, {
      id: ref.id, code: subCode, nameAr: referenceName, nameEn: referenceName,
      type, isActive: true, referenceId, parentId, level: parentLevel + 1, isGroup: false, 
      companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return ref.id;
  }
}