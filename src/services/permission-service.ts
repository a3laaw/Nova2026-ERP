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
import { PermissionRequest, LeaveRequest } from '@/types/hr';
import { ensureActionPermission } from '@/lib/permissions';
import { paths } from '@/firebase/multi-tenant';
import { parseISO, startOfMonth, endOfMonth, format } from 'date-fns';

export class PermissionService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * تقديم طلب استئذان مع فحص القيود
   */
  async submitRequest(data: Omit<PermissionRequest, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>) {
    const path = paths.permissionRequests(this.companyId);

    // 1. القيد الزمني للطلب الواحد (3 ساعات)
    if (data.durationHours > 3) {
      throw new Error('LIMIT_EXCEEDED: مدة الاستئذان الواحد لا يمكن أن تتجاوز 3 ساعات.');
    }

    // 2. فحص الرصيد الشهري (12 ساعة)
    const currentMonthQuota = await this.getMonthlyUsedHours(data.userId, data.date);
    if (currentMonthQuota + data.durationHours > 12) {
      throw new Error(`QUOTA_EXCEEDED: لقد تجاوزت الحد الشهري المسموح به (12 ساعة). المتبقي لك: ${12 - currentMonthQuota} ساعة.`);
    }

    // 3. فحص التداخل مع الإجازات (Leave Overlap)
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

  /**
   * حساب الساعات المستهلكة في شهر معين
   */
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

  /**
   * التحقق من وجود إجازة في نفس اليوم
   */
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
    
    try {
      await updateDoc(reqRef, {
        status,
        approvedBy: adminId,
        approvedAt: serverTimestamp(),
        comment: comment || '',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: reqRef.path,
        operation: 'update'
      }));
      throw err;
    }
  }
}
