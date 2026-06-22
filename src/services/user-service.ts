
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
  writeBatch
} from 'firebase/firestore';
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';

/**
 * خدمة إدارة المستخدمين المحدثة لدعم الإنشاء المباشر والتعديل الشامل.
 */
export class UserService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء حساب موظف مباشر (بدون دعوة)
   */
  async createUserAccount(data: {
    employeeId: string;
    employeeName: string;
    email: string;
    username: string;
    password: string;
    roleId: string;
    roleCode: string;
    departmentId: string;
  }) {
    const tempAppName = `temp_${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const cred = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
      const uid = cred.user.uid;

      await updateProfile(cred.user, { displayName: data.employeeName });

      const batch = writeBatch(this.db);

      batch.set(doc(this.db, 'global_users', uid), {
        companyId: this.companyId,
        roleId: data.roleId,
        role: data.roleCode,
        departmentId: data.departmentId,
        employeeId: data.employeeId,
        username: data.username,
        email: data.email,
        isDeveloper: false,
        isActive: true,
        updatedAt: serverTimestamp()
      });

      batch.set(doc(this.db, 'companies', this.companyId, 'users', uid), {
        id: uid,
        displayName: data.employeeName,
        email: data.email,
        username: data.username,
        employeeId: data.employeeId,
        roleId: data.roleId,
        role: data.roleCode,
        initialPassword: data.password,
        joinedAt: serverTimestamp(),
        isActive: true
      });

      await batch.commit();
      await deleteApp(tempApp);
      return uid;
    } catch (error: any) {
      if (getApps().find(app => app.name === tempAppName)) {
        await deleteApp(tempApp);
      }
      throw error;
    }
  }

  /**
   * تحديث بيانات حساب المستخدم بشكل شامل
   */
  async updateUserAccount(uid: string, data: {
    displayName: string;
    username: string;
    roleId: string;
    roleCode: string;
    initialPassword?: string;
  }) {
    const tenantUserRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalUserRef = doc(this.db, 'global_users', uid);

    try {
      const batch = writeBatch(this.db);

      // تحديث السجل الداخلي في الشركة
      const internalUpdates: any = {
        displayName: data.displayName,
        username: data.username,
        roleId: data.roleId,
        role: data.roleCode,
        updatedAt: serverTimestamp()
      };

      if (data.initialPassword) {
        internalUpdates.initialPassword = data.initialPassword;
      }

      batch.update(tenantUserRef, internalUpdates);

      // تحديث السجل العالمي
      batch.update(globalUserRef, {
        username: data.username,
        roleId: data.roleId,
        role: data.roleCode,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
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
   * تحديث دور المستخدم (Role Assignment) فقط
   */
  async updateUserRole(uid: string, roleId: string, roleCode: string) {
    const userSnap = await getDoc(doc(this.db, 'companies', this.companyId, 'users', uid));
    if (!userSnap.exists()) return;
    const userData = userSnap.data();

    return this.updateUserAccount(uid, {
        displayName: userData.displayName || '',
        username: userData.username || '', 
        roleId,
        roleCode
    });
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
