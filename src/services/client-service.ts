'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خدمة إدارة العملاء السيادية (Sovereign Client Service).
 * تم تحديثها لضمان توليد الرقم المتسلسل في لحظة الحفظ فقط لمنع "تسريب" الأرقام.
 */
export class ClientService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تسجيل عميل جديد في النظام باستخدام عملية ذرية (Transaction)
   * تضمن توليد الرقم المتسلسل وحفظ العميل في "نبضة واحدة"
   */
  async addClient(data: Partial<Client>, userId: string, userName: string) {
    if (!this.db || !this.companyId) throw new Error("Database context missing");

    return await runTransaction(this.db, async (transaction) => {
      const year = new Date().getFullYear();
      const counterKey = 'client';
      const counterRef = doc(this.db, 'companies', this.companyId, 'counters', counterKey);
      
      // 1. جلب قيمة العداد الحالية داخل الترانسكشن
      const counterSnap = await transaction.get(counterRef);
      const currentSeq = counterSnap.exists() ? (counterSnap.data().seq as number) : 0;
      const nextSeq = currentSeq + 1;
      
      // 2. توليد رقم الملف المعتمد
      const fileNumber = `C-${String(nextSeq).padStart(4, '0')}/${year}`;

      // 3. التحقق من الوحدانية (لزيادة الأمان السيادي)
      const q = query(
        collection(this.db, paths.clients(this.companyId)), 
        where('fileNumber', '==', fileNumber)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        throw new Error(`رقم الملف [${fileNumber}] مسجل مسبقاً. يرجى المحاولة مرة أخرى.`);
      }

      const clientRef = doc(collection(this.db, paths.clients(this.companyId)));
      const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, clientRef.id)));

      const now = new Date();
      const clientData = {
        ...data,
        fileNumber, // الرقم المولد فعلياً في هذه اللحظة
        id: clientRef.id,
        companyId: this.companyId,
        transactionCounter: 0,
        isActive: true,
        status: 'new',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      // 4. تنفيذ العمليات مجتمعة
      transaction.set(clientRef, clientData);
      transaction.set(historyRef, {
        clientId: clientRef.id,
        type: 'system_log',
        content: `تم فتح ملف عميل جديد برقم: ${fileNumber}`,
        userId, 
        userName, 
        companyId: this.companyId,
        createdAt: now
      });
      
      // تحديث العداد
      transaction.set(counterRef, { seq: nextSeq, updatedAt: now }, { merge: true });

      return clientRef.id;
    });
  }

  /**
   * تحديث بيانات العميل مع محرك المزامنة الشامل
   */
  async updateClient(clientId: string, data: Partial<Client>, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) throw new Error("العميل غير موجود");
    const oldData = clientSnap.data() as Client;

    const batch = writeBatch(this.db);
    
    batch.update(clientRef, {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    if (data.nameAr && data.nameAr !== oldData.nameAr) {
      // مزامنة المعاملات الفنية
      const transSnap = await getDocs(query(collection(this.db, paths.transactions(this.companyId)), where('clientId', '==', clientId)));
      transSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // مزامنة عروض الأسعار
      const quotesSnap = await getDocs(query(collection(this.db, paths.quotations(this.companyId)), where('clientId', '==', clientId)));
      quotesSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // مزامنة العقود الرسمية
      const contractsSnap = await getDocs(query(collection(this.db, paths.contracts(this.companyId)), where('clientId', '==', clientId)));
      contractsSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, clientId)));
      batch.set(historyRef, {
        clientId,
        type: 'status_change',
        content: `[مزامنة سيادية] تم تغيير الاسم من [${oldData.nameAr}] إلى [${data.nameAr}] وتحديث كافة السجلات المرتبطة.`,
        userId, userName, companyId: this.companyId, createdAt: serverTimestamp()
      });
    }

    await batch.commit().catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path, operation: 'update', requestResourceData: data
      }));
      throw err;
    });
  }

  /**
   * حذف عميل نهائياً (تطهير قاعدة البيانات)
   */
  async deleteClient(clientId: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    await deleteDoc(clientRef).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path, operation: 'delete'
      }));
      throw err;
    });
  }

  async addHistory(clientId: string, history: Omit<ClientHistory, 'id' | 'createdAt' | 'clientId'>) {
    const historyPath = paths.clientHistory(this.companyId, clientId);
    await addDoc(collection(this.db, historyPath), { ...history, clientId, createdAt: serverTimestamp() });
  }

  /**
   * هذه الدالة بقيت للتوافق ولكن لم نعد نستخدمها في النموذج لضمان عدم ضياع الأرقام
   */
  async getNextFileNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counterKey = 'client';
    const counterRef = doc(this.db, 'companies', this.companyId, 'counters', counterKey);
    const snap = await getDoc(counterRef);
    const current = snap.exists() ? (snap.data().seq as number) : 0;
    return `C-${String(current + 1).padStart(4, '0')}/${year}`;
  }
}
