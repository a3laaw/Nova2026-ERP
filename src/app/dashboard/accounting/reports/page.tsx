'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line
} from 'recharts';
import { 
  Calculator, Loader2, Printer, LayoutGrid, DatabaseZap, Activity,
  TrendingUp, Wallet, Receipt, Briefcase, FileText, Target,
  History,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  Scale,
  Users,
  Truck,
  ArrowUpRight,
  UserCheck,
  Zap
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { AnalyticsService, ProjectAnalyticsSummary, ResourceProfitability } from '@/services/analytics-service';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FinancialProfitabilityPage() {
  const { globalUser } = useAuthContext();
  const { t, tSafe, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [projectsData, setProjectsData] = useState<ProjectAnalyticsSummary[]>([]);
  const [resourcesData, setResourcesData] = useState<ResourceProfitability[]>([]);

  useEffect(() => {
    async function loadReport() {
      if (!db || !companyId) return;
      
      try {
        const service = new AnalyticsService(db, companyId);
        const [pData, rData] = await Promise.all([
          service.getProjectsPerformance(),
          service.getResourcesProfitability()
        ]);
        setProjectsData(pData);
        setResourcesData(rData);
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
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'تحليل الربحية ومراكز التكلفة' : 'Profitability & Cost Centers'}</h1>
           <p className="text-xs font-bold text-slate-400 italic">{isRtl ? 'مطابقة حية بين إيرادات المالك وتكاليف الموارد (عمالة ومعدات).' : 'Real-time matching between revenue and resource costs.'}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-2 h-12 px-6 font-black gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </header>

      <Tabs defaultValue="projects" className="w-full">
         <TabsList className="bg-white p-1.5 rounded-2xl border-2 border-slate-100 shadow-xl mb-8 h-16 gap-2">
            <TabsTrigger value="projects" className="rounded-xl font-black text-xs px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
               <Target className="h-4 w-4" /> {isRtl ? 'ربحية المشاريع' : 'Project Profits'}
            </TabsTrigger>
            <TabsTrigger value="resources" className="rounded-xl font-black text-xs px-8 h-full data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all gap-2">
               <Users className="h-4 w-4" /> {isRtl ? 'تحليل أداء الموارد' : 'Resource ROI'}
            </TabsTrigger>
         </TabsList>

         <TabsContent value="projects" className="space-y-8 animate-in slide-in-from-bottom-4">
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

            <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
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
                     </tbody>
                  </table>
               </CardContent>
            </Card>
         </TabsContent>

         <TabsContent value="resources" className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                  <CardHeader className="bg-slate-50/50 border-b p-8 flex items-center justify-between">
                     <CardTitle className="text-lg font-black flex items-center gap-3">
                        <UserCheck className="h-6 w-6 text-blue-600" /> {isRtl ? 'كفاءة العمالة (ROI)' : 'Labor Efficiency (ROI)'}
                     </CardTitle>
                     <Badge className="bg-blue-50 text-blue-600 font-black border-0">TOP PERFORMERS</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                     <table className="w-full text-start">
                        <thead className="bg-muted/10 border-b">
                           <tr className="font-black text-slate-500 uppercase text-[9px] tracking-widest">
                              <th className="p-4 ps-8 text-start">{isRtl ? 'الموظف' : 'Staff'}</th>
                              <th className="p-4 text-end">{isRtl ? 'التكلفة' : 'Cost'}</th>
                              <th className="p-4 text-end">{isRtl ? 'القيمة' : 'Value'}</th>
                              <th className="p-4 text-center pe-8">{isRtl ? 'الكفاءة' : 'ROI'}</th>
                           </tr>
                        </thead>
                        <tbody>
                           {resourcesData.filter(r => r.type === 'employee').sort((a,b) => b.efficiency - a.efficiency).map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50 border-b last:border-0">
                                 <td className="p-4 ps-8 font-black text-xs text-slate-800">{r.name}</td>
                                 <td className="p-4 text-end font-mono text-xs text-rose-500">{r.totalCost.toLocaleString()}</td>
                                 <td className="p-4 text-end font-mono text-xs text-emerald-600">{r.valueGenerated.toLocaleString()}</td>
                                 <td className="p-4 text-center pe-8">
                                    <Badge className={cn("font-black text-[9px]", r.efficiency > 100 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                                       {r.efficiency}%
                                    </Badge>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </CardContent>
               </Card>

               <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                  <CardHeader className="bg-slate-50/50 border-b p-8 flex items-center justify-between">
                     <CardTitle className="text-lg font-black flex items-center gap-3">
                        <Truck className="h-6 w-6 text-orange-600" /> {isRtl ? 'عائد استثمار المعدات' : 'Equipment ROI Radar'}
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                     <table className="w-full text-start">
                        <thead className="bg-muted/10 border-b">
                           <tr className="font-black text-slate-500 uppercase text-[9px] tracking-widest">
                              <th className="p-4 ps-8 text-start">{isRtl ? 'المعدة' : 'Machine'}</th>
                              <th className="p-4 text-end">{isRtl ? 'التكلفة' : 'Maint/Ops'}</th>
                              <th className="p-4 text-end">{isRtl ? 'العائد' : 'Income'}</th>
                              <th className="p-4 text-center pe-8">{isRtl ? 'المساهمة' : 'Net'}</th>
                           </tr>
                        </thead>
                        <tbody>
                           {resourcesData.filter(r => r.type === 'equipment').map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50 border-b last:border-0">
                                 <td className="p-4 ps-8 font-black text-xs text-slate-800">{r.name}</td>
                                 <td className="p-4 text-end font-mono text-xs text-rose-500">{r.totalCost.toLocaleString()}</td>
                                 <td className="p-4 text-end font-mono text-xs text-emerald-600">{r.valueGenerated.toLocaleString()}</td>
                                 <td className="p-4 text-center pe-8">
                                    <span className={cn("font-black text-xs", r.netContribution >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                       {r.netContribution.toLocaleString()}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </CardContent>
               </Card>
            </div>

            <div className="p-10 rounded-[3rem] bg-slate-900 text-white flex items-start gap-8 relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 p-10 opacity-5"><Zap className="h-40 w-40 text-primary" /></div>
               <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0"><ShieldCheck className="h-10 w-10" /></div>
               <div className="space-y-3 relative z-10 text-start">
                  <h4 className="text-xl font-black font-headline text-primary">{isRtl ? 'نظام الرقابة التشغيلية الذري' : 'Atomic Operational Control System'}</h4>
                  <p className="text-sm font-bold text-slate-400 leading-relaxed max-w-3xl">
                     {isRtl 
                       ? 'يتم احتساب الربحية بناءً على المطابقة بين القيود المالية المرحلة وسجلات الإنجاز الميدانية الموثقة. إذا لم يقم المهندس بتسجيل ساعات العمل، لن تظهر مساهمة المورد في هذا الرادار.' 
                       : 'Profitability is calculated by matching posted ledger entries with verified field logs. If an engineer fails to log work hours, resource contribution will not reflect in this radar.'}
                  </p>
               </div>
            </div>
         </TabsContent>
      </Tabs>
    </div>
  );
}
