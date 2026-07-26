'use client';

import { 
  Firestore, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction } from '@/types/transaction';
import { BOQ, PurchaseOrder } from '@/types/documents';

export interface ProjectAnalyticsSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  completionRate: number;
  totalBudget: number;
  totalSpent: number;
  variance: number;
  status: string;
}

/**
 * خدمة التحليلات السيادية (Sovereign Analytics Service).
 * تقوم بتجميع البيانات من كافة الموديولات لتوليد رؤية شاملة للمدير.
 */
export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب ملخص أداء المشاريع النشطة
   */
  async getProjectsPerformance(): Promise<ProjectAnalyticsSummary[]> {
    const transSnap = await getDocs(query(collection(this.db, paths.transactions(this.companyId))));
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId))));
    const posSnap = await getDocs(query(collection(this.db, paths.purchaseOrders(this.companyId))));

    const allTrans = transSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    const allBoqs = boqsSnap.docs.map(d => d.data() as BOQ);
    const allPOs = posSnap.docs.map(d => d.data() as PurchaseOrder);

    return allTrans.map(trans => {
      const projectBoq = allBoqs.find(b => b.transactionId === trans.id);
      const projectPOs = allPOs.filter(p => p.transactionId === trans.id && p.status === 'approved');
      
      const totalBudget = projectBoq?.totalAmount || 0;
      const totalSpent = projectPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0);
      
      return {
        projectId: trans.id,
        projectName: trans.subServiceName,
        clientName: trans.clientName,
        completionRate: 0, // سيتم حسابها عبر محرك الإنجاز الفني في النسخة المتقدمة
        totalBudget,
        totalSpent,
        variance: totalBudget - totalSpent,
        status: trans.status
      };
    });
  }
}
