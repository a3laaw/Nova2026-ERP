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
import { JournalEntry, JournalEntryLine } from '@/types/accounting';
import { Employee } from '@/types/hr';
import { Equipment } from '@/types/equipment';

export interface ProjectAnalyticsSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  completionRate: number;
  totalBudget: number;  
  totalRevenue: number; 
  totalSpent: number;   
  margin: number;       
  marginPercent: number;
  variance: number;     
  status: string;
}

export interface ResourceProfitability {
  resourceId: string;
  name: string;
  type: 'employee' | 'equipment';
  totalCost: number;       // الرواتب أو المصاريف التشغيلية
  valueGenerated: number;  // القيمة المنتجة في المشاريع (بناءً على الساعات المسجلة x فئة الـ BOQ)
  netContribution: number; // الفرق بين القيمة والتكلفة
  efficiency: number;      // نسبة الكفاءة
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
 * تقوم بالمطابقة الرباعية بين (المقايسة، رادار التنفيذ، الموارد، والقيود المالية).
 */
export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تحليل أداء المشاريع المالي
   */
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
      const projectBoq = allBoqs.find(b => b.transactionId === trans.id);
      const totalBudget = projectBoq?.totalAmount || 0;

      const projectRevenue = allJournalLines
        .filter(l => l.projectId === trans.id && (l.credit || 0) > 0)
        .reduce((acc, l) => acc + (l.credit || 0), 0);

      const projectCosts = allJournalLines
        .filter(l => l.projectId === trans.id && (l.debit || 0) > 0)
        .reduce((acc, l) => acc + (l.debit || 0), 0);
      
      let completionRate = 0;
      try {
        const stagesSnap = await getDocs(collection(this.db, paths.transactionStages(this.companyId, trans.id)));
        const total = stagesSnap.size;
        const done = stagesSnap.docs.filter(d => d.data().status === 'completed').length;
        completionRate = total > 0 ? Math.round((done / total) ? (done / total) * 100 : 0) : 0;
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

  /**
   * تحليل ربحية الموارد (عمالة ومعدات)
   * يقارن التكلفة (الراتب/الإهلاك) مقابل القيمة المنتجة في المشاريع
   */
  async getResourcesProfitability(): Promise<ResourceProfitability[]> {
    const [empsSnap, equipSnap, execsSnap, journalSnap] = await Promise.all([
      getDocs(collection(this.db, paths.employees(this.companyId))),
      getDocs(collection(this.db, paths.equipment(this.companyId))),
      getDocs(query(collection(this.db, paths.executions(this.companyId)), where('isArchived', '==', false))),
      getDocs(query(collection(this.db, paths.journalEntries(this.companyId)), where('status', '==', 'posted')))
    ]);

    const employees = empsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
    const equipment = equipSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
    const executions = execsSnap.docs.map(d => d.data());
    const allJournalLines = journalSnap.docs.flatMap(d => (d.data() as JournalEntry).lines || []);

    const resourceStats: ResourceProfitability[] = [];

    // 1. تحليل العمالة
    employees.forEach(emp => {
      const actualCost = emp.basicSalary || 0; // التكلفة الشهرية
      
      // حساب القيمة المنتجة: الساعات المسجلة في الميدان x سعر الساعة المرجعي
      let generatedValue = 0;
      executions.forEach(ex => {
        const myLogs = (ex.laborDetails || []).filter((l: any) => l.resourceId === emp.id);
        myLogs.forEach((log: any) => {
          generatedValue += (log.hours || 0) * (log.hourlyCostRef || 0);
        });
      });

      resourceStats.push({
        resourceId: emp.id!,
        name: emp.fullName,
        type: 'employee',
        totalCost: actualCost,
        valueGenerated: generatedValue,
        netContribution: generatedValue - actualCost,
        efficiency: actualCost > 0 ? Math.round((generatedValue / actualCost) * 100) : 0
      });
    });

    // 2. تحليل المعدات
    equipment.forEach(eq => {
      // تكلفة المعدة من القيود (صيانة، وقود، إهلاك)
      const actualCost = allJournalLines
        .filter(l => l.costCenterId === eq.id && (l.debit || 0) > 0)
        .reduce((acc, l) => acc + (l.debit || 0), 0);

      // القيمة المنتجة من سجلات التشغيل الميدانية
      let generatedValue = 0;
      executions.forEach(ex => {
        const myLogs = (ex.equipmentUsed || []).filter((e: any) => e.equipmentId === eq.id);
        myLogs.forEach((log: any) => {
          generatedValue += (log.hoursUsed || 0) * (log.hourlyRateRef || 0);
        });
      });

      resourceStats.push({
        resourceId: eq.id!,
        name: eq.name,
        type: 'equipment',
        totalCost: actualCost,
        valueGenerated: generatedValue,
        netContribution: generatedValue - actualCost,
        efficiency: actualCost > 0 ? Math.round((generatedValue / actualCost) * 100) : 0
      });
    });

    return resourceStats;
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
