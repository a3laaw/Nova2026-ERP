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
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { 
  Account, 
  JournalEntry, 
  Voucher
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

  /**
   * محرك الترقيم التلقائي السيادي المطور (In-Memory Processing).
   * يحل مشكلة الفهارس ويمنع تكرار الأكواد.
   */
  async getNextAccountCode(parentId: string | null): Promise<string> {
    const collRef = collection(this.db, paths.accounts(this.companyId));
    const q = query(collRef, where('parentId', '==', parentId || ""));
    const snap = await getDocs(q);
    
    // إذا كان الحساب الأول تحت هذا الأب
    if (snap.empty) {
      if (!parentId) return "1"; 
      const parentSnap = await getDoc(doc(this.db, paths.accounts(this.companyId), parentId));
      if (!parentSnap.exists()) return "1001";
      const parentCode = parentSnap.data().code;
      // توليد كود هرمي (مثلاً الأب 1101 يصبح الابن 110101)
      return `${parentCode}01`;
    }

    const codes = snap.docs.map(d => d.data().code).filter(c => /^\d+$/.test(c));
    if (codes.length === 0) return "1";
    
    // الترتيب في الذاكرة لتجنب الحاجة لفهارس سحابية
    const sortedCodes = codes.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const lastCode = sortedCodes[0];
    
    try {
      const nextNum = BigInt(lastCode) + 1n;
      return nextNum.toString();
    } catch (e) {
      return (parseInt(lastCode) + 1).toString();
    }
  }

  async isCodeUnique(code: string): Promise<boolean> {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', code));
    const snap = await getDocs(q);
    return snap.empty;
  }

  async createAccount(data: Partial<Account>, userId: string) {
    if (data.code) {
      const unique = await this.isCodeUnique(data.code);
      if (!unique) throw new Error(`كود الحساب ${data.code} مستخدم بالفعل.`);
    }

    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    const accountData = {
      ...data,
      id: ref.id,
      parentId: data.parentId || "",
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
      description: `${data.type === 'receipt' ? 'سند قبض' : 'سند صرف'} رقم ${voucherNumber}`,
      status: 'posted',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      createdBy: userId,
      lines: [
        { 
          accountId: data.accountId, 
          accountName: data.type === 'receipt' ? 'إيرادات' : 'مصروفات',
          debit: data.type === 'payment' ? data.amount : 0,
          credit: data.type === 'receipt' ? data.amount : 0,
          projectId: data.projectId || '',
          costCenterId: data.costCenterId || '',
          profitCenterId: data.profitCenterId || ''
        },
        {
          accountId: data.cashAccountId,
          accountName: 'النقدية والبنك',
          debit: data.type === 'receipt' ? (data.netAmount || data.amount) : 0,
          credit: data.type === 'payment' ? data.amount : 0,
          profitCenterId: data.profitCenterId || ''
        }
      ]
    });

    await batch.commit();
    return voucherRef.id;
  }

  /**
   * ضمان وجود حساب تحكم رئيسي (Control Account) في الشجرة
   */
  async ensureControlAccount(code: string, nameAr: string, nameEn: string, type: any) {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', code));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    await setDoc(ref, {
      id: ref.id, code, nameAr, nameEn, type,
      isActive: true, companyId: this.companyId, createdAt: serverTimestamp(),
      isGroup: true, parentId: "", level: code.length
    });
    return ref.id;
  }

  /**
   * إنشاء حساب فرعي آلي (Automatic Sub-Account) لعميل أو مشروع
   */
  async createAutomaticSubAccount(parentCode: string, referenceId: string, referenceName: string, type: any) {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('referenceId', '==', referenceId));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const subCode = await nextSequential(this.db, this.companyId, `acc_${parentCode}`, parentCode, 4);
    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    
    await setDoc(ref, {
      id: ref.id, code: subCode, nameAr: referenceName, nameEn: referenceName,
      type, isActive: true, referenceId, isGroup: false, 
      parentId: "", companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return ref.id;
  }

  /**
   * إنشاء مركز تكلفة آلي ثنائي اللغة (Bilingual Cost Center)
   */
  async createAutomaticCostCenter(referenceId: string, nameAr: string, nameEn: string, code: string, projectId?: string) {
    const ccRef = doc(this.db, paths.costCenters(this.companyId), `cc_${referenceId}`);
    const docData = {
      id: ccRef.id, code, name: nameAr, nameAr, nameEn, projectId: projectId || '',
      isAdministrative: !projectId, isActive: true,
      companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    await setDoc(ccRef, docData);
    return ccRef.id;
  }

  /**
   * إنشاء مركز ربحية آلي ثنائي اللغة (Bilingual Profit Center)
   */
  async createAutomaticProfitCenter(projectId: string, nameAr: string, nameEn: string, code: string) {
    const pcRef = doc(this.db, paths.profitCenters(this.companyId), `pc_${projectId}`);
    const docData = {
      id: pcRef.id, code, name: nameAr, nameAr, nameEn, projectId,
      isActive: true, companyId: this.companyId,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    await setDoc(pcRef, docData);
    return pcRef.id;
  }
}
