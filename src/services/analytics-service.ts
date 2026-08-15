'use client';

import { 
  Firestore, 
  collection, 
  getDocs, 
  query, 
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Transaction } from '@/types/transaction';
import { BOQ, BOQItem } from '@/types/documents';
import { JournalEntry } from '@/types/accounting';
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

export interface ItemProfitability {
  itemId: string;
  itemTitle: string;
  unit: string;
  plannedQty: number;
  executedQty: number;
  revenue: number;      // المبالغ المفوترة للمالك عن هذا البند (من الـ IPCs)
  cost: number;         // التكاليف المباشرة (عمالة + معدات) المسجلة لهذا البند
  profit: number;
  marginPercent: number;
}

export interface ResourceProfitability {
  resourceId: string;
  name: string;
  type: 'employee' | 'equipment';
  totalCost: number;       
  valueGenerated: number;  
  netContribution: number; 
  efficiency: number;      
}

/**
 * خدمة التحليلات السيادية ومحرك الربحية (Sovereign Profitability Engine).
 */
export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب الأداء المالي العام لكافة المشاريع
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
      
      const margin = projectRevenue - projectCosts;
      const marginPercent = projectRevenue > 0 ? Math.round((margin / projectRevenue) * 100) : 0;

      return {
        projectId: trans.id,
        projectName: trans.subServiceName,
        clientName: trans.clientName,
        completionRate: 0, 
        totalBudget,
        totalRevenue: projectRevenue,
        totalSpent: projectCosts,
        margin,
        marginPercent,
        variance: totalBudget - projectCosts,
        status: trans.status
      };
    }));

    return summaries.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * تحليل الربحية الجزيئي (على مستوى البند) لمشروع محدد
   */
  async getProjectDetailedProfitability(projectId: string): Promise<ItemProfitability[]> {
    // 1. جلب بنود المقايسة
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', projectId)));
    if (boqsSnap.empty) return [];
    const boqId = boqsSnap.docs[0].id;
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const boqItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));

    // 2. جلب إيرادات البنود من المستخلصات المعتمدة (IPCs)
    const ipcsSnap = await getDocs(query(collection(this.db, paths.ipcs(this.companyId)), where('transactionId', '==', projectId), where('status', '==', 'approved')));
    const itemRevenueMap = new Map<string, number>();
    ipcsSnap.docs.forEach(d => {
      const ipc = d.data();
      (ipc.lineItems || []).forEach((li: any) => {
        const current = itemRevenueMap.get(li.boqItemId) || 0;
        itemRevenueMap.set(li.boqItemId, current + (li.amount || 0));
      });
    });

    // 3. جلب تكاليف البنود من سجلات التنفيذ الميدانية (Executions)
    const execsSnap = await getDocs(query(collection(this.db, paths.executions(this.companyId)), where('transactionId', '==', projectId), where('isArchived', '==', false)));
    const itemCostMap = new Map<string, number>();
    execsSnap.docs.forEach(d => {
      const exec = d.data();
      const laborCost = (exec.laborDetails || []).reduce((acc: number, l: any) => acc + (l.totalCost || 0), 0);
      const equipCost = (exec.equipmentUsed || []).reduce((acc: number, e: any) => acc + (e.totalCost || 0), 0);
      const current = itemCostMap.get(exec.boqItemId) || 0;
      itemCostMap.set(exec.boqItemId, current + laborCost + equipCost);
    });

    // 4. بناء التقرير الجزيئي
    return boqItems.map(item => {
      const revenue = itemRevenueMap.get(item.id!) || 0;
      const cost = itemCostMap.get(item.id!) || 0;
      const profit = revenue - cost;
      const marginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      return {
        itemId: item.id!,
        itemTitle: item.referenceTitle,
        unit: item.unitSymbol || '',
        plannedQty: item.plannedQuantity || 0,
        executedQty: item.executedQuantity || 0,
        revenue,
        cost,
        profit,
        marginPercent
      };
    }).sort((a, b) => b.profit - a.profit);
  }

  /**
   * تحليل جدوى الموارد
   */
  async getResourcesProfitability(): Promise<ResourceProfitability[]> {
    const [empsSnap, equipSnap, execsSnap] = await Promise.all([
      getDocs(collection(this.db, paths.employees(this.companyId))),
      getDocs(collection(this.db, paths.equipment(this.companyId))),
      getDocs(query(collection(this.db, paths.executions(this.companyId)), where('isArchived', '==', false)))
    ]);

    const employees = empsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
    const equipment = equipSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
    const executions = execsSnap.docs.map(d => d.data());

    const resourceStats: ResourceProfitability[] = [];

    employees.forEach(emp => {
      const monthlyCost = emp.basicSalary || 0; 
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
        totalCost: monthlyCost,
        valueGenerated: generatedValue,
        netContribution: generatedValue - monthlyCost,
        efficiency: monthlyCost > 0 ? Math.round((generatedValue / monthlyCost) * 100) : 0
      });
    });

    equipment.forEach(eq => {
      const depRate = eq.hourlyDepreciationRate || 0;
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
        totalCost: depRate * 160, // افتراض تكلفة شهرية تشغيلية
        valueGenerated: generatedValue,
        netContribution: generatedValue - (depRate * 160),
        efficiency: (depRate * 160) > 0 ? Math.round((generatedValue / (depRate * 160)) * 100) : 0
      });
    });

    return resourceStats;
  }
}
