'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  serverTimestamp,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { nextSequential } from '@/lib/counters';

export class ClientService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * توليد رقم الملف التلقائي التالي بصيغة C-0001/2026 عبر عداد ذري
   */
  async getNextFileNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const num = await nextSequential(this.db, this.companyId, 'client', `C-`, 4);
    return `${num}/${year}`;
  }

  async addClient(data: Partial<Client>, userId: string, userName: string) {
    const clientRef = doc(collection(this.db, paths.clients(this.companyId)));
    const clientData = {
      ...data,
      id: clientRef.id,
      companyId: this.companyId,
      transactionCounter: 0,
      isActive: true,
      status: 'new',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(clientRef, clientData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path, operation: 'create', requestResourceData: clientData
      }));
      throw err;
    });

    await this.addHistory(clientRef.id, {
      type: 'system_log',
      content: `تم فتح ملف عميل جديد برقم: ${data.fileNumber}`,
      userId, userName, companyId: this.companyId
    });

    return clientRef.id;
  }

  /**
   * تحديث بيانات العميل مع مزامنة الاسم عبر كافة المسارات (Cascading Update)
   */
  async updateClient(clientId: string, data: Partial<Client>, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const clientSnap = await getDoc(clientRef);
    const oldData = clientSnap.data() as Client;

    const batch = writeBatch(this.db);
    
    // 1. تحديث وثيقة العميل الأساسية
    batch.update(clientRef, {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    // 2. إذا تغير الاسم، نقوم بمزامنته في كافة السجلات المرتبطة (Sovereign Data Sync)
    if (data.nameAr && data.nameAr !== oldData.nameAr) {
      // مزامنة المعاملات (Technical Path)
      const transSnap = await getDocs(query(collection(this.db, paths.transactions(this.companyId)), where('clientId', '==', clientId)));
      transSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // مزامنة عروض الأسعار
      const quotesSnap = await getDocs(query(collection(this.db, paths.quotations(this.companyId)), where('clientId', '==', clientId)));
      quotesSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // مزامنة العقود
      const contractsSnap = await getDocs(query(collection(this.db, paths.contracts(this.companyId)), where('clientId', '==', clientId)));
      contractsSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // مزامنة المقايسات
      const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('clientId', '==', clientId)));
      boqsSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // مزامنة السجلات الميدانية (Field Reports)
      const visitsSnap = await getDocs(query(collection(this.db, paths.fieldVisits(this.companyId)), where('clientId', '==', clientId)));
      visitsSnap.docs.forEach(d => batch.update(d.ref, { clientName: data.nameAr, updatedAt: serverTimestamp() }));

      // توثيق التغيير في السجل التاريخي
      const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, clientId)));
      batch.set(historyRef, {
        clientId,
        type: 'status_change',
        content: `تغيير اسم العميل من [${oldData.nameAr}] إلى [${data.nameAr}] ومزامنة كافة المستندات المالية والفنية.`,
        userId,
        userName,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit().catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path, operation: 'update', requestResourceData: data
      }));
      throw err;
    });
  }

  async logInteraction(clientId: string, content: string, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return;

    await this.addHistory(clientId, {
      type: 'visit_logged', content, userId, userName, companyId: this.companyId
    });

    if (clientSnap.data().status === 'new') {
      await updateDoc(clientRef, { status: 'prospective', updatedAt: serverTimestamp() });
    }
  }

  async addHistory(clientId: string, history: Omit<ClientHistory, 'id' | 'createdAt' | 'clientId'>) {
    const historyPath = paths.clientHistory(this.companyId, clientId);
    await addDoc(collection(this.db, historyPath), { ...history, clientId, createdAt: serverTimestamp() });
  }
}
