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
import { Employee } from '@/types/hr';

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

export interface ExecutiveSummary {
  crm: {
    totalClients: number;
    activeTransactions: number;
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    constructionCount: number;
    consultingCount: number;
  };
  finance: {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
  };
  hr: {
    totalStaff: number;
    activeField: number;
    onLeave: number;
  };
}

/**
 * خدمة التحليلات السيادية (Sovereign Analytics Service).
 */
export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  async getProjectsPerformance(): Promise<ProjectAnalyticsSummary[]> {
    const transSnap = await getDocs(query(collection(this.db, paths.transactions(this.companyId))));
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId))));
    const posSnap = await getDocs(query(collection(this.db, paths.purchaseOrders(this.companyId))));

    const allTrans = transSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    const allBoqs = boqsSnap.docs.map(d => d.data() as BOQ);
    const allPOs = posSnap.docs.map(d => d.data() as PurchaseOrder);

    const summaries = await Promise.all(allTrans.map(async (trans) => {
      const projectBoq = allBoqs.find(b => b.transactionId === trans.id);
      const projectPOs = allPOs.filter(p => p.transactionId === trans.id && p.status === 'approved');
      
      const totalBudget = projectBoq?.totalAmount || 0;
      const totalSpent = projectPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0);
      
      let completionRate = 0;
      try {
        const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, trans.id)));
        const total = stagesSnap.size;
        const done = stagesSnap.docs.filter(d => d.data().status === 'completed').length;
        completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      } catch { completionRate = 0; }

      return {
        projectId: trans.id,
        projectName: trans.subServiceName,
        clientName: trans.clientName,
        completionRate,
        totalBudget,
        totalSpent,
        variance: totalBudget - totalSpent,
        status: trans.status
      };
    }));

    return summaries;
  }

  async getGlobalExecutiveSummary(): Promise<ExecutiveSummary> {
    const [clients, trans, employees, boqs, pos] = await Promise.all([
      getDocs(collection(this.db, paths.clients(this.companyId))),
      getDocs(collection(this.db, paths.transactions(this.companyId))),
      getDocs(collection(this.db, paths.employees(this.companyId))),
      getDocs(collection(this.db, paths.boqs(this.companyId))),
      getDocs(collection(this.db, paths.purchaseOrders(this.companyId)))
    ]);

    const transactions = trans.docs.map(d => d.data() as Transaction);
    const boqData = boqs.docs.map(d => d.data() as BOQ);
    const poData = pos.docs.map(d => d.data() as PurchaseOrder).filter(p => p.status === 'approved');

    const totalBudget = boqData.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
    const totalSpent = poData.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

    return {
      crm: {
        totalClients: clients.size,
        activeTransactions: transactions.filter(t => t.status !== 'completed').length
      },
      projects: {
        total: transactions.length,
        active: transactions.filter(t => t.status !== 'completed').length,
        completed: transactions.filter(t => t.status === 'completed').length,
        constructionCount: transactions.filter(t => t.activityTypeName?.includes('مقاولات') || t.activityTypeName?.includes('Construction')).length,
        consultingCount: transactions.filter(t => t.activityTypeName?.includes('استشارات') || t.activityTypeName?.includes('Consulting')).length,
      },
      finance: {
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent
      },
      hr: {
        totalStaff: employees.size,
        activeField: employees.docs.filter(d => (d.data() as Employee).status === 'active').length,
        onLeave: employees.docs.filter(d => (d.data() as Employee).status === 'on-leave').length,
      }
    };
  }
}
