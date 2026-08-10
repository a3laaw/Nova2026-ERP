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
  TrendingUp, TrendingDown, Target, 
  Calculator, Loader2, ArrowUpRight, 
  Sparkles, ShieldCheck, Activity,
  Filter, Printer, LayoutGrid, FileText,
  Landmark, Receipt, PieChart as PieChartIcon
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function FinancialReportsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [profitabilityData, setProfitabilityData] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!db || !companyId) return;
      
      // محاكاة حساب الربحية من مراكز التكلفة
      // في النسخة الكاملة يتم جلبها من الـ AnalyticsService
      const projectsSnap = await getDocs(query(collection(db, paths.transactions(companyId))));
      const data = projectsSnap.docs.map(doc => {
         const p = doc.data();
         const revenue = Math.floor(Math.random() * 50000) + 10000;
         const costs = Math.floor(revenue * 0.7);
         return {
            name: p.subServiceName,
            revenue,
            costs,
            profit: revenue - costs,
            margin: Math.round(((revenue - costs) / revenue) * 100)
         };
      });
      setProfitabilityData(data);
      setLoading(false);
    }
    loadData();
  }, [db, companyId]);

  const totals = useMemo(() => {
    return {
       revenue: profitabilityData.reduce((sum, p) => sum + p.revenue, 0),
       costs: profitabilityData.reduce((sum, p) => sum + p.costs, 0),
       profit: profitabilityData.reduce((sum, p) => sum + p.profit, 0)
    };
  }, [profitabilityData]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-6 text-start">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Calculator className="h-3 w-3" /> {isRtl ? 'التقارير المالية والربحية' : 'Financial & Profitability Reports'}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'رادار مراكز التكلفة والنتائج' : 'Cost Center Performance Radar'}</h1>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-2 h-12 px-6 font-black gap-2 bg-white shadow-sm">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
            <h3 className="text-3xl font-black text-blue-600">{totals.revenue.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-rose-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي التكاليف' : 'Total Costs'}</p>
            <h3 className="text-3xl font-black text-rose-600">{totals.costs.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-white border-b-8 border-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'صافي الربح التشغيلي' : 'Net Operating Profit'}</p>
            <h3 className="text-3xl font-black text-emerald-600">{totals.profit.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
               <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {isRtl ? 'تحليل ربحية مراكز التكلفة' : 'Cost Center Profitability'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-10">
               <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitabilityData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={25} />
                      <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </CardContent>
         </Card>

         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
               <CardTitle className="text-lg font-black flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                  {isRtl ? 'تفاصيل مراكز التكلفة' : 'Cost Center Details'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <table className="w-full text-start">
                  <thead className="bg-muted/30">
                     <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                        <th className="p-6 ps-10">{isRtl ? 'مركز التكلفة (المشروع)' : 'Cost Center'}</th>
                        <th className="p-6 text-end">{isRtl ? 'الإيراد' : 'Revenue'}</th>
                        <th className="p-6 text-end">{isRtl ? 'المصروف' : 'Expense'}</th>
                        <th className="p-6 text-end pe-10">{isRtl ? 'هامش الربح' : 'Margin'}</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                     {profitabilityData.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                           <td className="p-6 ps-10 font-black text-slate-800 text-sm">{p.name}</td>
                           <td className="p-6 text-end font-mono font-bold text-blue-600">{p.revenue.toLocaleString()}</td>
                           <td className="p-6 text-end font-mono font-bold text-rose-500">{p.costs.toLocaleString()}</td>
                           <td className="p-6 text-end pe-10">
                              <Badge className={cn("font-black px-3", p.margin > 20 ? "bg-emerald-500" : "bg-orange-500")}>
                                 {p.margin}%
                              </Badge>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
