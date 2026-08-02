'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  increment,
  writeBatch,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { handleWriteError } from '@/lib/write-error';
import { paths } from '@/firebase/multi-tenant';
import { Appointment, AppointmentStatus } from '@/types/appointment';

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
    try {
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    } catch (err: any) {
      await handleWriteError(err, { path: ref.path, operation: 'update', requestResourceData: data });
    }
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
      const appSnap = await getDoc(docRef);
      if (appSnap.exists()) {
        const appData = appSnap.data() as Appointment;
        if (appData?.type === 'site_visit' && appData.clientId) {
          const clientRef = doc(this.db, paths.clients(this.companyId), appData.clientId);
          batch.update(clientRef, {
            visitCount: increment(1),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    return batch.commit();
  }

  async deleteAppointment(id: string): Promise<void> {
    if (!id || !this.companyId) return;
    const ref = doc(this.db, paths.appointments(this.companyId), id);
    try {
      await deleteDoc(ref);
    } catch (err: any) {
      await handleWriteError(err, { path: ref.path, operation: 'delete' });
    }
  }
}
