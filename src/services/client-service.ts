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
  where
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
   * إضافة عميل جديد مع تهيئة القيم الافتراضية
   */
  async addClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'transactionCounter' | 'isActive'>, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'crm:create');
    
    const clientPath = paths.clients(this.companyId);
    const clientRef = doc(collection(this.db, clientPath));
    
    const clientData: Client = {
      ...data,
      id: clientRef.id,
      companyId: this.companyId,
      transactionCounter: 0,
      isActive: true,
      status: data.status || 'prospective',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // تنفيذ غير محظور
    setDoc(clientRef, clientData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path,
        operation: 'create',
        requestResourceData: clientData
      }));
    });

    // تسجيل في التاريخ
    this.addHistory(clientRef.id, {
      type: 'system_log',
      content: `تم إنشاء ملف العميل برقم: ${data.fileNumber}`,
      userId,
      userName,
      companyId: this.companyId
    });

    return clientRef.id;
  }

  /**
   * تحديث بيانات عميل
   */
  async updateClient(clientId: string, updates: Partial<Client>, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'crm:edit');
    
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const updatePayload = {
      ...updates,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    updateDoc(clientRef, updatePayload).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path,
        operation: 'update',
        requestResourceData: updatePayload
      }));
    });

    // إذا تغيرت الحالة، سجل في التاريخ
    if (updates.status) {
      this.addHistory(clientId, {
        type: 'status_change',
        content: `تم تغيير حالة العميل إلى: ${updates.status}`,
        userId,
        userName,
        companyId: this.companyId
      });
    }
  }

  /**
   * إضافة إجراء لسجل التاريخ
   */
  addHistory(clientId: string, history: Omit<ClientHistory, 'id' | 'createdAt' | 'clientId'>) {
    const historyPath = paths.clientHistory(this.companyId, clientId);
    const historyData = {
      ...history,
      clientId,
      createdAt: serverTimestamp()
    };

    addDoc(collection(this.db, historyPath), historyData).catch(() => {
      // أخطاء سجل التاريخ يتم تجاهلها صمتاً لعدم تعطيل العملية الرئيسية
    });
  }

  /**
   * جلب عميل بواسطة رقم الهاتف (للتحقق من التكرار)
   */
  async getClientByMobile(mobile: string) {
    const q = query(
      collection(this.db, paths.clients(this.companyId)),
      where('mobile', '==', mobile),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Client;
  }
}
