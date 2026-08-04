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
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { paths } from '@/firebase/multi-tenant';

export interface Invitation {
  id: string;
  email: string;
  companyId: string;
  roleId?: string;
  roleCode?: string;
  employeeId?: string;
  employeeName?: string;
  departmentId?: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt?: any;
  expiresAt?: any;
}

export class UserService {
  constructor(private db: Firestore, private companyId: string) {}

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
      
      // توحيد الأكواد لضمان الأمان السيادي
      const unifiedRoleCode = data.roleCode.toUpperCase();

      batch.set(doc(this.db, 'global_users', uid), {
        companyId: this.companyId,
        roleId: data.roleId,
        roleCode: unifiedRoleCode,
        role: unifiedRoleCode.toLowerCase(),
        fullName: data.employeeName,
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
        roleCode: unifiedRoleCode,
        role: unifiedRoleCode.toLowerCase(),
        initialPasswordSetAt: serverTimestamp(),
        joinedAt: serverTimestamp(),
        isActive: true
      });

      try {
        await batch.commit();
      } catch (batchErr) {
        try { await cred.user.delete(); } catch {}
        await deleteApp(tempApp);
        throw batchErr;
      }

      await deleteApp(tempApp);
      return uid;
    } catch (error: any) {
      if (getApps().find(app => app.name === tempAppName)) {
        await deleteApp(tempApp);
      }
      throw error;
    }
  }

  async updateUserAccount(uid: string, data: {
    displayName: string;
    username: string;
    roleId: string;
    roleCode: string;
  }) {
    const tenantUserRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalUserRef = doc(this.db, 'global_users', uid);
    
    const unifiedRoleCode = data.roleCode.toUpperCase();

    try {
      const batch = writeBatch(this.db);

      batch.update(tenantUserRef, {
        displayName: data.displayName,
        username: data.username,
        roleId: data.roleId,
        roleCode: unifiedRoleCode,
        role: unifiedRoleCode.toLowerCase(),
        updatedAt: serverTimestamp()
      });

      batch.update(globalUserRef, {
        username: data.username,
        fullName: data.displayName,
        roleId: data.roleId,
        roleCode: unifiedRoleCode,
        role: unifiedRoleCode.toLowerCase(),
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

  async sendPasswordReset(email: string): Promise<void> {
    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);
  }

  async getInvitation(inviteId: string): Promise<Invitation | null> {
    const ref = doc(this.db, paths.invitations(this.companyId), inviteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Invitation, 'id'>) };
  }

  async toggleUserStatus(uid: string, isActive: boolean) {
    const userRef = doc(this.db, 'companies', this.companyId, 'users', uid);
    const globalRef = doc(this.db, 'global_users', uid);
    const batch = writeBatch(this.db);
    batch.update(userRef, { isActive, updatedAt: serverTimestamp() });
    batch.update(globalRef, { isActive, updatedAt: serverTimestamp() });
    await batch.commit();
  }
}