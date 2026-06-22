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
  orderBy,
  limit,
  getDocs,
  where,
  increment,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory, ClientStatus } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class ClientService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * توليد رقم الملف التلقائي التالي بصيغة C-0001/2026
   */
  async getNextFileNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `C-`;
    const suffix = `/${year}`;
    
    try {
      // البحث عن آخر ملف تم إنشاؤه في هذه السنة
      const q = query(
        collection(this.db, paths.clients(this.companyId)),
        where('fileNumber', '>=', `${prefix}0000${suffix}`),
        where('fileNumber', '<=', `${prefix}9999${suffix}`),
        orderBy('fileNumber', 'desc'),
        limit(1)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        return `${prefix}0001${suffix}`;
      }
      
      const lastNumStr = snap.docs[0].data().fileNumber;
      // استخراج الرقم من النص (مثلاً 0001 من C-0001/2026)
      const match = lastNumStr.match(/C-(\d+)\//);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return `${prefix}${nextNum.toString().padStart(4, '0')}${suffix}`;
      }
      
      return `${prefix}0001${suffix}`;
    } catch (e) {
      console.error("Error generating file number:", e);
      return `${prefix}0001${suffix}`;
    }
  }

  async addClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'transactionCounter' | 'isActive' | 'status'>, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'crm:create');
    
    const clientPath = paths.clients(this.companyId);
    const clientRef = doc(collection(this.db, clientPath));
    
    const clientData: Client = {
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
        path: clientRef.path,
        operation: 'create',
        requestResourceData: clientData
      }));
      throw err;
    });

    await this.addHistory(clientRef.id, {
      type: 'system_log',
      content: `تم تسجيل العميل بنجاح بحالة: جديد برقم ملف: ${data.fileNumber}`,
      userId,
      userName,
      companyId: this.companyId
    });

    return clientRef.id;
  }

  async logInteraction(clientId: string, content: string, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) return;
    const clientData = clientSnap.data() as Client;

    await this.addHistory(clientId, {
      type: 'visit_logged',
      content,
      userId,
      userName,
      companyId: this.companyId
    });

    if (clientData.status === 'new') {
      await updateDoc(clientRef, {
        status: 'prospective',
        updatedAt: serverTimestamp()
      });
      
      await this.addHistory(clientId, {
        type: 'status_change',
        content: `تم تحويل حالة العميل آلياً إلى: فرصة (بناءً على تفاعل ميداني)`,
        userId: 'system',
        userName: 'Nova Intelligence',
        companyId: this.companyId
      });
    }
  }

  async markAsContracted(clientId: string, transactionId: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    
    await updateDoc(clientRef, {
      status: 'contracted',
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });

    await this.addHistory(clientId, {
      type: 'status_change',
      content: `تم تحويل العميل إلى: متعاقد (ارتباط بالمعاملة ${transactionId})`,
      userId: 'system',
      userName: 'Nova Intelligence',
      companyId: this.companyId
    });
  }

  async updateClient(clientId: string, updates: Partial<Client>, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'crm:edit');
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    await updateDoc(clientRef, { ...updates, updatedAt: serverTimestamp() });
  }

  async addHistory(clientId: string, history: Omit<ClientHistory, 'id' | 'createdAt' | 'clientId'>) {
    const historyPath = paths.clientHistory(this.companyId, clientId);
    await addDoc(collection(this.db, historyPath), { ...history, clientId, createdAt: serverTimestamp() });
  }
}