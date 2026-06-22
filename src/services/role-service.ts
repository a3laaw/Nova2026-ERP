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
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: paths.roles(this.companyId),
        operation: 'list'
      }));
      return [];
    }
  }

  /**
   * إضافة دور جديد - تم جعلها Async لانتظار النتيجة
   */
  async addRole(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    // للأدوار، نشترط الصلاحية المطلقة فقط (*)
    ensureActionPermission(this.userPermissions, '*');

    const path = paths.roles(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    try {
      return await addDoc(collection(this.db, path), docData);
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path, 
        operation: 'create', 
        requestResourceData: docData 
      } satisfies SecurityRuleContext));
      throw error;
    }
  }

  /**
   * تحديث دور موجود
   */
  async updateRole(id: string, data: Partial<Role>) {
    ensureActionPermission(this.userPermissions, '*');

    const path = paths.roles(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      const updateData = { ...data, updatedAt: serverTimestamp() };
      return await updateDoc(docRef, updateData);
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: docRef.path, 
        operation: 'update', 
        requestResourceData: data 
      } satisfies SecurityRuleContext));
      throw error;
    }
  }

  async deleteRole(id: string) {
    ensureActionPermission(this.userPermissions, '*');

    const path = paths.roles(this.companyId);
    const docRef = doc(this.db, path, id);
    
    try {
      return await deleteDoc(docRef);
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: docRef.path, 
        operation: 'delete' 
      } satisfies SecurityRuleContext));
      throw error;
    }
  }

  /**
   * ضخ الأدوار الافتراضية للشركات الجديدة
   */
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
