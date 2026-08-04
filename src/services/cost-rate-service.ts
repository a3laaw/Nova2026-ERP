
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

/**
 * خدمة إدارة جداول تعرفة العمالة (Cost Rate Service).
 * تضمن وجود مرجع مالي موحد لحساب تكاليف الإنتاج.
 */
export class CostRateService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إنشاء جدول تعرفة جديد (يكون غير نشط افتراضياً)
   */
  async createCard(data: Partial<CostRateCard>, userId: string) {
    const collRef = collection(this.db, paths.costRateCards(this.companyId));
    const docData = {
      ...data,
      companyId: this.companyId,
      isActive: false,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    return addDoc(collRef, docData);
  }

  /**
   * تفعيل جدول تعرفة محدد وتعطيل كافة الجداول السابقة (عملية ذرية)
   */
  async activateCard(cardId: string) {
    const collRef = collection(this.db, paths.costRateCards(this.companyId));
    
    // 1. جلب كافة الجداول النشطة حالياً
    const activeQuery = query(collRef, where('isActive', '==', true));
    const snap = await getDocs(activeQuery);
    
    const batch = writeBatch(this.db);
    
    // 2. تعطيل الجداول القديمة
    snap.docs.forEach(d => {
      batch.update(d.ref, { 
        isActive: false, 
        updatedAt: serverTimestamp(),
        deactivatedAt: serverTimestamp() 
      });
    });
    
    // 3. تفعيل الجدول المستهدف
    const newRef = doc(this.db, paths.costRateCards(this.companyId), cardId);
    batch.update(newRef, { 
      isActive: true, 
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp() 
    });
    
    return batch.commit();
  }

  /**
   * جلب الجدول الفعال حالياً لاستخدامه في محركات الحساب
   */
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
