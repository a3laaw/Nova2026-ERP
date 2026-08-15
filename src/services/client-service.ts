'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خدمة إدارة العملاء السيادية (Sovereign Client Service).
 * تم تحديثها لضمان الترقيم المتسلسل الصارم (Gap-less) حتى مع العمل المتزامن.
 */
export class ClientService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تسجيل عميل جديد باستخدام عملية ذرية (Atomic Transaction).
   * يضمن عدم ضياع الأرقام في حال الإلغاء، وعدم تكرارها في حال العمل المتزامن.
   */
  async addClient(data: Partial<Client>, userId: string, userName: string) {
    if (!this.db || !this.companyId) throw new Error("Database context missing");

    return await runTransaction(this.db, async (transaction) => {
      const year = new Date().getFullYear();
      const counterKey = 'client';
      const counterRef = doc(this.db, 'companies', this.companyId, 'counters', counterKey);
      
      // 1. جلب القيمة الحالية للعداد داخل القفل (Lock)
      const counterSnap = await transaction.get(counterRef);
      const currentSeq = counterSnap.exists() ? (counterSnap.data().seq as number) : 0;
      const nextSeq = currentSeq + 1;
      
      // 2. توليد رقم الملف النهائي
      const fileNumber = `C-${String(nextSeq).padStart(4, '0')}/${year}`;

      // 3. التحقق الأخير من الوحدانية داخل العملية الذرية
      const clientsRef = collection(this.db, paths.clients(this.companyId));
      // ملاحظة: في Firestore، الاستعلامات داخل الترانسكشن تتطلب فهارس، 
      // سنعتمد هنا على تحديث العداد نفسه كـ "قفل" (Locking mechanism)
      
      const clientRef = doc(clientsRef);
      const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, clientRef.id)));

      const now = new Date();
      const clientData = {
        ...data,
        fileNumber, 
        id: clientRef.id,
        companyId: this.companyId,
        transactionCounter: 0,
        isActive: true,
        status: 'new',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      // 4. تنفيذ الحفظ وتحديث العداد في لحظة واحدة
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
      
      // تحديث العداد الفعلي (هنا يتم الحجز النهائي)
      transaction.set(counterRef, { seq: nextSeq, updatedAt: now }, { merge: true });

      return clientRef.id;
    });
  }

  async getProjectedNextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counterKey = 'client';
    const counterRef = doc(this.db, 'companies', this.companyId, 'counters', counterKey);
    const snap = await getDoc(counterRef);
    const current = snap.exists() ? (snap.data().seq as number) : 0;
    return `C-${String(current + 1).padStart(4, '0')}/${year}`;
  }

  async updateClient(clientId: string, data: Partial<Client>, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    try {
      await updateDoc(clientRef, {
        ...data,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path, operation: 'update', requestResourceData: data
      }));
      throw err;
    }
  }

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
}
import { updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
