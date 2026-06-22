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
  where,
  setDoc,
  addDoc
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';

/**
 * خدمة إدارة المستخدمين والدعوات.
 */
export class UserService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء دعوة لموظف موجود
   */
  async createInvitation(data: {
    employeeId: string;
    employeeName: string;
    email: string;
    roleId: string;
    roleCode: string;
    departmentId: string;
  }) {
    const inviteRef = doc(collection(this.db, paths.invitations(this.companyId)));
    const inviteData = {
      ...data,
      id: inviteRef.id,
      companyId: this.companyId,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // صالحة لـ 48 ساعة
    };

    await setDoc(inviteRef, inviteData);
    return inviteRef.id;
  }

  async getInvitation(inviteId: string) {
    const docRef = doc(this.db, paths.invitations(this.companyId), inviteId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  }

  /**
   * تحديث دور المستخدم (Role Assignment)
   */
  async updateUserRole(uid: string, roleId: string, roleCode: string) {
    const tenantUserRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalUserRef = doc(this.db, 'global_users', uid);

    try {
      await updateDoc(tenantUserRef, { 
        roleId: roleId,
        role: roleCode, 
        updatedAt: serverTimestamp() 
      });

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

  async toggleUserStatus(uid: string, isActive: boolean) {
    const userRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalRef = doc(this.db, 'global_users', uid);
    try {
      await updateDoc(userRef, { isActive, updatedAt: serverTimestamp() });
      await updateDoc(globalRef, { isActive, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
    }
  }
}
