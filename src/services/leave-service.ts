'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { LeaveRequest, Employee } from '@/types/hr';
import { ensureActionPermission } from '@/lib/permissions';
import { paths } from '@/firebase/multi-tenant';

export class LeaveService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async submitRequest(data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>) {
    const path = paths.leaveRequests(this.companyId);
    
    // 1. التحقق من التداخل
    const overlapQuery = query(
      collection(this.db, path),
      where('userId', '==', data.userId),
      where('status', 'in', ['pending', 'approved', 'on-leave']),
      where('startDate', '<=', data.endDate)
    );
    
    const overlapSnap = await getDocs(overlapQuery);
    const hasOverlap = overlapSnap.docs.some(doc => {
      const d = doc.data();
      return data.startDate <= d.endDate;
    });

    if (hasOverlap) {
      throw new Error('OVERLAP: يوجد إجازة أخرى مسجلة في نفس الفترة.');
    }

    const docData = {
      ...data,
      status: 'pending',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      return await addDoc(collection(this.db, path), docData);
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
      throw err;
    }
  }

  async updateRequestStatus(leaveId: string, status: 'approved' | 'rejected', adminId: string, comment?: string) {
    ensureActionPermission(this.permissions, 'hr:edit');

    const leaveRef = doc(this.db, paths.leaveRequests(this.companyId), leaveId);
    const leaveSnap = await getDoc(leaveRef);
    if (!leaveSnap.exists()) throw new Error('Request not found');
    
    const leaveData = leaveSnap.data() as LeaveRequest;
    const batch = writeBatch(this.db);

    // إذا تمت الموافقة، نقوم بتحديث رصيد الموظف (افتراضياً)
    // ملاحظة: في النسخة الكاملة يتم الربط مع الـ Employee document
    batch.update(leaveRef, {
      status,
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      comment: comment || '',
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: leaveRef.path,
        operation: 'update'
      }));
      throw err;
    }
  }
}
