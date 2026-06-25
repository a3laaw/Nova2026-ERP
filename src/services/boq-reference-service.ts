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
import { BOQReferenceNode } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المرجع الشجري الديناميكي لبنود BOQ (Dynamic Tree Service).
 * تدعم عدد غير محدود من المستويات مع حساب آلي للعمق والتبعية.
 */
export class BOQReferenceService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private userPermissions: string[] = []
  ) {}

  /**
   * إنشاء عقدة جديدة في الشجرة الديناميكية
   */
  async createBOQReferenceNode(data: Partial<BOQReferenceNode>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:create');
    
    const collectionRef = collection(this.db, paths.boqReferenceNodes(this.companyId));
    const nodeRef = doc(collectionRef);
    
    let depth = 0;
    let ancestorIds: string[] = [];

    // 1. حساب العمق والأسلاف إذا كان للعقدة أب
    if (data.parentId) {
      const parentSnap = await getDoc(doc(this.db, paths.boqReferenceNodes(this.companyId), data.parentId));
      if (parentSnap.exists()) {
        const parentData = parentSnap.data() as BOQReferenceNode;
        depth = (parentData.depth || 0) + 1;
        ancestorIds = [...(parentData.ancestorIds || []), parentSnap.id];
      }
    }

    const nodeData: BOQReferenceNode = {
      ...data,
      id: nodeRef.id,
      companyId: this.companyId,
      depth,
      ancestorIds,
      childrenCount: 0,
      isActive: data.isActive ?? true,
      isExecutable: data.isExecutable ?? false,
      nodeRole: data.nodeRole || (data.isExecutable ? 'work_item' : 'group'),
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as BOQReferenceNode;

    const batch = writeBatch(this.db);
    batch.set(nodeRef, nodeData);

    // 2. تحديث عداد الأبناء في الأب
    if (data.parentId) {
      const parentRef = doc(this.db, paths.boqReferenceNodes(this.companyId), data.parentId);
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
  async updateBOQReferenceNode(id: string, data: Partial<BOQReferenceNode>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:edit');
    const nodeRef = doc(this.db, paths.boqReferenceNodes(this.companyId), id);
    
    const updateData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    // منع تعديل الحقول الهيكلية الحساسة عبر التحديث العادي لضمان سلامة الشجرة
    delete (updateData as any).parentId;
    delete (updateData as any).ancestorIds;
    delete (updateData as any).depth;

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
   */
  async deleteBOQReferenceNode(id: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const nodeRef = doc(this.db, paths.boqReferenceNodes(this.companyId), id);
    
    const snap = await getDoc(nodeRef);
    if (!snap.exists()) return;
    const node = snap.data() as BOQReferenceNode;

    if (node.childrenCount > 0) {
      throw new Error('NODE_HAS_CHILDREN: لا يمكن حذف عنصر يحتوي على فروع تابعة. يرجى حذف الفروع أولاً.');
    }

    const batch = writeBatch(this.db);
    batch.delete(nodeRef);

    // تقليل عداد الأبناء في الأب
    if (node.parentId) {
      const parentRef = doc(this.db, paths.boqReferenceNodes(this.companyId), node.parentId);
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
   * جلب كافة العقد المرجعية مرتبة حسب المسار الهرمي
   */
  async listBOQReferenceNodes() {
    const q = query(
      collection(this.db, paths.boqReferenceNodes(this.companyId)),
      orderBy('depth'),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQReferenceNode);
  }

  /**
   * جلب الأبناء المباشرين لعقدة معينة
   */
  async listChildren(parentId: string | null) {
    const q = query(
      collection(this.db, paths.boqReferenceNodes(this.companyId)),
      where('parentId', '==', parentId),
      orderBy('order')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQReferenceNode);
  }

  /**
   * جلب كافة العقد التنفيذية (Leaf Nodes) التي يمكن استخدامها في المقايسات
   */
  async listExecutableItems() {
    const q = query(
      collection(this.db, paths.boqReferenceNodes(this.companyId)),
      where('isExecutable', '==', true),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQReferenceNode);
  }

  async getNodeById(id: string) {
    const snap = await getDoc(doc(this.db, paths.boqReferenceNodes(this.companyId), id));
    return snap.exists() ? (snap.data() as BOQReferenceNode) : null;
  }
}
