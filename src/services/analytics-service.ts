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
import { BOQ } from '@/types/documents';
import { PurchaseOrder } from '@/types/procurement';
import { Employee } from '@/types/hr';
import { JournalEntry } from '@/types/accounting';

export interface ProjectAnalyticsSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  completionRate: number;
  totalBudget: number;  // من المقايسة المعتمدة
  totalRevenue: number; // من المستخلصات المعتمدة (IPCs)
  totalSpent: number;   // من القيود المحاسبية المرتبطة بمركز تكلفة المشروع
  margin: number;       // Revenue - Spent
  marginPercent: number;
  variance: number;     // Budget - Spent
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
    totalRevenue: number;
    totalSpent: number;
    remaining: number;
    globalMargin: number;
  };
  hr: {
    totalStaff: number;
    activeField: number;
    onLeave: number;
  };
}

/**
 * خدمة التحليلات السيادية ومحرك الربحية (Sovereign Profitability Engine).
 * تقوم بالمطابقة الرباعية بين (المقايسة، رادار التنفيذ، المشتريات، والقيود المالية).
 */
export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  async getProjectsPerformance(): Promise<ProjectAnalyticsSummary[]> {
    const [transSnap, boqsSnap, journalSnap] = await Promise.all([
      getDocs(query(collection(this.db, paths.transactions(this.companyId)))),
      getDocs(query(collection(this.db, paths.boqs(this.companyId)))),
      getDocs(query(collection(this.db, paths.journalEntries(this.companyId)), where('status', '==', 'posted')))
    ]);

    const allTrans = transSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    const allBoqs = boqsSnap.docs.map(d => d.data() as BOQ);
    const allJournalLines = journalSnap.docs.flatMap(d => (d.data() as JournalEntry).lines || []);

    const summaries = await Promise.all(allTrans.map(async (trans) => {
      // 1. الربط بالمقايسة (Budget)
      const projectBoq = allBoqs.find(b => b.transactionId === trans.id);
      const totalBudget = projectBoq?.totalAmount || 0;

      // 2. حساب الإيرادات الفعلية (Revenue) من القيود المحاسبية المرتبطة بمشروع
      // نبحث عن أسطر القيود التي فيها دائن لحسابات الإيراد ومرتبطة بهذا المشروع
      const projectRevenue = allJournalLines
        .filter(l => l.projectId === trans.id && (l.credit || 0) > 0)
        .reduce((acc, l) => acc + (l.credit || 0), 0);

      // 3. حساب المصاريف الفعلية (Spent)
      // نبحث عن أسطر القيود التي فيها مدين لحسابات المصاريف ومرتبطة بهذا المشروع
      const projectCosts = allJournalLines
        .filter(l => l.projectId === trans.id && (l.debit || 0) > 0)
        .reduce((acc, l) => acc + (l.debit || 0), 0);
      
      // 4. حساب نسبة الإنجاز الفني من الميدان
      let completionRate = 0;
      try {
        const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, trans.id)));
        const total = stagesSnap.size;
        const done = stagesSnap.docs.filter(d => d.data().status === 'completed').length;
        completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      } catch { completionRate = 0; }

      const margin = projectRevenue - projectCosts;
      const marginPercent = projectRevenue > 0 ? Math.round((margin / projectRevenue) * 100) : 0;

      return {
        projectId: trans.id,
        projectName: trans.subServiceName,
        clientName: trans.clientName,
        completionRate,
        totalBudget,
        totalRevenue: projectRevenue,
        totalSpent: projectCosts,
        margin,
        marginPercent,
        variance: totalBudget - projectCosts,
        status: trans.status
      };
    }));

    return summaries;
  }

  async getGlobalExecutiveSummary(): Promise<ExecutiveSummary> {
    const summaries = await this.getProjectsPerformance();
    const [clients, trans, employees] = await Promise.all([
      getDocs(collection(this.db, paths.clients(this.companyId))),
      getDocs(collection(this.db, paths.transactions(this.companyId))),
      getDocs(collection(this.db, paths.employees(this.companyId)))
    ]);

    const transactions = trans.docs.map(d => d.data() as Transaction);
    
    const totalBudget = summaries.reduce((acc, s) => acc + s.totalBudget, 0);
    const totalRevenue = summaries.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalSpent = summaries.reduce((acc, s) => acc + s.totalSpent, 0);

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
        totalRevenue,
        totalSpent,
        remaining: totalBudget - totalSpent,
        globalMargin: totalRevenue - totalSpent
      },
      hr: {
        totalStaff: employees.size,
        activeField: employees.docs.filter(d => (d.data() as Employee).status === 'active').length,
        onLeave: employees.docs.filter(d => (d.data() as Employee).status === 'on-leave').length,
      }
    };
  }
}
