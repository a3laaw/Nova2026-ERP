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
import { handleWriteError } from '@/lib/write-error';
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
      where('employeeId', '==', data.employeeId)
    );
    
    const overlapSnap = await getDocs(overlapQuery);
    const hasOverlap = overlapSnap.docs.some(docSnap => {
      const d = docSnap.data();
      if (d.status === 'rejected') return false;
      return (data.startDate <= d.endDate && data.endDate >= d.startDate);
    });

    if (hasOverlap) {
      throw new Error('OVERLAP: يوجد طلب إجازة آخر متداخل مع هذه الفترة لهذا الموظف.');
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

    try {
      await addDoc(collection(this.db, path), docData);
    } catch (err: any) {
      await handleWriteError(err, { path, operation: 'create', requestResourceData: docData });
    }
  }

  /**
   * محرك فحص كثافة الإجازات في القسم (Department Density Radar)
   * يفحص من هم في إجازة من نفس القسم خلال فترة محددة
   */
  async getDepartmentLeaveDensity(departmentId: string, startDate: string, endDate: string, currentRequestId?: string) {
    if (!departmentId) return { count: 0, peers: [] };

    const q = query(
      collection(this.db, paths.leaveRequests(this.companyId)),
      where('departmentId', '==', departmentId),
      where('status', 'in', ['pending', 'approved', 'on-leave', 'commenced'])
    );

    const snap = await getDocs(q);
    const peersOnLeave = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(d => {
        if (currentRequestId && d.id === currentRequestId) return false;
        // التحقق من تداخل الفترات: (StartA <= EndB) and (EndA >= StartB)
        return (startDate <= d.endDate && endDate >= d.startDate);
      });

    return {
      count: peersOnLeave.length,
      peers: peersOnLeave.map(d => ({ 
        id: d.id, 
        name: d.userName || d.employeeName,
        status: d.status,
        period: `${d.startDate} → ${d.endDate}`
      }))
    };
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
    const path = paths.leaveRequests(this.companyId);
    const leaveRef = doc(this.db, path, leaveId);
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
      
      if (payload.actualDepartureDate) updateData.actualDepartureDate = payload.actualDepartureDate;
      if (payload.actualReturnDate) updateData.actualReturnDate = payload.actualReturnDate;
      
      if (payload.workingDays !== undefined) {
         const diff = payload.workingDays; 
         updateData.workingDays = payload.workingDays;
         if (leaveData.type === 'annual') {
            batch.update(empRef, { annualLeaveBalance: increment(-diff) });
         } else if (leaveData.type === 'sick') {
            batch.update(empRef, { sickLeaveBalance: increment(-diff) });
         }
      }

      batch.update(empRef, { status: 'active' });
    }

    batch.update(leaveRef, updateData);
    try {
      await batch.commit();
    } catch (err: any) {
      await handleWriteError(err, { path: 'leave_status_batch', operation: 'update', requestResourceData: updateData });
    }
  }
}