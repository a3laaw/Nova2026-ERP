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
      config.project = 'optional';
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
      status: 'posted',
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

    // محرك العمولات البنكية (Sovereign Bank Charges Engine)
    if (data.type === 'receipt') {
        // 1. حساب النقدية/البنك (بالصافي)
        lines.push({ accountId: data.cashAccountId!, accountName: 'حساب البنك/النقدية (صافي)', debit: netAmount, credit: 0 });
        
        // 2. حساب مصاريف العمولات (إذا وجد)
        if (feeAmount > 0) {
            // البحث عن حساب "عمولات ومصاريف بنكية" - افتراض كود 50203 أو اسم مشابه
            const chargesAccQuery = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', '50203'), limit(1));
            const chargesSnap = await getDocs(chargesAccQuery);
            const chargesAccId = !chargesSnap.empty ? chargesSnap.docs[0].id : await this.ensureControlAccount('50203', 'عمولات ومصاريف بنكية', 'Bank Charges & Commissions', 'expense');
            
            lines.push({ 
              accountId: chargesAccId, 
              accountName: 'عمولات بنكية مخصومة آلياً', 
              debit: feeAmount, 
              credit: 0,
              memo: `عمولة معاملة رقم ${voucherNumber}`
            });
        }

        // 3. حساب الدائن (بالإجمالي) - عميل أو إيراد
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
        // سند صرف (لا يطبق عليه عمولة بنكية مستلمة بل عمولة مضافة، MVP يركز على سند القبض حالياً)
        if (data.distributions && data.distributions.length > 0) {
          data.distributions.forEach(d => {
            lines.push({ 
              accountId: data.accountId!, 
              accountName: 'حساب الطرف الآخر (موزع)', 
              debit: d.amount, 
              credit: 0, 
              projectId: d.projectId,
              costCenterId: d.costCenterId,
              profitCenterId: d.profitCenterId
            });
          });
          lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: 0, credit: data.amount! });
        } else {
          lines.push({ 
            accountId: data.accountId!, 
            accountName: 'حساب الطرف الآخر', 
            debit: data.amount!, 
            credit: 0, 
            projectId: data.projectId,
            costCenterId: data.costCenterId,
            profitCenterId: data.profitCenterId
          });
          lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: 0, credit: data.amount! });
        }
    }

    const voucherData = {
      ...data,
      id: voucherRef.id,
      voucherNumber,
      journalEntryId: journalRef.id,
      feeAmount,
      netAmount,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      createdBy: userId
    };

    const journalData = {
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
    };

    batch.set(voucherRef, voucherData);
    batch.set(journalRef, journalData);

    await batch.commit();
    return voucherRef.id;
  }

  async ensureControlAccount(code: string, nameAr: string, nameEn: string, type: any, parentId: string | null = null) {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', code), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    await setDoc(ref, {
      id: ref.id,
      code,
      nameAr,
      nameEn,
      type,
      parentId,
      isGroup: parentId === null,
      level: parentId ? 2 : 1,
      isActive: true,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
    return ref.id;
  }

  async createAutomaticSubAccount(parentCode: string, referenceId: string, referenceName: string, type: any) {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('referenceId', '==', referenceId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const parentQuery = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', parentCode), limit(1));
    const parentSnap = await getDocs(parentQuery);
    const parent = parentSnap.empty ? null : parentSnap.docs[0].data() as Account;

    const subCode = await nextSequential(this.db, this.companyId, `acc_${parentCode}`, parentCode, 4);

    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    const accountData = {
      id: ref.id,
      code: subCode,
      nameAr: referenceName,
      nameEn: referenceName,
      type,
      parentId: parentSnap.empty ? null : parentSnap.docs[0].id,
      isGroup: false,
      level: parent ? (parent.level + 1) : 1,
      isActive: true,
      referenceId: referenceId,
      companyId: this.companyId,
      analyticalConfig: this.getDefaultAnalyticalConfig(type),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(ref, accountData);
    return ref.id;
  }
}
