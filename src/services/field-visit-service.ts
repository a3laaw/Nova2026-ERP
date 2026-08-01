'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';

export class FieldVisitService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء تقرير زيارة ميدانية (Sovereign Field Report)
   * تم تحديثها لتشمل بيانات العميل لضمان الظهور في السجل الشامل (Dossier)
   */
  async createFieldVisit(transactionId: string, data: Partial<FieldVisit>, userId: string) {
    const collRef = collection(this.db, paths.fieldVisits(this.companyId, transactionId));
    const visitRef = doc(collRef);
    
    const visitData = {
      ...data,
      id: visitRef.id,
      companyId: this.companyId,
      projectId: transactionId, // Transaction ID
      transactionId: transactionId,
      status: 'submitted',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const batch = writeBatch(this.db);
    batch.set(visitRef, visitData);

    // توثيق الحدث في التايم لاين الخاص بالمشروع
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      visitId: visitRef.id,
      type: 'numeric_update',
      content: `[تقرير ميداني] تم تسجيل إنجاز بنسبة ${data.progressPercentage}% في الموقع.`,
      userId,
      userName: data.engineerName || 'Engineer',
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    return batch.commit();
  }
}
