
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
  JournalEntryLine 
} from '@/types/accounting';
import { nextSequential } from '@/lib/counters';

export class AccountingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * التأكد من وجود حساب أب، وإذا لم يوجد يتم إنشاؤه (لضمان سلامة الشجرة)
   */
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
      isGroup: true,
      level: parentId ? 2 : 1,
      isActive: true,
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });
    return ref.id;
  }

  /**
   * الأتمتة السيادية: إنشاء حساب فرعي تلقائي (Sub-Ledger)
   */
  async createAutomaticSubAccount(parentCode: string, referenceId: string, referenceName: string, type: any) {
    // 1. فحص ما إذا كان الحساب موجوداً مسبقاً لهذا المرجع
    const q = query(
      collection(this.db, paths.accounts(this.companyId)), 
      where('referenceId', '==', referenceId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    // 2. الحصول على الحساب الأب
    const parentQuery = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', parentCode), limit(1));
    const parentSnap = await getDocs(parentQuery);
    const parent = parentSnap.empty ? null : parentSnap.docs[0].data();

    // 3. توليد كود فرعي متسلسل (مثلاً: 12010001)
    const subCode = await nextSequential(this.db, this.companyId, `acc_${parentCode}`, parentCode, 4);

    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    const accountData = {
      id: ref.id,
      code: subCode,
      nameAr: referenceName,
      nameEn: referenceName, // يمكن ترجمته لاحقاً عبر AI
      type,
      parentId: parentSnap.empty ? null : parentSnap.docs[0].id,
      isGroup: false,
      level: parent ? (parent.level + 1) : 1,
      isActive: true,
      referenceId: referenceId, // الربط بالكيان التشغيلي (عميل، موظف، أصل)
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(ref, accountData);
    return ref.id;
  }

  /**
   * إنشاء حساب جديد يدوي
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

  async createJournalEntry(data: Partial<JournalEntry>, userId: string) {
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

  async createVoucher(data: Partial<Voucher>, userId: string) {
    const batch = writeBatch(this.db);
    const voucherRef = doc(collection(this.db, paths.vouchers(this.companyId)));
    const journalRef = doc(collection(this.db, paths.journalEntries(this.companyId)));
    
    const prefix = data.type === 'receipt' ? 'RV-' : 'PV-';
    const voucherNumber = await nextSequential(this.db, this.companyId, `voucher_${data.type}`, prefix, 5);
    const entryNumber = await nextSequential(this.db, this.companyId, 'journal_entry', 'JV-', 5);

    const lines: JournalEntryLine[] = [];
    if (data.type === 'receipt') {
      lines.push({ accountId: data.cashAccountId!, accountName: 'حساب النقدية', debit: data.amount!, credit: 0 });
      lines.push({ accountId: data.accountId!, accountName: 'حساب الطرف الآخر', debit: 0, credit: data.amount!, projectId: data.projectId });
    } else {
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
