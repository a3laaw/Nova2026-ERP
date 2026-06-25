'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  writeBatch,
  increment
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQWorkItemMasterNode } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة قاموس بنود العمل الشجري (BOQ Master Tree Service).
 * تدعم الهيكل الرباعي: Section -> Main Category -> Component -> Work Item.
 */
export class BOQMasterService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إنشاء عقدة جديدة في الشجرة
   * تقوم بتحديث عداد الأبناء في العقدة الأب آلياً
   */
  async createBOQReferenceNode(data: Partial<BOQWorkItemMasterNode>, userId: string) {
    ensureActionPermission(this.permissions, 'ref:create');
    
    const collectionRef = collection(this.db, paths.boqWorkItemsMaster(this.companyId));
    const nodeRef = doc(collectionRef);
    
    const nodeData = {
      ...data,
      id: nodeRef.id,
      companyId: this.companyId,
      childrenCount: 0,
      isActive: data.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const batch = writeBatch(this.db);
    batch.set(nodeRef, nodeData);

    // تحديث الأب إذا وجد
    if (data.parentId) {
      const parentRef = doc(this.db, paths.boqWorkItemsMaster(this.companyId), data.parentId);
      batch.update(parentRef, { 
        childrenCount: increment(1),
        updatedAt: serverTimestamp()
      });
    }

    try {
      await batch.commit();
      return nodeRef.id;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: nodeRef.path,
        operation: 'create',
        requestResourceData: nodeData
      }));
      throw err;
    }
  }

  /**
   * تحديث بيانات العقدة
   */
  async updateBOQReferenceNode(id: string, data: Partial<BOQWorkItemMasterNode>, userId: string) {
    ensureActionPermission(this.permissions, 'ref:edit');
    const nodeRef = doc(this.db, paths.boqWorkItemsMaster(this.companyId), id);
    
    const updateData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    // منع تعديل الحقول الهيكلية الحساسة عبر دالة التحديث العادية لضمان استقرار الشجرة
    delete (updateData as any).parentId;
    delete (updateData as any).childrenCount;
    delete (updateData as any).level;

    return updateDoc(nodeRef, updateData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: nodeRef.path,
        operation: 'update',
        requestResourceData: updateData
      }));
      throw err;
    });
  }

  /**
   * حذف عقدة من الشجرة
   * القاعدة: يمنع الحذف إذا كانت العقدة تحتوي على أبناء
   */
  async deleteBOQReferenceNode(id: string) {
    ensureActionPermission(this.permissions, 'ref:delete');
    const nodeRef = doc(this.db, paths.boqWorkItemsMaster(this.companyId), id);
    
    const snap = await getDoc(nodeRef);
    if (!snap.exists()) return;
    const node = snap.data() as BOQWorkItemMasterNode;

    if (node.childrenCount > 0) {
      throw new Error('NODE_HAS_CHILDREN: لا يمكن حذف هذا العنصر لأنه يحتوي على فروع أو بنود تابعة. يرجى حذف الفروع أولاً.');
    }

    const batch = writeBatch(this.db);
    batch.delete(nodeRef);

    // تقليل عداد الأب إذا وجد
    if (node.parentId) {
      const parentRef = doc(this.db, paths.boqWorkItemsMaster(this.companyId), node.parentId);
      batch.update(parentRef, { 
        childrenCount: increment(-1),
        updatedAt: serverTimestamp()
      });
    }

    return batch.commit().catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: nodeRef.path,
        operation: 'delete'
      }));
      throw err;
    });
  }

  /**
   * جلب كافة العقد (للعرض الشامل أو البحث)
   */
  async listBOQReferenceNodes() {
    const q = query(
      collection(this.db, paths.boqWorkItemsMaster(this.companyId)),
      orderBy('level'),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQWorkItemMasterNode);
  }

  /**
   * جلب الأبناء المباشرين لعقدة معينة (لبناء الشجرة المتدرجة)
   */
  async listChildren(parentId: string | null) {
    const q = query(
      collection(this.db, paths.boqWorkItemsMaster(this.companyId)),
      where('parentId', '==', parentId),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQWorkItemMasterNode);
  }

  /**
   * جلب بيانات عقدة محددة
   */
  async getNodeById(id: string) {
    const snap = await getDoc(doc(this.db, paths.boqWorkItemsMaster(this.companyId), id));
    return snap.exists() ? (snap.data() as BOQWorkItemMasterNode) : null;
  }
}
