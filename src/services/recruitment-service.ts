
'use client';

import { 
  Firestore, 
  collection, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc,
  deleteDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';

export type ApplicationStatus = 'new' | 'reviewing' | 'interview' | 'rejected' | 'hired';

export interface JobApplicationInput {
  fullName: string;
  email: string;
  mobile: string;
  position: string;
  experienceYears: number;
  education?: string;
  skills?: string;
  notes?: string;
  resumeUrl?: string;
}

export class RecruitmentService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إرسال طلب توظيف جديد (يستخدم من البوابة العامة)
   */
  async submitApplication(data: JobApplicationInput) {
    const collRef = collection(this.db, paths.applications(this.companyId));
    return addDoc(collRef, {
      ...data,
      status: 'new',
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * تحديث حالة طلب التوظيف
   */
  async updateStatus(applicationId: string, status: ApplicationStatus) {
    const docRef = doc(this.db, paths.applications(this.companyId), applicationId);
    return updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * حذف طلب
   */
  async deleteApplication(applicationId: string) {
    const docRef = doc(this.db, paths.applications(this.companyId), applicationId);
    return deleteDoc(docRef);
  }
}
