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
  getDocs
} from 'firebase/firestore';
import { handleWriteError } from '@/lib/write-error';
import { PermissionRequest } from '@/types/hr';
import { ensureActionPermission } from '@/lib/permissions';
import { paths } from '@/firebase/multi-tenant';
import { parseISO, startOfMonth, endOfMonth, format } from 'date-fns';

export class PermissionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async submitRequest(data: Omit<PermissionRequest, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>) {
    const path = paths.permissionRequests(this.companyId);

    if (data.durationHours > 3) {
      throw new Error('LIMIT_EXCEEDED: مدة الاستئذان الواحد لا يمكن أن تتجاوز 3 ساعات.');
    }

    const currentMonthQuota = await this.getMonthlyUsedHours(data.userId, data.date);
    if (currentMonthQuota + data.durationHours > 12) {
      throw new Error(`QUOTA_EXCEEDED: لقد تجاوزت الحد الشهري المسموح به (12 ساعة). رصيدك المستخدم حالياً: ${currentMonthQuota} ساعة.`);
    }

    const hasLeave = await this.hasLeaveOnDate(data.userId, data.date);
    if (hasLeave) {
      throw new Error('LEAVE_OVERLAP: لا يمكن تقديم استئذان في يوم مسجل فيه إجازة معتمدة.');
    }

    const docData = {
      ...data,
      status: 'pending',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(this.db, path), docData);
    } catch (err: any) {
      await handleWriteError(err, { path, operation: 'create', requestResourceData: docData });
    }
  }

  async getMonthlyUsedHours(userId: string, dateStr: string): Promise<number> {
    const targetDate = parseISO(dateStr);
    const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');

    const q = query(
      collection(this.db, paths.permissionRequests(this.companyId)),
      where('userId', '==', userId)
    );

    const snap = await getDocs(q);
    
    return snap.docs
      .map(d => d.data() as PermissionRequest)
      .filter(req => 
        req.date >= start && 
        req.date <= end && 
        ['pending', 'approved'].includes(req.status)
      )
      .reduce((sum, req) => sum + (req.durationHours || 0), 0);
  }

  async hasLeaveOnDate(userId: string, dateStr: string): Promise<boolean> {
    const q = query(
      collection(this.db, paths.leaveRequests(this.companyId)),
      where('userId', '==', userId)
    );

    const snap = await getDocs(q);
    
    return snap.docs.some(docSnap => {
      const d = docSnap.data();
      const isApproved = ['approved', 'on-leave'].includes(d.status);
      const isWithinDate = dateStr >= d.startDate && dateStr <= d.endDate;
      return isApproved && isWithinDate;
    });
  }

  async updateRequestStatus(requestId: string, status: PermissionRequest['status'], adminId: string, comment?: string) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const path = paths.permissionRequests(this.companyId);
    const reqRef = doc(this.db, path, requestId);
    
    const updateData = {
      status,
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      comment: comment || '',
      updatedAt: serverTimestamp()
    };

    try {
      await updateDoc(reqRef, updateData);
    } catch (err: any) {
      await handleWriteError(err, { path: reqRef.path, operation: 'update', requestResourceData: updateData });
    }
  }
}
