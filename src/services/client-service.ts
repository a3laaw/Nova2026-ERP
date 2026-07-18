'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  increment,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export class ClientService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * توليد رقم الملف التلقائي التالي بصيغة C-0001/2026
   */
  async getNextFileNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `C-`;
    const suffix = `/${year}`;
    
    try {
      const q = query(
        collection(this.db, paths.clients(this.companyId)),
        where('fileNumber', '>=', `${prefix}0000${suffix}`),
        where('fileNumber', '<=', `${prefix}9999${suffix}`),
        orderBy('fileNumber', 'desc'),
        limit(1)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) return `${prefix}0001${suffix}`;
      
      const lastNumStr = snap.docs[0].data().fileNumber;
      const match = lastNumStr.match(/C-(\d+)\//);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return `${prefix}${nextNum.toString().padStart(4, '0')}${suffix}`;
      }
      return `${prefix}0001${suffix}`;
    } catch (e) {
      return `${prefix}0001${suffix}`;
    }
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
