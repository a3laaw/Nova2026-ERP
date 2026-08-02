'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  serverTimestamp,
  addDoc,
  getDoc
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

  async updateClient(clientId: string, data: Partial<Client>, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    await updateDoc(clientRef, {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
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
