'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Equipment, EquipmentStatus, EquipmentAssignmentLog } from '@/types/equipment';
import { handleWriteError } from '@/lib/write-error';

export class EquipmentService {
  constructor(private db: Firestore, private companyId: string) {}

  async createEquipment(data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const docData = {
      ...data,
      companyId: this.companyId,
      status: 'available',
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    try {
      return await addDoc(collection(this.db, path), docData);
    } catch (err: any) {
      await handleWriteError(err, { path, operation: 'create', requestResourceData: docData });
    }
  }

  async updateEquipment(id: string, data: Partial<Equipment>, userId: string) {
    const path = paths.equipment(this.companyId);
    const docRef = doc(this.db, path, id);
    const updateData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };
    
    try {
      await updateDoc(docRef, updateData);
    } catch (err: any) {
      await handleWriteError(err, { path: docRef.path, operation: 'update', requestResourceData: updateData });
    }
  }

  async changeStatus(id: string, newStatus: EquipmentStatus, userId: string) {
    return this.updateEquipment(id, { status: newStatus }, userId);
  }

  async assignToProject(equipmentId: string, equipmentName: string, projectId: string, projectName: string, fromDate: string, userId: string, userName: string) {
    const batch = writeBatch(this.db);
    
    // 1. إنشاء سجل التخصيص
    const assignmentsRef = collection(this.db, paths.equipmentAssignments(this.companyId));
    const logRef = doc(assignmentsRef);
    const logData = {
      id: logRef.id,
      companyId: this.companyId,
      equipmentId,
      equipmentName,
      projectId,
      projectName,
      fromDate,
      assignedBy: userId,
      assignedByName: userName,
      createdAt: serverTimestamp()
    };
    batch.set(logRef, logData);

    // 2. تحديث حالة المعدة
    const equipRef = doc(this.db, paths.equipment(this.companyId), equipmentId);
    batch.update(equipRef, {
      status: 'in_use',
      currentProjectId: projectId,
      currentProjectName: projectName,
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  async releaseFromProject(equipmentId: string, toDate: string, userId: string) {
    const batch = writeBatch(this.db);
    
    // 1. إغلاق السجل المفتوح
    const assignmentsRef = collection(this.db, paths.equipmentAssignments(this.companyId));
    const q = query(
      assignmentsRef, 
      where('equipmentId', '==', equipmentId), 
      where('toDate', '==', null),
      limit(1)
    );
    
    const snap = await getDocs(q);
    if (!snap.empty) {
      batch.update(snap.docs[0].ref, { 
        toDate, 
        updatedAt: serverTimestamp() 
      });
    }

    // 2. تحرير المعدة
    const equipRef = doc(this.db, paths.equipment(this.companyId), equipmentId);
    batch.update(equipRef, {
      status: 'available',
      currentProjectId: null,
      currentProjectName: null,
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }
}
