
'use client';

import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction } from '@/types/transaction';

/**
 * خدمة المشاريع (Project Management Service).
 * تعمل كواجهة قراءة ذكية على مجموعة المعاملات الفنية (Transactions).
 */
export class ProjectService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * جلب كافة المشاريع النشطة (المعاملات الفنية) التي تندرج تحت "المقاولات"
   */
  async getContractingProjects(): Promise<Transaction[]> {
    const q = query(
      collection(this.db, paths.transactions(this.companyId)),
      orderBy('createdAt', 'desc')
    );
    
    const snap = await getDocs(q);
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    
    // فلترة برمجية لضمان الدقة وتجنب الحاجة لفهارس معقدة
    return all.filter(t => 
      t.activityTypeName?.includes('مقاولات') || 
      t.activityTypeName?.includes('Construction')
    );
  }

  /**
   * جلب إحصائيات سريعة عن المحفظة الهندسية
   */
  async getPortfolioStats() {
    const q = query(collection(this.db, paths.transactions(this.companyId)));
    const snap = await getDocs(q);
    const all = snap.docs.map(d => d.data() as Transaction);

    return {
      totalCount: all.length,
      activeCount: all.filter(t => t.status !== 'completed').length,
      completedCount: all.filter(t => t.status === 'completed').length,
      // يمكن إضافة حساب الميزانية الإجمالية من BOQs لاحقاً
    };
  }
}
