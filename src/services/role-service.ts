'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  serverTimestamp,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Role } from '@/types/roles';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class RoleService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private userPermissions: string[] = []
  ) {}

  async getRoles(): Promise<Role[]> {
    const q = query(collection(this.db, paths.roles(this.companyId)), orderBy('order'));
    try {
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
    } catch (e) {
      return [];
    }
  }

  /**
   * إضافة دور جديد
   */
  async addRole(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    // التحقق من صلاحية الإدارة
    if (!this.userPermissions.includes('*')) {
       throw new Error("UNAUTHORIZED: Missing Admin Permission (*)");
    }

    const path = paths.roles(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    try {
      const docRef = await addDoc(collection(this.db, path), docData);
      return docRef.id;
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path, 
        operation: 'create', 
        requestResourceData: docData 
      }));
      throw error;
    }
  }

  /**
   * تحديث دور موجود
   */
  async updateRole(id: string, data: Partial<Role>) {
    if (!this.userPermissions.includes('*')) {
       throw new Error("UNAUTHORIZED: Missing Admin Permission (*)");
    }

    const path = paths.roles(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      const updateData = { ...data, updatedAt: serverTimestamp() };
      await updateDoc(docRef, updateData);
      return true;
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: docRef.path, 
        operation: 'update', 
        requestResourceData: data 
      }));
      throw error;
    }
  }

  async deleteRole(id: string) {
    if (!this.userPermissions.includes('*')) {
       throw new Error("UNAUTHORIZED");
    }

    const path = paths.roles(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: docRef.path, 
        operation: 'delete' 
      }));
      throw error;
    }
  }

  async seedInitialRoles() {
    const batch = writeBatch(this.db);
    const rolesRef = collection(this.db, paths.roles(this.companyId));
    
    const initialRoles = [
      { code: 'ADMIN', name: 'مدير النظام', nameEn: 'System Admin', permissions: ['*'], matrix: [], order: 1 },
      { code: 'ENGINEER', name: 'مهندس تنفيذ', nameEn: 'Project Engineer', permissions: [], matrix: [], order: 2 },
      { code: 'ACCOUNTANT', name: 'محاسب', nameEn: 'Accountant', permissions: [], matrix: [], order: 3 },
    ];

    initialRoles.forEach(r => {
      const newRef = doc(rolesRef);
      batch.set(newRef, {
        ...r,
        isSystemRole: true,
        isActive: true,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}
