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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
      throw new Error(`QUOTA_EXCEEDED: لقد تجاوزت الحد الشهري المسموح به (12 ساعة).`);
    }

    const hasLeave = await this.hasLeaveOnDate(data.userId, data.date);
    if (hasLeave) {
      throw new Error('LEAVE_OVERLAP: لا يمكن تقديم استئذان في يوم مسجل فيه إجازة.');
    }

    const docData = {
      ...data,
      status: 'pending',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // كتابة - غير محظورة
    addDoc(collection(this.db, path), docData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path,
        operation: 'create',
        requestResourceData: docData
      }));
    });
  }

  async getMonthlyUsedHours(userId: string, dateStr: string): Promise<number> {
    const date = parseISO(dateStr);
    const start = format(startOfMonth(date), 'yyyy-MM-dd');
    const end = format(endOfMonth(date), 'yyyy-MM-dd');

    const q = query(
      collection(this.db, paths.permissionRequests(this.companyId)),
      where('userId', '==', userId),
      where('date', '>=', start),
      where('date', '<=', end),
      where('status', 'in', ['pending', 'approved'])
    );

    const snap = await getDocs(q);
    return snap.docs.reduce((sum, doc) => sum + (doc.data().durationHours || 0), 0);
  }

  async hasLeaveOnDate(userId: string, dateStr: string): Promise<boolean> {
    const q = query(
      collection(this.db, paths.leaveRequests(this.companyId)),
      where('userId', '==', userId),
      where('status', 'in', ['approved', 'on-leave']),
      where('startDate', '<=', dateStr),
      where('endDate', '>=', dateStr)
    );

    const snap = await getDocs(q);
    return !snap.empty;
  }

  async updateRequestStatus(requestId: string, status: PermissionRequest['status'], adminId: string, comment?: string) {
    ensureActionPermission(this.permissions, 'hr:edit');
    const reqRef = doc(this.db, paths.permissionRequests(this.companyId), requestId);
    
    const updateData = {
      status,
      approvedBy: adminId,
      approvedAt: serverTimestamp(),
      comment: comment || '',
      updatedAt: serverTimestamp()
    };

    updateDoc(reqRef, updateData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: reqRef.path,
        operation: 'update'
      }));
    });
  }
}
