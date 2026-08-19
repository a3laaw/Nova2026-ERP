'use client';

import { 
  Firestore, 
  collection, 
  getDocs, 
  query, 
  where,
  limit
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
  revenue: number;      
  cost: number;         
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

export interface GlobalFilters {
  projectId: string;
  costCenterId: string;
  profitCenterId: string;
  searchTerm: string;
}

export interface ExecutiveSummary {
  projects: {
    active: number;
    total: number;
    constructionCount: number;
    consultingCount: number;
  };
  finance: {
    totalBudget: number;
    totalSpent: number;
    margin: number;
  };
  hr: {
    totalStaff: number;
  };
}

export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تقرير ربحية البنود المجهري (Molecular Item Profitability)
   * يربط إيرادات المستخلصات (IPCs) بتكاليف التنفيذ الميداني (Executions) لكل بند
   */
  async getProjectDetailedProfitability(projectId: string): Promise<ItemProfitability[]> {
    const boqSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', projectId), limit(1)));
    if (boqSnap.empty) return [];
    const boqId = boqSnap.docs[0].id;

    const [itemsSnap, ipcsSnap, execsSnap] = await Promise.all([
      getDocs(collection(this.db, paths.boqItems(this.companyId, boqId))),
      getDocs(query(collection(this.db, paths.ipcs(this.companyId)), where('transactionId', '==', projectId), where('status', '==', 'approved'))),
      getDocs(query(collection(this.db, paths.executions(this.companyId)), where('transactionId', '==', projectId), where('isArchived', '==', false)))
    ]);

    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    const ipcs = ipcsSnap.docs.map(d => d.data());
    const execs = execsSnap.docs.map(d => d.data());

    return items.map(item => {
      let revenue = 0;
      ipcs.forEach(ipc => {
        const line = (ipc.lineItems || []).find((li: any) => li.boqItemId === item.id);
        if (line) revenue += (line.amount || 0);
      });

      let cost = 0;
      execs.filter(ex => ex.boqItemId === item.id).forEach(ex => {
        const laborCost = (ex.laborDetails || []).reduce((acc: number, l: any) => acc + (l.totalCost || 0), 0);
        const equipCost = (ex.equipmentUsed || []).reduce((acc: number, e: any) => acc + (e.totalCost || 0), 0);
        cost += (laborCost + equipCost);
      });

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
    });
  }

  async getFilteredPerformance(filters: GlobalFilters): Promise<ProjectAnalyticsSummary[]> {
    const [transSnap, boqsSnap, journalSnap] = await Promise.all([
      getDocs(collection(this.db, paths.transactions(this.companyId))),
      getDocs(collection(this.db, paths.boqs(this.companyId))),
      getDocs(query(collection(this.db, paths.journalEntries(this.companyId)), where('status', '==', 'posted')))
    ]);

    const allTrans = transSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    const allBoqs = boqsSnap.docs.map(d => d.data() as BOQ);
    const allJournalLines = journalSnap.docs.flatMap(d => (d.data() as JournalEntry).lines || []);

    const summaries = await Promise.all(allTrans.map(async (trans) => {
      if (filters.projectId !== 'all' && trans.id !== filters.projectId) return null;

      const projectBoq = allBoqs.find(b => b.transactionId === trans.id);
      const totalBudget = projectBoq?.totalAmount || 0;

      const filteredLines = allJournalLines.filter(l => {
        const matchProject = l.projectId === trans.id;
        const matchCC = filters.costCenterId === 'all' || l.costCenterId === filters.costCenterId;
        const matchPC = filters.profitCenterId === 'all' || l.profitCenterId === filters.profitCenterId;
        return matchProject && matchCC && matchPC;
      });

      const projectRevenue = filteredLines
        .filter(l => (l.credit || 0) > 0)
        .reduce((acc, l) => acc + (l.credit || 0), 0);

      const projectCosts = filteredLines
        .filter(l => (l.debit || 0) > 0)
        .reduce((acc, l) => acc + (l.debit || 0), 0);
      
      const margin = projectRevenue - projectCosts;
      const marginPercent = projectRevenue > 0 ? Math.round((margin / projectRevenue) * 100) : 0;

      if (filters.costCenterId !== 'all' && projectRevenue === 0 && projectCosts === 0) return null;

      return {
        projectId: trans.id,
        projectName: trans.subServiceName,
        clientName: trans.clientName,
        totalBudget,
        totalRevenue: projectRevenue,
        totalSpent: projectCosts,
        margin,
        marginPercent,
        variance: totalBudget - projectCosts,
        status: trans.status
      };
    }));

    return (summaries.filter(s => s !== null) as ProjectAnalyticsSummary[])
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  async getProjectsPerformance(): Promise<ProjectAnalyticsSummary[]> {
    return this.getFilteredPerformance({ projectId: 'all', costCenterId: 'all', profitCenterId: 'all', searchTerm: '' });
  }

  async getFilteredResourcesProfitability(filters: GlobalFilters): Promise<ResourceProfitability[]> {
    const [empsSnap, equipSnap, execsSnap] = await Promise.all([
      getDocs(collection(this.db, paths.employees(this.companyId))),
      getDocs(collection(this.db, paths.equipment(this.companyId))),
      getDocs(query(collection(this.db, paths.executions(this.companyId)), where('isArchived', '==', false)))
    ]);

    const employees = empsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
    const equipment = equipSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
    const allExecutions = execsSnap.docs.map(d => d.data());

    const filteredExecs = allExecutions.filter(ex => 
       filters.projectId === 'all' || ex.transactionId === filters.projectId
    );

    const resourceStats: ResourceProfitability[] = [];

    employees.forEach(emp => {
      const monthlyCost = emp.basicSalary || 0; 
      let generatedValue = 0;

      filteredExecs.forEach(ex => {
        const myLogs = (ex.laborDetails || []).filter((l: any) => l.resourceId === emp.id);
        myLogs.forEach((log: any) => {
          generatedValue += (log.hours || 0) * (log.hourlyCostRef || 0);
        });
      });

      if (generatedValue > 0 || monthlyCost > 0) {
        resourceStats.push({
          resourceId: emp.id!,
          name: emp.fullName,
          type: 'employee',
          totalCost: monthlyCost,
          valueGenerated: generatedValue,
          netContribution: generatedValue - monthlyCost,
          efficiency: monthlyCost > 0 ? Math.round((generatedValue / monthlyCost) * 100) : 0
        });
      }
    });

    equipment.forEach(eq => {
      const baseHourlyCost = eq.ownershipType === 'owned' ? (eq.hourlyDepreciationRate || 0) : (eq.hourlyRentalRate || 0);
      const totalCost = baseHourlyCost * 160; 
      let generatedValue = 0;

      filteredExecs.forEach(ex => {
        const myLogs = (ex.equipmentUsed || []).filter((e: any) => e.equipmentId === eq.id);
        myLogs.forEach((log: any) => {
          generatedValue += (log.hours || log.hoursUsed || 0) * (log.hourlyRateRef || 0);
        });
      });

      if (generatedValue > 0 || totalCost > 0) {
        resourceStats.push({
          resourceId: eq.id!,
          name: eq.name,
          type: 'equipment',
          totalCost: totalCost,
          valueGenerated: generatedValue,
          netContribution: generatedValue - totalCost,
          efficiency: totalCost > 0 ? Math.round((generatedValue / totalCost) * 100) : 0
        });
      }
    });

    return resourceStats.sort((a, b) => b.efficiency - a.efficiency);
  }

  async getGlobalExecutiveSummary(): Promise<ExecutiveSummary> {
     const [transSnap, boqsSnap, empsSnap] = await Promise.all([
       getDocs(collection(this.db, paths.transactions(this.companyId))),
       getDocs(collection(this.db, paths.boqs(this.companyId))),
       getDocs(collection(this.db, paths.employees(this.companyId)))
     ]);

     const boqs = boqsSnap.docs.map(d => d.data());
     const totalBudget = boqs.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
     const totalSpent = totalBudget * 0.45; 

     return {
       projects: {
         active: transSnap.docs.filter(d => d.data().status !== 'completed').length,
         total: transSnap.size,
         constructionCount: transSnap.docs.filter(d => d.data().activityTypeName?.includes('مقاولات')).length,
         consultingCount: transSnap.docs.filter(d => d.data().activityTypeName?.includes('استشارات')).length
       },
       finance: {
         totalBudget,
         totalSpent,
         margin: totalBudget - totalSpent
       },
       hr: {
         totalStaff: empsSnap.size
       }
     };
  }
}
