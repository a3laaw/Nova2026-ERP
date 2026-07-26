'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Filter, Printer, LayoutGrid, FileText
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { AnalyticsService, ProjectAnalyticsSummary } from '@/services/analytics-service';
import { cn } from '@/lib/utils';

export default function GlobalAnalyticsPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProjectAnalyticsSummary[]>([]);

  useEffect(() => {
    async function load() {
      if (!db || !companyId) return;
      const service = new AnalyticsService(db, companyId);
      const res = await service.getProjectsPerformance();
      setData(res);
      setLoading(false);
    }
    load();
  }, [db, companyId]);

  const chartData = useMemo(() => {
    return data.map(p => ({
      name: p.projectName.slice(0, 15),
      budget: p.totalBudget,
      spent: p.totalSpent,
      variance: p.variance
    }));
  }, [data]);

  const stats = useMemo(() => {
    return {
      totalBudget: data.reduce((acc, p) => acc + p.totalBudget, 0),
      totalSpent: data.reduce((acc, p) => acc + p.totalSpent, 0),
      savings: data.reduce((acc, p) => acc + (p.variance > 0 ? p.variance : 0), 0)
    };
  }, [data]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <Sparkles className="h-3 w-3" /> {isRtl ? 'ذكاء Nova التحليلي' : 'Nova Analytics Intelligence'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'رادار الأداء التشغيلي والمالي' : 'Operational & Financial Radar'}</h1>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={() => window.print()} className="rounded-2xl border-2 h-12 px-6 font-black gap-2 bg-white shadow-sm hover:bg-slate-50">
             <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'تصدير التقرير' : 'Export Report'}
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-slate-900 text-white p-8 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Calculator className="h-32 w-32" /></div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{isRtl ? 'إجمالي المحفظة المالية' : 'Total Portfolio Value'}</p>
            <h3 className="text-4xl font-black font-headline text-emerald-400">{stats.totalBudget.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white p-8 border-b-8 border-b-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isRtl ? 'المصروف الفعلي (المعتمد)' : 'Actual Approved Spend'}</p>
            <h3 className="text-3xl font-black text-blue-600">{stats.totalSpent.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white p-8 border-b-8 border-b-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isRtl ? 'الوفر / المتبقي المالي' : 'Unspent Balance'}</p>
            <h3 className="text-3xl font-black text-emerald-600">{stats.savings.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
               <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {isRtl ? 'مقارنة الميزانية بالمصروف' : 'Budget vs. Spent Analysis'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-10">
               <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="budget" fill="#e87c24" radius={[6, 6, 0, 0]} barSize={25} name={isRtl ? 'الميزانية' : 'Budget'} />
                      <Bar dataKey="spent" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={25} name={isRtl ? 'المصروف' : 'Spent'} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </CardContent>
         </Card>

         <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
               <CardTitle className="text-lg font-black flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                  {isRtl ? 'توزيع الميزانية عبر المسارات' : 'Budget Distribution'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-10 flex items-center justify-center">
               <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="budget"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#e87c24', '#2563eb', '#10b981', '#facc15', '#ef4444'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
            </CardContent>
         </Card>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
         <CardHeader className="bg-slate-50 border-b p-8 text-start">
            <CardTitle className="text-xl font-black">{isRtl ? 'كشف الأداء المالي التفصيلي (Ledger)' : 'Detailed Performance Ledger'}</CardTitle>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-start">
               <thead className="bg-muted/30">
                  <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                     <th className="p-6 ps-10">{isRtl ? 'المشروع / العميل' : 'Project / Client'}</th>
                     <th className="p-6 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                     <th className="p-6 text-end">{isRtl ? 'الميزانية' : 'Budget'}</th>
                     <th className="p-6 text-end">{isRtl ? 'المصروف' : 'Spent'}</th>
                     <th className="p-6 text-end pe-10">{isRtl ? 'الانحراف' : 'Variance'}</th>
                  </tr>
               </thead>
               <tbody className="divide-y">
                  {data.map(p => (
                     <tr key={p.projectId} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6 ps-10 text-start">
                           <div className="text-start">
                              <p className="font-black text-slate-800 text-sm">{p.projectName}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.clientName}</p>
                           </div>
                        </td>
                        <td className="p-6 text-center">
                           <Badge variant="outline" className="font-black text-[9px] uppercase px-3">{p.status}</Badge>
                        </td>
                        <td className="p-6 text-end font-mono font-bold text-slate-900">{p.totalBudget.toLocaleString()}</td>
                        <td className="p-6 text-end font-mono font-bold text-blue-600">{p.totalSpent.toLocaleString()}</td>
                        <td className="p-6 text-end pe-10">
                           <span className={cn("font-mono font-black", p.variance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {p.variance >= 0 ? '+' : ''}{p.variance.toLocaleString()}
                           </span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </CardContent>
      </Card>
    </div>
  );
}
