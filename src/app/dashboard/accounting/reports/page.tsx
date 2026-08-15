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
  Calculator, Loader2, Printer, LayoutGrid, DatabaseZap, Activity,
  TrendingUp, Wallet, Receipt, Briefcase, FileText, Target,
  History,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  Scale
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { AnalyticsService, ProjectAnalyticsSummary } from '@/services/analytics-service';
import { cn } from '@/lib/utils';

export default function FinancialProfitabilityPage() {
  const { globalUser } = useAuthContext();
  const { t, tSafe, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [projectsData, setProjectsData] = useState<ProjectAnalyticsSummary[]>([]);

  useEffect(() => {
    async function loadReport() {
      if (!db || !companyId) return;
      
      try {
        const service = new AnalyticsService(db, companyId);
        const data = await service.getProjectsPerformance();
        setProjectsData(data);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [db, companyId]);

  const stats = useMemo(() => {
    return {
      totalBudget: projectsData.reduce((acc, p) => acc + p.totalBudget, 0),
      totalRevenue: projectsData.reduce((acc, p) => acc + p.totalRevenue, 0),
      totalCosts: projectsData.reduce((acc, p) => acc + p.totalSpent, 0),
      netMargin: projectsData.reduce((acc, p) => acc + p.margin, 0),
      avgMarginPercent: projectsData.length > 0 ? Math.round(projectsData.reduce((acc, p) => acc + p.marginPercent, 0) / projectsData.length) : 0
    };
  }, [projectsData]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in pb-20 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit border border-primary/10 shadow-sm">
              <Sparkles className="h-3 w-3" /> {isRtl ? 'محرك الربحية السيادي' : 'Sovereign Profitability Engine'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'تحليل الربحية وكفاءة المشاريع' : 'Project Profitability Analytics'}</h1>
           <p className="text-xs font-bold text-slate-400 italic">{isRtl ? 'مطابقة حية بين إيرادات المالك وتكاليف الميدان الفعلية.' : 'Real-time matching between owner revenue and actual field costs.'}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-2 h-12 px-6 font-black gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-0 shadow-xl rounded-[2rem] bg-white p-8 border-b-8 border-primary ring-1 ring-black/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إيرادات محققة (IPCs)' : 'Realized Revenue'}</p>
            <h3 className="text-3xl font-black text-slate-900">{stats.totalRevenue.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-xl rounded-[2rem] bg-white p-8 border-b-8 border-rose-500 ring-1 ring-black/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي التكاليف المباشرة' : 'Direct Project Costs'}</p>
            <h3 className="text-3xl font-black text-rose-600">{stats.totalCosts.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp className="h-24 w-24 text-primary" /></div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{isRtl ? 'صافي هامش الربح' : 'Net Gross Margin'}</p>
            <h3 className="text-4xl font-black text-white">{stats.netMargin.toLocaleString()} <span className="text-xs text-primary">KWD</span></h3>
            <div className="mt-4">
               <Badge className="bg-emerald-600 text-white border-0 font-black px-4">{stats.avgMarginPercent}% MARGIN</Badge>
            </div>
         </Card>
         <Card className="border-0 shadow-xl rounded-[2rem] bg-white p-8 border-b-8 border-blue-500 ring-1 ring-black/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'المحفظة (Budget)' : 'Total Budget'}</p>
            <h3 className="text-3xl font-black text-blue-600">{stats.totalBudget.toLocaleString()} <span className="text-xs">KWD</span></h3>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Profitability Ledger */}
         <Card className="lg:col-span-8 border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-xl font-black font-headline flex items-center gap-3">
                     <Scale className="h-6 w-6 text-primary" /> {isRtl ? 'ميزان ربحية المشاريع' : 'Project Profitability Ledger'}
                  </CardTitle>
               </div>
               <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px] h-6 px-4">AUDITED BY NOVAFlow</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto text-start">
               <table className="w-full text-start">
                  <thead className="bg-muted/10 border-b">
                     <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                        <th className="p-6 ps-10 text-start">{isRtl ? 'المشروع' : 'Project'}</th>
                        <th className="p-6 text-end">{isRtl ? 'الإيراد' : 'Revenue'}</th>
                        <th className="p-6 text-end">{isRtl ? 'التكلفة' : 'Spent'}</th>
                        <th className="p-6 text-end">{isRtl ? 'الربح' : 'Net'}</th>
                        <th className="p-6 text-center pe-10">{isRtl ? 'الهامش %' : 'Margin %'}</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {projectsData.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                           <td className="p-6 ps-10 text-start">
                              <p className="font-black text-slate-800 text-sm">{p.projectName}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{p.clientName}</p>
                           </td>
                           <td className="p-6 text-end font-mono font-bold text-slate-900">{p.totalRevenue.toLocaleString()}</td>
                           <td className="p-6 text-end font-mono font-bold text-rose-500">{p.totalSpent.toLocaleString()}</td>
                           <td className="p-6 text-end font-mono font-black text-emerald-600">{p.margin.toLocaleString()}</td>
                           <td className="p-6 text-center pe-10">
                              <Badge className={cn(
                                "font-black text-[10px] px-4 py-1 rounded-lg border-0 shadow-sm",
                                p.marginPercent > 20 ? "bg-emerald-500 text-white" : p.marginPercent > 0 ? "bg-blue-500 text-white" : "bg-rose-500 text-white"
                              )}>
                                 {p.marginPercent}%
                              </Badge>
                           </td>
                        </tr>
                     ))}
                     {projectsData.length === 0 && (
                       <tr><td colSpan={5} className="py-24 text-center italic text-slate-300 font-bold">{t('common.noResults')}</td></tr>
                     )}
                  </tbody>
               </table>
            </CardContent>
         </Card>

         <div className="lg:col-span-4 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-primary/5 p-6 border-b text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-primary">
                     <Target className="h-4 w-4" /> {isRtl ? 'تحليل كفاءة الميزانية' : 'Budget Accuracy Index'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8">
                  <div className="h-[250px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={projectsData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="totalSpent"
                           >
                              {projectsData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={['#e87c24', '#2563eb', '#10b981', '#facc15'][index % 4]} />
                              ))}
                           </Pie>
                           <Tooltip />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="pt-6 border-t border-slate-50 space-y-4">
                     <div className="flex items-center gap-4 text-start">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-sm"><Info className="h-5 w-5" /></div>
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                           {isRtl ? 'يتم احتساب الربحية بناءً على الإيرادات المفوترة (Posted IPCs) مقابل التكاليف المرحلة في دفتر الأستاذ.' : 'Profitability is calculated based on posted revenue vs ledgered costs.'}
                        </p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="p-8 rounded-[2rem] bg-white border-2 border-primary/10 shadow-xl flex items-start gap-5 text-start ring-4 ring-primary/5">
               <ShieldCheck className="h-8 w-8 text-primary shrink-0 mt-1" />
               <div className="space-y-2">
                  <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest">{isRtl ? 'نزاهة الأداء المالي' : 'Financial Integrity Guard'}</h5>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                     {isRtl ? 'المحرك يمنع تضخيم الأرباح الورقية ويقوم بخصم كافة الالتزامات المستحقة (Accruals) لضمان رؤية نقدية حقيقية.' : 'Engine prevents paper-profit inflation by accounting for all recognized accruals and liabilities.'}
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
