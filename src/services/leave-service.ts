'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { LeaveRequest } from '@/types/hr';

export class LeaveService {
  constructor(private db: Firestore, private companyId: string) {}

  private getCollectionPath() {
    return `companies/${this.companyId}/leaves`;
  }

  async submitRequest(data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'status'>) {
    const path = this.getCollectionPath();
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
    const path = this.getCollectionPath();
    const docRef = doc(this.db, path, leaveId);

    try {
      await updateDoc(docRef, {
        status,
        approvedBy: adminId,
        approvedAt: serverTimestamp(),
        comment: comment || '',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `${path}/${leaveId}`,
        operation: 'update'
      }));
      throw err;
    }
  }
}
