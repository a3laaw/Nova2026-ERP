'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { 
  Account, 
  JournalEntry, 
  Voucher, 
  JournalEntryLine,
  AccountAnalyticalConfig,
  VoucherDistribution
} from '@/types/accounting';
import { CostCenter, ProfitCenter } from '@/types/cost-profit-centers';
import { nextSequential } from '@/lib/counters';
import { AnalyticalValidationService } from './analytical-validation-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export class AccountingService {
  private validationService: AnalyticalValidationService;

  constructor(private db: Firestore, private companyId: string) {
    this.validationService = new AnalyticalValidationService();
  }

  private getDefaultAnalyticalConfig(type: Account['type'], nature?: Account['expenseNature']): AccountAnalyticalConfig {
    const config: AccountAnalyticalConfig = {
      costCenter: 'not_allowed',
      profitCenter: 'not_allowed',
      project: 'not_allowed',
      distributionAllowed: false
    };

    if (type === 'revenue') {
      config.profitCenter = 'required';
      config.costCenter = 'optional';
      config.project = 'required';
      config.distributionAllowed = true;
    } else if (type === 'expense') {
      config.costCenter = 'required';
      config.distributionAllowed = true;
      if (nature === 'direct') {
        config.profitCenter = 'required';
        config.project = 'required';
      } else {
        config.profitCenter = 'not_allowed';
        config.project = 'optional';
      }
    }

    return config;
  }

  async createAccount(data: Partial<Account>, userId: string) {
    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    const analyticalConfig = data.analyticalConfig || this.getDefaultAnalyticalConfig(data.type!, data.expenseNature);

    const accountData = {
      ...data,
      id: ref.id,
      companyId: this.companyId,
      isActive: true,
      analyticalConfig,
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

    await setDoc(ccRef, docData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: ccRef.path,
        operation: 'create',
        requestResourceData: docData
      }));
    });
    
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

    await setDoc(pcRef, docData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: pcRef.path,
        operation: 'create',
        requestResourceData: docData
      }));
    });
    
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
      const costCentersSnap = await getDocs(collection(this.db, paths.costCenters(this.companyId)));
      const profitCentersSnap = await getDocs(collection(this.db, paths.profitCenters(this.companyId)));

      const allAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
      const allCostCenters = costCentersSnap.docs.map(d => ({ id: d.id, ...d.data() } as CostCenter));
      const allProfitCenters = profitCentersSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProfitCenter));

      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i];
        const account = allAccounts.find(a => a.id === line.accountId);
        if (!account) throw new Error(`الحساب في السطر ${i + 1} غير موجود.`);

        const validation = this.validationService.validateLine(line, account, allCostCenters, allProfitCenters);
        if (!validation.valid) {
          throw new Error(`خطأ في السطر ${i + 1}: ${validation.error}`);
        }
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
        lines.push({ accountId: data.cashAccountId!, accountName: 'حساب البنك/النقدية (صافي)', debit: netAmount, credit: 0 });
        if (feeAmount > 0) {
            const chargesAccId = await this.ensureControlAccount('50203', 'عمولات ومصاريف بنكية', 'Bank Charges', 'expense');
            lines.push({ accountId: chargesAccId, accountName: 'عمولات بنكية', debit: feeAmount, credit: 0, memo: `عمولة سند ${voucherNumber}` });
        }
        if (data.distributions && data.distributions.length > 0) {
          data.distributions.forEach(d => {
            lines.push({ 
              accountId: data.accountId!, 
              accountName: 'حساب الطرف الآخر (موزع)', 
              debit: 0, 
              credit: d.amount, 
              projectId: d.projectId,
              costCenterId: d.costCenterId,
              profitCenterId: d.profitCenterId
            });
          });
        } else {
          lines.push({ 
            accountId: data.accountId!, 
            accountName: 'حساب الطرف الآخر', 
            debit: 0, 
            credit: data.amount!, 
            projectId: data.projectId,
            costCenterId: data.costCenterId,
            profitCenterId: data.profitCenterId
          });
        }
    } else {
        if (data.distributions && data.distributions.length > 0) {
          data.distributions.forEach(d => {
            lines.push({ 
              accountId: data.accountId!, 
              accountName: 'حساب المصروف (موزع)', 
              debit: d.amount, 
              credit: 0, 
              projectId: d.projectId,
              costCenterId: d.costCenterId,
              profitCenterId: d.profitCenterId
            });
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
        }
        lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: 0, credit: data.amount! });
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
      status: 'draft', 
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
    // 1. البحث عن الأب لربط الشجرة (The Anchor)
    const parentQ = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', parentCode), limit(1));
    const parentSnap = await getDocs(parentQ);
    const parentId = parentSnap.empty ? null : parentSnap.docs[0].id;
    const parentLevel = parentSnap.empty ? 0 : (parentSnap.docs[0].data().level || 0);

    // 2. التحقق من الوجود المسبق لمنع التكرار
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('referenceId', '==', referenceId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    // 3. التأسيس
    const subCode = await nextSequential(this.db, this.companyId, `acc_${parentCode}`, parentCode, 4);
    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    
    await setDoc(ref, {
      id: ref.id, 
      code: subCode, 
      nameAr: referenceName, 
      nameEn: referenceName,
      type, 
      isActive: true, 
      referenceId: referenceId, 
      parentId: parentId, // ربط سيادي بالشجرة
      level: parentLevel + 1,
      isGroup: false, 
      companyId: this.companyId,
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp()
    });
    return ref.id;
  }
}
