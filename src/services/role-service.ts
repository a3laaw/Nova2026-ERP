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
    private permissions: string[] = []
  ) {}

  async getRoles() {
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

  addRole(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    // للأدوار، نشترط الصلاحية المطلقة فقط
    ensureActionPermission(this.permissions, '*');

    const path = paths.roles(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    addDoc(collection(this.db, path), docData).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path, 
        operation: 'create', 
        requestResourceData: docData 
      } satisfies SecurityRuleContext));
    });
  }

  updateRole(id: string, data: Partial<Role>) {
    ensureActionPermission(this.permissions, '*');

    const path = paths.roles(this.companyId);
    const docRef = doc(this.db, path, id);
    
    updateDoc(docRef, { ...data, updatedAt: serverTimestamp() }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: docRef.path, 
        operation: 'update', 
        requestResourceData: data 
      } satisfies SecurityRuleContext));
    });
  }

  deleteRole(id: string) {
    ensureActionPermission(this.permissions, '*');

    const path = paths.roles(this.companyId);
    const docRef = doc(this.db, path, id);
    
    deleteDoc(docRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: docRef.path, 
        operation: 'delete' 
      } satisfies SecurityRuleContext));
    });
  }

  async seedInitialRoles() {
    ensureActionPermission(this.permissions, '*');

    const batch = writeBatch(this.db);
    const rolesRef = collection(this.db, paths.roles(this.companyId));
    
    const initialRoles = [
      { code: 'Admin', name: 'مدير النظام', nameEn: 'System Admin', permissions: ['*'], order: 1 },
      { code: 'Engineer', name: 'مهندس تنفيذ', nameEn: 'Project Engineer', permissions: ['projects:view', 'projects:edit'], order: 2 },
      { code: 'Accountant', name: 'محاسب', nameEn: 'Accountant', permissions: ['accounting:view', 'accounting:create'], order: 3 },
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
