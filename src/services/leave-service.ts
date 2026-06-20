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
import { WorkingDaysService } from './working-days-service';
import { WorkHoursService } from './work-hours-service';

export class LeaveService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async submitRequest(data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>) {
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

  async updateRequestStatus(
    leaveId: string, 
    status: LeaveRequest['status'], 
    adminId: string, 
    payload: { comment?: string, startDate?: string, endDate?: string, workingDays?: number } = {}
  ) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const leaveRef = doc(this.db, paths.leaveRequests(this.companyId), leaveId);
    const leaveSnap = await getDoc(leaveRef);
    
    if (!leaveSnap.exists()) return;
    const leaveData = leaveSnap.data() as LeaveRequest;

    const batch = writeBatch(this.db);

    const updateData: any = {
      status,
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      comment: payload.comment || '',
      updatedAt: serverTimestamp()
    };

    if (payload.startDate) updateData.startDate = payload.startDate;
    if (payload.endDate) updateData.endDate = payload.endDate;
    const finalWorkingDays = payload.workingDays !== undefined ? payload.workingDays : leaveData.workingDays;
    updateData.workingDays = finalWorkingDays;

    if (status === 'approved') {
      // 1. تحديث رصيد الموظف الفعلي بقوة القانون
      const empRef = doc(this.db, paths.employees(this.companyId), leaveData.userId);
      if (leaveData.type === 'annual') {
        batch.update(empRef, { annualLeaveBalance: increment(-finalWorkingDays) });
      } else if (leaveData.type === 'sick') {
        batch.update(empRef, { sickLeaveBalance: increment(-finalWorkingDays) });
        
        // 2. تحليل شرائح المادة 69 للمرضية
        const whService = new WorkHoursService(this.db, this.companyId);
        const settings = await whService.getSettings();
        if (settings) {
          const currentYear = new Date(payload.startDate || leaveData.startDate).getFullYear();
          const yearStart = `${currentYear}-01-01`;
          const yearEnd = `${currentYear}-12-31`;

          const prevSickQuery = query(
            collection(this.db, paths.leaveRequests(this.companyId)),
            where('userId', '==', leaveData.userId),
            where('type', '==', 'sick'),
            where('status', '==', 'approved')
          );
          const prevSnap = await getDocs(prevSickQuery);
          const usedDaysBefore = prevSnap.docs
            .map(d => d.data() as LeaveRequest)
            .filter(d => d.startDate >= yearStart && d.startDate <= yearEnd)
            .reduce((sum, d) => sum + (d.workingDays || 0), 0);

          const wdService = new WorkingDaysService(settings);
          updateData.sickLeaveTiers = wdService.calculateSickLeaveBreakdown(finalWorkingDays, usedDaysBefore);
        }
      }
    }

    batch.update(leaveRef, updateData);

    await batch.commit().catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: leaveRef.path,
        operation: 'update'
      }));
    });
  }
}
