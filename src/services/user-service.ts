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
 * خدمة إدارة المستخدمين المحدثة لدعم الإنشاء المباشر.
 */
export class UserService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء حساب موظف مباشر (بدون دعوة)
   * نستخدم نسخة ثانوية من Firebase لتجنب تسجيل خروج الأدمن
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
    // 1. تهيئة تطبيق ثانوي لإنشاء الحساب في Auth
    const tempAppName = `temp_${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      // 2. إنشاء الحساب في Firebase Auth
      const cred = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
      const uid = cred.user.uid;

      // تحديث الاسم في Auth
      await updateProfile(cred.user, { displayName: data.employeeName });

      // 3. الربط الثلاثي في Firestore
      const batch = writeBatch(this.db);

      // السجل العالمي للمستخدم
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

      // سجل المستخدم داخل الشركة (تخزين الباسورد للمرجعية كما طلب المستخدم)
      batch.set(doc(this.db, 'companies', this.companyId, 'users', uid), {
        id: uid,
        displayName: data.employeeName,
        email: data.email,
        username: data.username,
        employeeId: data.employeeId,
        roleId: data.roleId,
        role: data.roleCode,
        initialPassword: data.password, // للمرجعية الإدارية
        joinedAt: serverTimestamp(),
        isActive: true
      });

      await batch.commit();
      
      // 4. إغلاق التطبيق الثانوي
      await deleteApp(tempApp);
      
      return uid;
    } catch (error: any) {
      await deleteApp(tempApp);
      throw error;
    }
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
