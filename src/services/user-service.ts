
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

/**
 * خدمة إدارة المستخدمين (User Management Service).
 * مسؤولة عن مزامنة الأدوار بين السجل العالمي وسجل المنشأة.
 */
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
   * تحديث دور المستخدم (Role Assignment)
   * يتم التحديث في مكانين لضمان عمل الصلاحيات وقواعد الحماية (Security Rules)
   */
  async updateUserRole(uid: string, roleId: string, roleCode: string) {
    const tenantUserRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalUserRef = doc(this.db, 'global_users', uid);

    try {
      // 1. تحديث في سجل الشركة الداخلي
      await updateDoc(tenantUserRef, { 
        roleId: roleId,
        role: roleCode, 
        updatedAt: serverTimestamp() 
      });

      // 2. تحديث في السجل العالمي (هذا ما تراه الـ Security Rules)
      await updateDoc(globalUserRef, { 
        roleId: roleId,
        role: roleCode,
        updatedAt: serverTimestamp() 
      });
      
      return true;
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: tenantUserRef.path, 
        operation: 'update' 
      }));
      throw err;
    }
  }

  /**
   * تجميد أو تنشيط حساب موظف
   */
  async toggleUserStatus(uid: string, isActive: boolean) {
    const userRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalRef = doc(this.db, 'global_users', uid);

    try {
      await updateDoc(userRef, { isActive, updatedAt: serverTimestamp() });
      await updateDoc(globalRef, { isActive, updatedAt: serverTimestamp() });
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: userRef.path, 
        operation: 'update' 
      }));
    }
  }
}
