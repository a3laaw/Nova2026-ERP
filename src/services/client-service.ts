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
  increment
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory, ClientStatus } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة ملفات العملاء (Client Relationship Management Service).
 * تدعم عزل البيانات والتدقيق التاريخي للعمليات التجارية.
 */
export class ClientService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إضافة عميل جديد مع تهيئة الملف التجاري
   */
  async addClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'transactionCounter' | 'isActive'>, userId: string, userName: string) {
    // 1. التحقق من صلاحية الإضافة (Enforcement)
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

    // تنفيذ الكتابة
    await setDoc(clientRef, clientData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path,
        operation: 'create',
        requestResourceData: clientData
      }));
      throw err;
    });

    // تسجيل الحدث في السجل التاريخي للعميل
    await this.addHistory(clientRef.id, {
      type: 'system_log',
      content: `تم فتح ملف تجاري جديد برقم: ${data.fileNumber}`,
      userId,
      userName,
      companyId: this.companyId
    });

    return clientRef.id;
  }

  /**
   * تحديث بيانات ملف العميل مع رصد التغييرات الحساسة
   */
  async updateClient(clientId: string, updates: Partial<Client>, userId: string, userName: string) {
    ensureActionPermission(this.permissions, 'crm:edit');
    
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    const updatePayload = {
      ...updates,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    await updateDoc(clientRef, updatePayload).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path,
        operation: 'update',
        requestResourceData: updatePayload
      }));
      throw err;
    });

    // إذا تغيرت الحالة التشغيلية، توثيق ذلك في السجل
    if (updates.status) {
      await this.addHistory(clientId, {
        type: 'status_change',
        content: `تغيير الحالة التشغيلية إلى: ${updates.status}`,
        userId,
        userName,
        companyId: this.companyId
      });
    }

    // إذا تم تعيين مهندس جديد
    if (updates.assignedEngineerId) {
      await this.addHistory(clientId, {
        type: 'engineer_assigned',
        content: `تم تعيين المهندس: ${updates.assignedEngineerName} كمسؤول عن الملف`,
        userId,
        userName,
        companyId: this.companyId
      });
    }
  }

  /**
   * إضافة حدث لسجل النشاط (Timeline)
   */
  async addHistory(clientId: string, history: Omit<ClientHistory, 'id' | 'createdAt' | 'clientId'>) {
    const historyPath = paths.clientHistory(this.companyId, clientId);
    const historyData = {
      ...history,
      clientId,
      createdAt: serverTimestamp()
    };

    return addDoc(collection(this.db, historyPath), historyData);
  }

  /**
   * رفع عداد المعاملات عند فتح معاملة فنية جديدة للعميل
   */
  async incrementTransactionCounter(clientId: string) {
    const clientRef = doc(this.db, paths.clients(this.companyId), clientId);
    return updateDoc(clientRef, {
      transactionCounter: increment(1),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * البحث عن عميل برقم الهاتف لمنع التكرار
   */
  async checkDuplicateMobile(mobile: string): Promise<boolean> {
    const q = query(
      collection(this.db, paths.clients(this.companyId)),
      where('mobile', '==', mobile),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }
}
