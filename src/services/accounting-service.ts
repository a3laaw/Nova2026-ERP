
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
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { 
  Account, 
  JournalEntry, 
  Voucher, 
  JournalEntryLine 
} from '@/types/accounting';
import { nextSequential } from '@/lib/counters';

export class AccountingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء حساب جديد في شجرة الحسابات
   */
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

  /**
   * جلب دليل الحسابات كشجرة
   */
  async getChartOfAccounts(): Promise<Account[]> {
    const q = query(collection(this.db, paths.accounts(this.companyId)), orderBy('code'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Account);
  }

  /**
   * توليد قيد يومية يدوي
   */
  async createJournalEntry(data: Partial<JournalEntry>, userId: string) {
    // التحقق من توازن القيد
    const totalDebit = data.lines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
    const totalCredit = data.lines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error('القيد غير متوازن: يجب أن يتساوى المدين مع الدائن.');
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

  /**
   * إنشاء سند مالي وتوليد قيده تلقائياً
   */
  async createVoucher(data: Partial<Voucher>, userId: string) {
    const batch = writeBatch(this.db);
    const voucherRef = doc(collection(this.db, paths.vouchers(this.companyId)));
    const journalRef = doc(collection(this.db, paths.journalEntries(this.companyId)));
    
    const prefix = data.type === 'receipt' ? 'RV-' : 'PV-';
    const voucherNumber = await nextSequential(this.db, this.companyId, `voucher_${data.type}`, prefix, 5);
    const entryNumber = await nextSequential(this.db, this.companyId, 'journal_entry', 'JV-', 5);

    // بناء سطور القيد التلقائي
    const lines: JournalEntryLine[] = [];
    if (data.type === 'receipt') {
      // قبض: من حساب النقدية إلى حساب العميل/الإيراد
      lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: data.amount!, credit: 0 });
      lines.push({ accountId: data.accountId!, accountName: 'حساب الطرف الآخر', debit: 0, credit: data.amount!, projectId: data.projectId });
    } else {
      // صرف: من حساب المصروف/المورد إلى حساب النقدية
      lines.push({ accountId: data.accountId!, accountName: 'حساب الطرف الآخر', debit: data.amount!, credit: 0, projectId: data.projectId });
      lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: 0, credit: data.amount! });
    }

    const voucherData = {
      ...data,
      id: voucherRef.id,
      voucherNumber,
      journalEntryId: journalRef.id,
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
}
