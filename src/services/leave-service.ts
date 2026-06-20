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
  orderBy
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
   * تحديث حالة الطلب مع تحليل قانوني للإجازة المرضية (المادة 69)
   */
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

    const updateData: any = {
      status,
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      comment: payload.comment || '',
      updatedAt: serverTimestamp()
    };

    if (payload.startDate) updateData.startDate = payload.startDate;
    if (payload.endDate) updateData.endDate = payload.endDate;
    if (payload.workingDays !== undefined) updateData.workingDays = payload.workingDays;

    // منطق خاص بالمادة 69 (قانون العمل الكويتي) إذا كانت الإجازة مرضية وتم اعتمادها
    if (status === 'approved' && leaveData.type === 'sick') {
      const whService = new WorkHoursService(this.db, this.companyId);
      const settings = await whService.getSettings();
      if (settings) {
        // حساب الرصيد المستخدم سابقاً في نفس السنة المالية للموظف
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
        const tiers = wdService.calculateSickLeaveBreakdown(updateData.workingDays || leaveData.workingDays, usedDaysBefore);
        updateData.sickLeaveTiers = tiers;
      }
    }

    updateDoc(leaveRef, updateData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: leaveRef.path,
        operation: 'update'
      }));
    });
  }
}
