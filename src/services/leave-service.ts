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
  getDoc
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { LeaveRequest } from '@/types/hr';
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
    
    // فحص التداخل
    const overlapQuery = query(
      collection(this.db, path),
      where('userId', '==', data.userId)
    );
    
    const overlapSnap = await getDocs(overlapQuery);
    const hasOverlap = overlapSnap.docs.some(docSnap => {
      const d = docSnap.data();
      if (d.status === 'rejected') return false;
      return (data.startDate <= d.endDate && data.endDate >= d.startDate);
    });

    if (hasOverlap) {
      throw new Error('OVERLAP: يوجد طلب إجازة آخر متداخل مع هذه الفترة.');
    }

    const docData = {
      ...data,
      status: 'pending',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    addDoc(collection(this.db, path), docData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
    });
  }

  /**
   * تحديث حالة الطلب مع إمكانية تعديل البيانات المالية/الزمنية وإضافة ملاحظات
   */
  async updateRequestStatus(
    leaveId: string, 
    status: LeaveRequest['status'], 
    adminId: string, 
    payload: { comment?: string, startDate?: string, endDate?: string, workingDays?: number } = {}
  ) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const leaveRef = doc(this.db, paths.leaveRequests(this.companyId), leaveId);

    const updateData: any = {
      status,
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      comment: payload.comment || '',
      updatedAt: serverTimestamp()
    };

    // إذا قام المدير بتعديل التواريخ أثناء المعالجة
    if (payload.startDate) updateData.startDate = payload.startDate;
    if (payload.endDate) updateData.endDate = payload.endDate;
    if (payload.workingDays !== undefined) updateData.workingDays = payload.workingDays;

    updateDoc(leaveRef, updateData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: leaveRef.path,
        operation: 'update'
      }));
    });
  }
}
