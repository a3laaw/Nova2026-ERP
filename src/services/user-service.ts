
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export class UserService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب كافة الموظفين التابعين للشركة
   */
  async getCompanyUsers() {
    const usersRef = collection(this.db, 'companies', this.companyId, 'users');
    try {
      const snap = await getDocs(usersRef);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: usersRef.path, 
        operation: 'list' 
      }));
      return [];
    }
  }

  /**
   * تحديث صلاحيات موظف داخل الشركة
   */
  async updateUserRole(uid: string, newRole: 'admin' | 'user') {
    const tenantUserRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalUserRef = doc(this.db, 'global_users', uid);

    try {
      // تحديث في مسارين لضمان التزامن
      await updateDoc(tenantUserRef, { role: newRole, updatedAt: serverTimestamp() });
      await updateDoc(globalUserRef, { role: newRole, updatedAt: serverTimestamp() });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: tenantUserRef.path, 
        operation: 'update' 
      }));
    }
  }

  /**
   * تجميد حساب موظف
   */
  async toggleUserStatus(uid: string, isActive: boolean) {
    const userRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    try {
      await updateDoc(userRef, { isActive, updatedAt: serverTimestamp() });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: userRef.path, 
        operation: 'update' 
      }));
    }
  }
}
