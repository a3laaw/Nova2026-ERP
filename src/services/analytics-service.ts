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
  totalCost: number;       // الرواتب أو المصاريف التشغيلية من القيود
  valueGenerated: number;  // القيمة المنتجة (ساعات العمل x سعر الساعة المرجعي في الـ BOQ)
  netContribution: number; // الفائض/العجز المالي للمورد
  efficiency: number;      // نسبة الكفاءة (ROI)
}

/**
 * خدمة التحليلات السيادية ومحرك الربحية (Sovereign Profitability Engine).
 * تقوم بالمطابقة الرباعية بين (المقايسة، رادار التنفيذ، الموارد، والقيود المالية).
 */
export class AnalyticsService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تحليل ربحية المشاريع بناءً على القيود المالية المرحلة
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

      // الإيرادات: أي سطر دائن مرتبط بالمشروع (غالباً حساب 401 إيرادات)
      const projectRevenue = allJournalLines
        .filter(l => l.projectId === trans.id && (l.credit || 0) > 0)
        .reduce((acc, l) => acc + (l.credit || 0), 0);

      // التكاليف: أي سطر مدين مرتبط بالمشروع (مواد، عمالة، مقاولي باطن، نثرية)
      const projectCosts = allJournalLines
        .filter(l => l.projectId === trans.id && (l.debit || 0) > 0)
        .reduce((acc, l) => acc + (l.debit || 0), 0);
      
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

    return summaries.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * تحليل جدوى الموارد (ROI)
   * يقارن تكلفة المورد (الراتب أو مصاريف المعدة) مقابل قيمته الإنتاجية في الميدان
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

    // 1. تحليل ربحية العمالة
    employees.forEach(emp => {
      // التكلفة: مجموع الرواتب المدفوعة له (من حساب الرواتب المرتبط به)
      // للتبسيط في هذا الإصدار: نعتمد راتبه الأساسي المسجل
      const monthlyCost = emp.basicSalary || 0; 
      
      // الإنتاجية: مجموع (الساعات المسجلة في الميدان x السعر المرجعي للساعة في الـ BOQ)
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

    // 2. تحليل جدوى المعدات
    equipment.forEach(eq => {
      // التكلفة: كافة القيود المدينة على مركز تكلفة هذه المعدة (صيانة، وقود، إهلاك)
      const actualMaintenanceCost = allJournalLines
        .filter(l => l.costCenterId === eq.id && (l.debit || 0) > 0)
        .reduce((acc, l) => acc + (l.debit || 0), 0);

      // الإنتاجية: (ساعات العمل في المواقع x سعر الإيجار المرجعي للمعدة)
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
        totalCost: actualMaintenanceCost || eq.hourlyDepreciationRate || 0,
        valueGenerated: generatedValue,
        netContribution: generatedValue - actualMaintenanceCost,
        efficiency: actualMaintenanceCost > 0 ? Math.round((generatedValue / actualMaintenanceCost) * 100) : 0
      });
    });

    return resourceStats;
  }
}
