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
      status: 'new', // الحالة الابتدائية دائماً "جديد"
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
      content: `تم تسجيل العميل بنجاح بحالة: جديد`,
      userId,
      userName,
      companyId: this.companyId
    });

    return clientRef.id;
  }

  /**
   * إضافة ملاحظة أو توثيق زيارة (يؤدي لتحويل الحالة لـ "فرصة")
   */
  async logInteraction(clientId: string, content: string, userId: string, userName: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) return;
    const clientData = clientSnap.data() as Client;

    // توثيق الحدث
    await this.addHistory(clientId, {
      type: 'visit_logged',
      content,
      userId,
      userName,
      companyId: this.companyId
    });

    // تحديث الحالة لـ "فرصة" إذا كان جديداً
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

  /**
   * ربط المعاملة (يؤدي لتحويل الحالة لـ "متعاقد")
   */
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
