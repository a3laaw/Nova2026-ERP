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
  increment,
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

  async submitRequest(data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>, departmentId?: string) {
    const path = paths.leaveRequests(this.companyId);
    
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
      departmentId: departmentId || '', 
      createdBy: data.userId, 
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return addDoc(collection(this.db, path), docData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
      throw err;
    });
  }

  async updateRequestStatus(
    leaveId: string, 
    status: LeaveRequest['status'], 
    adminId: string, 
    payload: { 
      comment?: string, 
      startDate?: string, 
      endDate?: string, 
      workingDays?: number, 
      actualReturnDate?: string,
      actualDepartureDate?: string 
    } = {}
  ) {
    const leaveRef = doc(this.db, paths.leaveRequests(this.companyId), leaveId);
    const leaveSnap = await getDoc(leaveRef);
    
    if (!leaveSnap.exists()) return;
    const leaveData = leaveSnap.data() as LeaveRequest;
    
    const empRef = doc(this.db, paths.employees(this.companyId), leaveData.employeeId);

    const batch = writeBatch(this.db);
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };

    if (status === 'approved') {
      updateData.approvedBy = adminId;
      updateData.approvedAt = serverTimestamp();
      updateData.comment = payload.comment || '';
      
      if (payload.startDate) updateData.startDate = payload.startDate;
      if (payload.endDate) updateData.endDate = payload.endDate;
      
      const finalWorkingDays = payload.workingDays !== undefined ? payload.workingDays : leaveData.workingDays;
      updateData.workingDays = finalWorkingDays;

      if (leaveData.type === 'annual') {
        batch.update(empRef, { annualLeaveBalance: increment(-finalWorkingDays) });
      } else if (leaveData.type === 'sick') {
        batch.update(empRef, { sickLeaveBalance: increment(-finalWorkingDays) });
      }
    } 
    else if (status === 'rejected') {
      updateData.rejectedBy = adminId;
      updateData.rejectedAt = serverTimestamp();
      updateData.comment = payload.comment || '';
    }
    else if (status === 'on-leave') {
      updateData.departureConfirmedAt = serverTimestamp();
      updateData.actualDepartureDate = payload.actualDepartureDate || new Date().toISOString().split('T')[0];
      batch.update(empRef, { status: 'on-leave' });
    }
    else if (status === 'returned') {
      updateData.returnRecordedAt = serverTimestamp();
      updateData.actualReturnDate = payload.actualReturnDate || new Date().toISOString().split('T')[0];
    }
    else if (status === 'commenced') {
      updateData.commencementConfirmedAt = serverTimestamp();
      updateData.commencementConfirmedBy = adminId;
      
      // تحديث التواريخ الفعلية النهائية لو قام المدير بتعديلها عند المباشرة
      if (payload.actualDepartureDate) updateData.actualDepartureDate = payload.actualDepartureDate;
      if (payload.actualReturnDate) updateData.actualReturnDate = payload.actualReturnDate;
      
      // لو عدل المدير "أيام العمل" نتيجة التلاعب بالتواريخ، يتم تحديثها هنا
      if (payload.workingDays !== undefined) {
         const diff = payload.workingDays - (leaveData.workingDays || 0);
         if (diff !== 0) {
            updateData.workingDays = payload.workingDays;
            // تسوية الرصيد: لو زادت أيام الإجازة نخصم الزيادة، ولو نقصت نرد الفرق
            if (leaveData.type === 'annual') {
               batch.update(empRef, { annualLeaveBalance: increment(-diff) });
            }
         }
      }

      batch.update(empRef, { status: 'active' });
    }

    batch.update(leaveRef, updateData);
    await batch.commit().catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'leave_status_batch',
            operation: 'write'
        }));
        throw err;
    });
  }
}