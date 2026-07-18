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

  async createFieldVisit(transactionId: string, data: Partial<FieldVisit>, userId: string) {
    const collRef = collection(this.db, paths.fieldVisits(this.companyId, transactionId));
    const visitRef = doc(collRef);
    
    const visitData = {
      ...data,
      id: visitRef.id,
      companyId: this.companyId,
      projectId: transactionId,
      status: 'submitted',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const batch = writeBatch(this.db);
    batch.set(visitRef, visitData);

    // إذا تم تسجيل نسبة إنجاز، نقوم بتوثيقها في التايم لاين الخاص بالمشروع
    const timelineRef = doc(collection(this.db, paths.transactionTimeline(this.companyId, transactionId)));
    batch.set(timelineRef, {
      transactionId,
      type: 'numeric_update',
      content: `تقرير زيارة ميدانية: تم تسجيل نسبة إنجاز ${data.progressPercentage}%`,
      userId,
      userName: data.engineerName || 'Engineer',
      companyId: this.companyId,
      createdAt: serverTimestamp()
    });

    return batch.commit();
  }
}
