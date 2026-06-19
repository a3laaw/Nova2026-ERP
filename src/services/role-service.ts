'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
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
import { FirestorePermissionError } from '@/firebase/errors';

export class RoleService {
  constructor(private db: Firestore, private companyId: string) {}

  async getRoles() {
    const q = query(collection(this.db, paths.roles(this.companyId)), orderBy('order'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
  }

  async addRole(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    const path = paths.roles(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
      return await addDoc(collection(this.db, path), docData);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create', requestResourceData: docData }));
    }
  }

  async updateRole(id: string, data: Partial<Role>) {
    const path = paths.roles(this.companyId);
    try {
      await updateDoc(doc(this.db, path, id), { ...data, updatedAt: serverTimestamp() });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'update', requestResourceData: data }));
    }
  }

  async deleteRole(id: string) {
    const path = paths.roles(this.companyId);
    try {
      await deleteDoc(doc(this.db, path, id));
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `${path}/${id}`, operation: 'delete' }));
    }
  }

  /**
   * ربط مستخدم بدور محدد
   */
  async assignRoleToUser(userId: string, role: { id: string, code: string }) {
    const userRef = doc(this.db, 'companies', this.companyId, 'users', userId);
    try {
      await updateDoc(userRef, {
        roleId: role.id,
        roleCode: role.code,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update' }));
    }
  }

  /**
   * ضخ الأدوار الأساسية للنظام
   */
  async seedInitialRoles() {
    const batch = writeBatch(this.db);
    const rolesRef = collection(this.db, paths.roles(this.companyId));
    
    const initialRoles = [
      { code: 'Admin', name: 'مدير النظام', nameEn: 'System Admin', permissions: ['*'], order: 1 },
      { code: 'Engineer', name: 'مهندس تنفيذ', nameEn: 'Project Engineer', permissions: ['view_stage_instances', 'complete_stage', 'create_field_visit'], order: 2 },
      { code: 'Accountant', name: 'محاسب', nameEn: 'Accountant', permissions: ['view_chart_of_accounts', 'create_journal_entry', 'post_journal_entry'], order: 3 },
      { code: 'HR', name: 'مسؤول الموارد البشرية', nameEn: 'HR Manager', permissions: ['view_employees', 'create_employee', 'approve_leave', 'generate_payroll'], order: 4 },
      { code: 'ProcurementOfficer', name: 'مسؤول مشتريات', nameEn: 'Procurement Officer', permissions: ['create_purchase_request', 'create_rfq', 'create_purchase_order'], order: 5 },
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
