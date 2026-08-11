'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Calculator, Loader2, Printer, LayoutGrid, DatabaseZap, Activity,
  TrendingUp, Wallet, Receipt, Briefcase, FileText, Target,
  History
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { JournalEntry, Account } from '@/types/accounting';
import { CostCenter, ProfitCenter } from '@/types/cost-profit-centers';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function FinancialReportsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{
    costCenters: any[],
    profitCenters: any[],
    projects: any[]
  }>({ costCenters: [], profitCenters: [], projects: [] });

  useEffect(() => {
    async function loadReport() {
      if (!db || !companyId) return;
      
      try {
        // 1. جلب كافة البيانات الأساسية
        const [journalsSnap, accountsSnap, costSnap, profitSnap, projectsSnap] = await Promise.all([
          getDocs(collection(db, paths.journalEntries(companyId))),
          getDocs(collection(db, paths.accounts(companyId))),
          getDocs(collection(db, paths.costCenters(companyId))),
          getDocs(collection(db, paths.profitCenters(companyId))),
          getDocs(collection(db, paths.transactions(companyId)))
        ]);

        const allLines = journalsSnap.docs.flatMap(d => (d.data() as JournalEntry).lines || []);
        
        // 2. معالجة تقرير مراكز التكلفة
        const ccReport = costSnap.docs.map(d => {
           const center = { id: d.id, ...d.data() } as CostCenter;
           const spent = allLines
             .filter(l => l.costCenterId === center.id)
             .reduce((acc, l) => acc + (l.debit || 0) - (l.credit || 0), 0);
           return { ...center, amount: spent };
        }).filter(c => c.amount !== 0);

        // 3. معالجة تقرير مراكز الربحية
        const pcReport = profitSnap.docs.map(d => {
           const center = { id: d.id, ...d.data() } as ProfitCenter;
           const revenue = allLines
             .filter(l => l.profitCenterId === center.id)
             .reduce((acc, l) => acc + (l.credit || 0) - (l.debit || 0), 0);
           return { ...center, amount: revenue };
        }).filter(c => c.amount !== 0);

        // 4. معالجة تقرير ربحية المشاريع
        const projectReport = projectsSnap.docs.map(d => {
           const proj = { id: d.id, ...(d.data() as any) };
           const revenue = allLines
             .filter(l => l.projectId === proj.id && l.profitCenterId)
             .reduce((acc, l) => acc + (l.credit || 0) - (l.debit || 0), 0);
           const costs = allLines
             .filter(l => l.projectId === proj.id && l.costCenterId)
             .reduce((acc, l) => acc + (l.debit || 0) - (l.credit || 0), 0);
           return {
              name: proj.subServiceName || '---',
              revenue,
              costs,
              profit: revenue - costs,
              margin: revenue > 0 ? Math.round(((revenue - costs) / revenue) * 100) : 0
           };
        }).filter(p => p.revenue > 0 || p.costs > 0);

        setReportData({ costCenters: ccReport, profitCenters: pcReport, projects: projectReport });
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [db, companyId]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in pb-20" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6 text-start">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <TrendingUp className="h-3 w-3" /> {isRtl ? 'التحليل المالي السيادي' : 'Sovereign Financial Analysis'}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقارير مراكز التكلفة والربحية' : 'Cost & Profit Analytics'}</h1>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-2 h-12 px-6 font-black gap-2 bg-white shadow-sm">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* 1. تقرير ربحية المشاريع */}
         <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-900 p-8 text-white flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-xl font-black font-headline flex items-center gap-3">
                     <Target className="h-6 w-6 text-primary" /> {isRtl ? 'ربحية المشاريع' : 'Project Profitability'}
                  </CardTitle>
               </div>
               <Badge className="bg-primary text-white border-0 font-black">ROI ACTIVE</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <table className="w-full text-start">
                  <thead className="bg-slate-50 border-b">
                     <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                        <th className="p-6 ps-8">{isRtl ? 'المشروع' : 'Project'}</th>
                        <th className="p-6 text-end">{isRtl ? 'إيرادات' : 'Revenue'}</th>
                        <th className="p-6 text-end">{isRtl ? 'مصروفات' : 'Costs'}</th>
                        <th className="p-6 text-end pe-8">{isRtl ? 'الربح' : 'Net'}</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {reportData.projects.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                           <td className="p-6 ps-8">
                              <p className="font-black text-slate-800 text-sm">{p.name}</p>
                              <Badge variant="outline" className="text-[8px] font-black mt-1">{p.margin}% MARGIN</Badge>
                           </td>
                           <td className="p-6 text-end font-mono font-bold text-emerald-600">{p.revenue.toLocaleString()}</td>
                           <td className="p-6 text-end font-mono font-bold text-rose-500">{p.costs.toLocaleString()}</td>
                           <td className="p-6 text-end pe-8 font-mono font-black text-slate-900">{p.profit.toLocaleString()}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </CardContent>
         </Card>

         <div className="space-y-8">
            {/* 2. تقرير مراكز التكلفة */}
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-rose-50/50 p-6 border-b text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-rose-900">
                     <LayoutGrid className="h-4 w-4" /> {isRtl ? 'توزيع المصاريف حسب مركز التكلفة' : 'Costs by Center'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  <table className="w-full text-start text-xs">
                     <tbody className="divide-y">
                        {reportData.costCenters.map((cc, i) => (
                           <tr key={i} className="hover:bg-slate-50">
                              <td className="p-4 ps-8 font-bold text-slate-700">{cc.name}</td>
                              <td className="p-4 text-end pe-8 font-mono font-black text-rose-600">{cc.amount.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </CardContent>
            </Card>

            {/* 3. تقرير مراكز الربحية */}
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-emerald-50/50 p-6 border-b text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-emerald-900">
                     <DatabaseZap className="h-4 w-4" /> {isRtl ? 'تحليل الإيرادات حسب مركز الربحية' : 'Revenue by Profit Center'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  <table className="w-full text-start text-xs">
                     <tbody className="divide-y">
                        {reportData.profitCenters.map((pc, i) => (
                           <tr key={i} className="hover:bg-slate-50">
                              <td className="p-4 ps-8 font-bold text-slate-700">{pc.name}</td>
                              <td className="p-4 text-end pe-8 font-mono font-black text-emerald-600">{pc.amount.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </CardContent>
            </div>

            <div className="space-y-6 text-start">
               <h3 className="font-black text-lg border-s-4 border-emerald-500 ps-3 flex items-center gap-2">
                  <History className="h-5 w-5 text-emerald-500" /> {isRtl ? 'السجل التاريخي للتحليل' : 'Historical Analytics Log'}
               </h3>
            </div>
         </div>
      </div>
    </div>
  );
}
