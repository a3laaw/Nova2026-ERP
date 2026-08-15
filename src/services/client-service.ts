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
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { nextSequential } from '@/lib/counters';

/**
 * خدمة إدارة العملاء السيادية (Sovereign Client Service).
 * تم تحديثها لضمان وحدانية رقم الملف ومنع التكرار ودعم الحذف النهائي.
 */
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

  /**
   * تسجيل عميل جديد في النظام مع فحص الوحدانية والعملية الذرية
   */
  async addClient(data: Partial<Client>, userId: string, userName: string) {
    // 1. تحصين الوحدانية: التأكد من عدم وجود رقم الملف مسبقاً في هذه الشركة
    const q = query(
      collection(this.db, paths.clients(this.companyId)), 
      where('fileNumber', '==', data.fileNumber)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      throw new Error(`رقم الملف [${data.fileNumber}] مسجل مسبقاً لعميل آخر. يرجى تحديث الصفحة للحصول على رقم جديد.`);
    }

    const batch = writeBatch(this.db);
    const clientRef = doc(collection(this.db, paths.clients(this.companyId)));
    const historyRef = doc(collection(this.db, paths.clientHistory(this.companyId, clientRef.id)));

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

    // 2. التنفيذ الذري: حفظ العميل وسجله التاريخي معاً
    batch.set(clientRef, clientData);
    batch.set(historyRef, {
      clientId: clientRef.id,
      type: 'system_log',
      content: `تم فتح ملف عميل جديد برقم: ${data.fileNumber}`,
      userId, 
      userName, 
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
      return clientRef.id;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: clientRef.path, operation: 'create', requestResourceData: clientData
      }));
      throw err;
    }
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
    // ملاحظة: في الأنظمة الضخمة نفضل الأرشفة، ولكن بناءً على طلبك قمنا بالتنفيذ للحذف النهائي.
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
