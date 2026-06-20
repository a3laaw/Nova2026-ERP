
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  where
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, TransactionTimelineEvent } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export class TransactionService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء معاملة جديدة مع رقم تسلسلي ذكي
   */
  async createTransaction(
    data: Omit<Transaction, 'id' | 'transactionNumber' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>,
    userId: string,
    userName: string
  ) {
    const transactionRef = doc(collection(this.db, paths.transactions(this.companyId)));
    const tId = transactionRef.id;

    // 1. توليد رقم المعاملة (TR-YYYYMM-RAND)
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const transactionNumber = `TR-${yearMonth}-${rand}`;

    const transactionData: Transaction = {
      ...data,
      id: tId,
      transactionNumber,
      status: 'new',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    // تنفيذ الكتابة
    setDoc(transactionRef, transactionData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionRef.path,
        operation: 'create',
        requestResourceData: transactionData
      }));
    });

    // 2. إنشاء أول حدث في التايم لاين
    this.addTimelineEvent(tId, {
      type: 'system',
      content: `تم فتح المسار الفني الجديد: ${data.subServiceName}`,
      userId,
      userName,
      companyId: this.companyId
    });

    return tId;
  }

  /**
   * إضافة حدث للسجل الزمني للمعاملة
   */
  addTimelineEvent(transactionId: string, event: Omit<TransactionTimelineEvent, 'id' | 'createdAt' | 'transactionId'>) {
    const path = paths.transactionTimeline(this.companyId, transactionId);
    const eventData = {
      ...event,
      transactionId,
      createdAt: serverTimestamp()
    };
    addDoc(collection(this.db, path), eventData);
  }
}
