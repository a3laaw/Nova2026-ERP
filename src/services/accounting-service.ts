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
  limit,
  orderBy
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

  /**
   * محرك الترقيم التلقائي (Sovereign Auto-Coding Engine)
   * يقوم بتوليد الكود المحاسبي التالي بناءً على الأب المختار لضمان عدم التكرار.
   */
  async getNextAccountCode(parentId: string | null): Promise<string> {
    const collRef = collection(this.db, paths.accounts(this.companyId));
    let q;
    
    if (!parentId) {
      // البحث عن أكبر كود في الحسابات الجذرية (1, 2, 3...)
      q = query(collRef, where('parentId', '==', ""), orderBy('code', 'desc'), limit(1));
    } else {
      // البحث عن أكبر كود بين الأبناء لهذا الأب
      q = query(collRef, where('parentId', '==', parentId), orderBy('code', 'desc'), limit(1));
    }

    const snap = await getDocs(q);
    
    if (snap.empty) {
      if (!parentId) return "1"; // أول حساب جذري
      
      // إذا لم يكن للأب أبناء، نأخذ كود الأب ونبدأ منه التفرع
      const parentSnap = await getDoc(doc(this.db, paths.accounts(this.companyId), parentId));
      if (!parentSnap.exists()) return "1001";
      const parentCode = parentSnap.data().code;
      // نمط الترقيم: الأب 11 -> الابن 1101
      return `${parentCode}01`;
    }

    const lastCode = snap.docs[0].data().code;
    const lastNum = parseInt(lastCode);
    return (lastNum + 1).toString();
  }

  /**
   * فحص وحدانية الكود قبل الحفظ
   */
  async isCodeUnique(code: string): Promise<boolean> {
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('code', '==', code), limit(1));
    const snap = await getDocs(q);
    return snap.empty;
  }

  async createAccount(data: Partial<Account>, userId: string) {
    // التأكد من وحدانية الكود
    if (data.code) {
      const unique = await this.isCodeUnique(data.code);
      if (!unique) throw new Error(`كود الحساب ${data.code} مستخدم بالفعل.`);
    }

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
    const pcRef = doc(this.db, paths.profitCenters(this.companyId), `pc_${projectId}`);
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
    const q = query(collection(this.db, paths.accounts(this.companyId)), where('referenceId', '==', referenceId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const subCode = await nextSequential(this.db, this.companyId, `acc_${parentCode}`, parentCode, 4);
    const ref = doc(collection(this.db, paths.accounts(this.companyId)));
    
    await setDoc(ref, {
      id: ref.id, code: subCode, nameAr: referenceName, nameEn: referenceName,
      type, isActive: true, referenceId, isGroup: false, 
      companyId: this.companyId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return ref.id;
  }
}

import { getDoc } from 'firebase/firestore';