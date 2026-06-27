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
  increment,
  deleteDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQReferenceNode } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة المرجع الشجري الديناميكي لبنود BOQ (Dynamic Tree Service).
 * تدعم الوراثة التشغيلية (Activity/Service/SubService) وحماية البيانات.
 */
export class BOQReferenceService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private userPermissions: string[] = []
  ) {}

  /**
   * إنشاء عقدة جديدة في الشجرة الديناميكية مع معالجة الوراثة التشغيلية
   */
  async createBOQReferenceNode(data: Partial<BOQReferenceNode>, userId: string) {
    ensureActionPermission(this.userPermissions, 'ref:create');
    
    const collectionRef = collection(this.db, paths.boqReferenceNodes(this.companyId));
    const nodeRef = doc(collectionRef);
    
    let depth = 0;
    let ancestorIds: string[] = [];
    let inheritedContext: Partial<BOQReferenceNode> = {};

    // 1. معالجة الوراثة من الأب
    if (data.parentId) {
      const parentSnap = await getDoc(doc(this.db, paths.boqReferenceNodes(this.companyId), data.parentId));
      if (parentSnap.exists()) {
        const parentData = parentSnap.data() as BOQReferenceNode;
        depth = (parentData.depth || 0) + 1;
        ancestorIds = [...(parentData.ancestorIds || []), parentSnap.id];

        // وراثة السياق التشغيلي إذا لم يتم تعريفه في الطلب الحالي وكان مسموحاً بالوراثة
        if (data.inheritServices !== false) {
          inheritedContext = {
            activityTypeId: parentData.activityTypeId,
            activityTypeName: parentData.activityTypeName,
            serviceId: parentData.serviceId,
            serviceName: parentData.serviceName,
            subServiceId: parentData.subServiceId,
            subServiceName: parentData.subServiceName
          };
        }
      }
    }

    const nodeData: BOQReferenceNode = {
      ...inheritedContext, // القيم الموروثة أولاً
      ...data,            // القيم المدخلة يدوياً تطغى على الموروثة
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

    await batch.commit().catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: nodeRef.path,
        operation: 'create',
        requestResourceData: nodeData
      } satisfies SecurityRuleContext));
      throw err;
    });

    return nodeRef.id;
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

    await updateDoc(nodeRef, updateData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: nodeRef.path,
        operation: 'update',
        requestResourceData: updateData
      } satisfies SecurityRuleContext));
      throw err;
    });
  }

  async deleteBOQReferenceNode(id: string) {
    ensureActionPermission(this.userPermissions, 'ref:delete');
    const nodeRef = doc(this.db, paths.boqReferenceNodes(this.companyId), id);
    
    const snap = await getDoc(nodeRef);
    if (!snap.exists()) return;
    const node = snap.data() as BOQReferenceNode;

    if (node.childrenCount > 0) {
      throw new Error('NODE_HAS_CHILDREN: لا يمكن حذف عنصر يحتوي على فروع تابعة.');
    }

    const batch = writeBatch(this.db);
    batch.delete(nodeRef);

    if (node.parentId) {
      const parentRef = doc(this.db, paths.boqReferenceNodes(this.companyId), node.parentId);
      batch.update(parentRef, { 
        childrenCount: increment(-1),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
  }
}
