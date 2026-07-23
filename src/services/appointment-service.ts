'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  increment,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export class AppointmentService {
  constructor(private db: Firestore, private companyId: string) {}

  async createAppointment(data: Partial<Appointment>, userId: string) {
    const collRef = collection(this.db, paths.appointments(this.companyId));
    const docData = {
      ...data,
      companyId: this.companyId,
      status: 'scheduled',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    return addDoc(collRef, docData);
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
    const ref = doc(this.db, paths.appointments(this.companyId), id);
    updateDoc(ref, { 
      ...data, 
      updatedAt: serverTimestamp() 
    }).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: ref.path,
        operation: 'update',
        requestResourceData: data
      }));
    });
  }

  async updateStatus(appointmentId: string, status: AppointmentStatus, userId: string) {
    const docRef = doc(this.db, paths.appointments(this.companyId), appointmentId);
    const batch = writeBatch(this.db);

    batch.update(docRef, {
      status,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });

    if (status === 'completed') {
      const snap = await getDocs(query(collection(this.db, paths.appointments(this.companyId))));
      const appData = snap.docs.find(d => d.id === appointmentId)?.data() as Appointment;
      
      if (appData?.type === 'site_visit' && appData.clientId) {
        const clientRef = doc(this.db, paths.clients(this.companyId), appData.clientId);
        batch.update(clientRef, {
          visitCount: increment(1),
          updatedAt: serverTimestamp()
        });
      }
    }

    return batch.commit();
  }

  /**
   * حذف الموعد نهائياً من قاعدة البيانات (حذف سيادي)
   */
  async deleteAppointment(id: string): Promise<void> {
    const ref = doc(this.db, paths.appointments(this.companyId), id);
    deleteDoc(ref).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: ref.path,
        operation: 'delete'
      }));
    });
  }
}
