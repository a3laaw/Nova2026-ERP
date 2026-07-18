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
  writeBatch
} from 'firebase/firestore';
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

  async updateStatus(appointmentId: string, status: AppointmentStatus, userId: string) {
    const docRef = doc(this.db, paths.appointments(this.companyId), appointmentId);
    const batch = writeBatch(this.db);

    batch.update(docRef, {
      status,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    });

    // إذا كانت زيارة ميدانية مكتملة، ارفع عداد الزيارات للعميل
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
}
