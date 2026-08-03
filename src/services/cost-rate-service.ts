'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  writeBatch,
  addDoc,
  updateDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { CostRateCard, LaborRateEntry } from '@/types/cost-rate';

export class CostRateService {
  constructor(private db: Firestore, private companyId: string) {}

  async createCard(data: Partial<CostRateCard>, userId: string) {
    const collRef = collection(this.db, paths.costRateCards(this.companyId));
    return addDoc(collRef, {
      ...data,
      companyId: this.companyId,
      isActive: false,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async activateCard(cardId: string) {
    const collRef = collection(this.db, paths.costRateCards(this.companyId));
    const activeQuery = query(collRef, where('isActive', '==', true));
    const snap = await getDocs(activeQuery);
    
    const batch = writeBatch(this.db);
    
    // تعطيل القديم
    snap.docs.forEach(d => {
      batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() });
    });
    
    // تفعيل الجديد
    const newRef = doc(this.db, paths.costRateCards(this.companyId), cardId);
    batch.update(newRef, { isActive: true, updatedAt: serverTimestamp() });
    
    return batch.commit();
  }

  async getActiveCard(): Promise<CostRateCard | null> {
    const q = query(
      collection(this.db, paths.costRateCards(this.companyId)), 
      where('isActive', '==', true),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as CostRateCard;
  }
}
