'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { 
  Calculator, Loader2, Printer, LayoutGrid, DatabaseZap, 
  TrendingUp, Wallet, Receipt, Target, 
  History, TrendingDown, Sparkles, ShieldCheck, 
  Scale, Users, Truck, ArrowUpRight, UserCheck, Zap,
  BarChart3, Activity, Search, Filter, Briefcase, ListChecks,
  ChevronDown, RefreshCcw, Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { AnalyticsService, ProjectAnalyticsSummary, ResourceProfitability, ItemProfitability } from '@/services/analytics-service';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import { cn } from '@/lib/utils';

export default function FinancialProfitabilityPage() {
  const { globalUser } = useAuthContext();
  const { t, tSafe, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [projectsData, setProjectsData] = useState<ProjectAnalyticsSummary[]>([]);
  const [resourcesData, setResourcesData] = useState<ResourceProfitability[]>([]);
  const [itemProfitability, setItemProfitability] = useState<ItemProfitability[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId))) : null, 
  [db, companyId]);
  const { data: allTransactions } = useCollection<any>(projectsQuery);

  useEffect(() => {
    async function loadReport() {
      if (!db || !companyId) return;
      setLoading(true);
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

  useEffect(() => {
    async function loadItemData() {
      if (!db || !companyId || selectedProjectId === 'all') {
        setItemProfitability([]);
        return;
      }
      setDrillDownLoading(true);
      try {
        const service = new AnalyticsService(db, companyId);
        const data = await service.getProjectDetailedProfitability(selectedProjectId);
        setItemProfitability(data);
      } finally {
        setDrillDownLoading(false);
      }
    }
    loadItemData();
  }, [db, companyId, selectedProjectId]);

  const filteredItems = useMemo(() => {
    return itemProfitability.filter(i => 
      i.itemTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [itemProfitability, searchTerm]);

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
              <Sparkles className="h-3 w-3" /> {isRtl ? 'رادار الجدوى السيادي' : 'Sovereign Profitability Radar'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'تحليل الربحية والنمو الميداني' : 'Profitability & Growth Analysis'}</h1>
           <p className="text-xs font-bold text-slate-400 italic">{isRtl ? 'مطابقة ذكية بين ميزانية BOQ والمصروف المالي والإنتاجية الميدانية.' : 'Intelligent matching between BOQ budget, spend, and field productivity.'}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-2 h-12 px-6 font-black gap-2 bg-white shadow-sm hover:bg-slate-50 print:hidden">
           <Printer className="h-4 w-4" /> {t('common.print')}
        </Button>
      </header>

      {/* شريط الفلترة الشامل */}
      <Card className="border-0 shadow-2xl rounded-[2rem] bg-white ring-1 ring-black/5 p-6 overflow-visible print:hidden">
         <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="flex-1 space-y-2 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'المشروع المستهدف' : 'Target Project'}
               </Label>
               <SearchableDropdown
                 options={[
                   { id: 'all', name: isRtl ? '--- كافة المشاريع (نظرة شاملة) ---' : '--- All Projects (Overview) ---' },
                   ...(allTransactions || []).map(t => ({ id: t.id, name: t.subServiceName, subText: t.clientName }))
                 ]}
                 value={selectedProjectId}
                 onChange={(val) => setSelectedProjectId(val as string)}
               />
            </div>
            
            {selectedProjectId !== 'all' && (
              <div className="flex-1 space-y-2 text-start animate-in slide-in-from-top-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'بحث في البنود' : 'Search Work Items'}
                 </Label>
                 <div className="relative">
                    <Input 
                      placeholder={isRtl ? 'ابحث باسم بند العمل...' : 'Search item name...'} 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-12 rounded-xl border-2 font-bold ps-10"
                    />
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 </div>
              </div>
            )}

            <Button variant="ghost" onClick={() => { setSelectedProjectId('all'); setSearchTerm(''); }} className="h-12 rounded-xl font-black text-rose-500 gap-2">
               <RefreshCcw className="h-4 w-4" /> {isRtl ? 'تصفير الفلتر' : 'Reset'}
            </Button>
         </div>
      </Card>

      {selectedProjectId === 'all' ? (
        <Tabs defaultValue="projects" className="w-full">
           <TabsList className="bg-white p-1.5 rounded-2xl border-2 border-slate-100 shadow-xl mb-8 h-16 gap-2">
              <TabsTrigger value="projects" className="rounded-xl font-black text-xs px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                 <Target className="h-4 w-4" /> {isRtl ? 'ربحية المشاريع' : 'Project Profits'}
              </TabsTrigger>
              <TabsTrigger value="resources" className="rounded-xl font-black text-xs px-8 h-full data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all gap-2">
                 <Users className="h-4 w-4" /> {isRtl ? 'تحليل كفاءة المورد (ROI)' : 'Resource ROI'}
              </TabsTrigger>
           </TabsList>

           <TabsContent value="projects" className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <Card className="border-0 shadow-xl rounded-[2rem] bg-white p-8 border-b-8 border-primary ring-1 ring-black/5 text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إيرادات محققة (IPCs)' : 'Realized Revenue'}</p>
                    <h3 className="text-3xl font-black text-slate-900">{stats.totalRevenue.toLocaleString()} <span className="text-xs">KWD</span></h3>
                 </Card>
                 <Card className="border-0 shadow-xl rounded-[2rem] bg-white p-8 border-b-8 border-rose-500 ring-1 ring-black/5 text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي تكاليف المشروع' : 'Total Project Costs'}</p>
                    <h3 className="text-3xl font-black text-rose-600">{stats.totalCosts.toLocaleString()} <span className="text-xs">KWD</span></h3>
                 </Card>
                 <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 p-8 text-white relative overflow-hidden group text-start">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp className="h-24 w-24 text-primary" /></div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{isRtl ? 'صافي هامش الربح' : 'Net Gross Margin'}</p>
                    <h3 className="text-4xl font-black text-white">{stats.netMargin.toLocaleString()} <span className="text-xs text-primary">KWD</span></h3>
                    <div className="mt-4">
                       <Badge className="bg-emerald-600 text-white border-0 font-black px-4">{stats.avgMarginPercent}% MARGIN</Badge>
                    </div>
                 </Card>
                 <Card className="border-0 shadow-xl rounded-[2rem] bg-white p-8 border-b-8 border-blue-500 ring-1 ring-black/5 text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الميزانيات (BOQs)' : 'Total Budgets'}</p>
                    <h3 className="text-3xl font-black text-blue-600">{stats.totalBudget.toLocaleString()} <span className="text-xs">KWD</span></h3>
                 </Card>
              </div>

              <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
                 <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-black font-headline flex items-center gap-3">
                       <Scale className="h-6 w-6 text-primary" /> {isRtl ? 'ميزان ربحية المشاريع' : 'Project Profitability Ledger'}
                    </CardTitle>
                    <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px] h-6 px-4">AUDITED BY NOVAFlow</Badge>
                 </CardHeader>
                 <CardContent className="p-0 overflow-x-auto text-start">
                    <table className="w-full text-start">
                       <thead className="bg-muted/10 border-b">
                          <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                             <th className="p-6 ps-10 text-start">{isRtl ? 'المشروع' : 'Project'}</th>
                             <th className="p-6 text-end">{isRtl ? 'الإيراد المحقق' : 'Revenue'}</th>
                             <th className="p-6 text-end">{isRtl ? 'التكلفة الفعلية' : 'Actual Cost'}</th>
                             <th className="p-6 text-end">{isRtl ? 'الربح الصافي' : 'Net Profit'}</th>
                             <th className="p-6 text-center pe-10">{isRtl ? 'الهامش %' : 'Margin %'}</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {projectsData.map((p, i) => (
                             <tr key={i} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedProjectId(p.projectId)}>
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
                                     p.marginPercent > 20 ? "bg-emerald-50 text-white" : p.marginPercent > 0 ? "bg-blue-500 text-white" : "bg-rose-500 text-white"
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
                          <UserCheck className="h-6 w-6 text-blue-600" /> {isRtl ? 'جدوى القوى العاملة (Labor ROI)' : 'Labor Efficiency (ROI)'}
                       </CardTitle>
                       <Badge className="bg-blue-50 text-blue-600 font-black border-0 uppercase text-[10px]">Staff Efficiency</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                       <table className="w-full text-start">
                          <thead className="bg-muted/10 border-b">
                             <tr className="font-black text-slate-500 uppercase text-[9px] tracking-widest">
                                <th className="p-4 ps-8 text-start">{isRtl ? 'الموظف' : 'Staff'}</th>
                                <th className="p-4 text-end">{isRtl ? 'التكلفة (الراتب)' : 'Cost'}</th>
                                <th className="p-4 text-end">{isRtl ? 'القيمة المنتجة' : 'Output Value'}</th>
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
                                      <Badge className={cn("font-black text-[9px]", r.efficiency >= 100 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
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
                          <Truck className="h-6 w-6 text-orange-600" /> {isRtl ? 'عائد استثمار المعدات' : 'Equipment ROI'}
                       </CardTitle>
                       <Badge className="bg-orange-50 text-orange-600 font-black border-0 uppercase text-[10px]">Machinery Yield</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                       <table className="w-full text-start">
                          <thead className="bg-muted/10 border-b">
                             <tr className="font-black text-slate-500 uppercase text-[9px] tracking-widest">
                                <th className="p-4 ps-8 text-start">{isRtl ? 'المعدة' : 'Machine'}</th>
                                <th className="p-4 text-end">{isRtl ? 'التكلفة (تشغيل)' : 'Operating Cost'}</th>
                                <th className="p-4 text-end">{isRtl ? 'القيمة المنتجة' : 'Production Value'}</th>
                                <th className="p-4 text-center pe-8">{isRtl ? 'المساهمة' : 'Net Contribution'}</th>
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
           </TabsContent>
        </Tabs>
      ) : (
        /* عرض تفصيلي لمشروع محدد (Drill Down) */
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-900 p-10 text-white flex flex-row items-center justify-between">
                 <div className="text-start space-y-2">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{isRtl ? 'كشف الربحية الجزيئي للمشروع' : 'Project Molecular Profitability'}</p>
                    <CardTitle className="text-3xl font-black font-headline">{allTransactions?.find(t => t.id === selectedProjectId)?.subServiceName}</CardTitle>
                    <p className="text-sm font-bold opacity-60 italic">{allTransactions?.find(t => t.id === selectedProjectId)?.clientName}</p>
                 </div>
                 <div className="h-16 w-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-primary border border-white/10">
                    <ListChecks className="h-8 w-8" />
                 </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                 {drillDownLoading ? (
                   <div className="py-40 text-center flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary/30" />
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{isRtl ? 'جاري مطابقة بنود المقايسة والمستخلصات...' : 'Matching BOQ items with IPCs...'}</p>
                   </div>
                 ) : (
                   <table className="w-full text-start">
                     <thead className="bg-slate-50 border-b">
                        <tr className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                           <th className="p-6 ps-10 text-start">{isRtl ? 'بند العمل / الكمية' : 'Work Item / Qty'}</th>
                           <th className="p-6 text-end">{isRtl ? 'إيراد البند (مفوتر)' : 'Revenue (Billed)'}</th>
                           <th className="p-6 text-end text-rose-500">{isRtl ? 'التكلفة المباشرة' : 'Direct Cost'}</th>
                           <th className="p-6 text-end text-emerald-600">{isRtl ? 'صافي الربح' : 'Net Profit'}</th>
                           <th className="p-6 text-center pe-10">{isRtl ? 'هامش البند' : 'Item Margin'}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((item, idx) => (
                           <tr key={idx} className="hover:bg-primary/[0.01] transition-colors">
                              <td className="p-6 ps-10 text-start">
                                 <p className="font-black text-slate-800 text-sm">{item.itemTitle}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{item.executedQty} / {item.plannedQty} {item.unit}</span>
                                 </div>
                              </td>
                              <td className="p-6 text-end font-mono font-bold text-slate-700">{item.revenue.toLocaleString()}</td>
                              <td className="p-6 text-end font-mono font-bold text-rose-500">{item.cost.toLocaleString()}</td>
                              <td className="p-6 text-end font-mono font-black text-emerald-600">{item.profit.toLocaleString()}</td>
                              <td className="p-6 text-center pe-10">
                                 <Badge className={cn(
                                   "font-black text-[10px] px-3 py-1 rounded-lg border-0 shadow-sm",
                                   item.marginPercent > 30 ? "bg-emerald-500 text-white" : item.marginPercent > 0 ? "bg-blue-500 text-white" : "bg-rose-500 text-white"
                                 )}>
                                    {item.marginPercent}%
                                 </Badge>
                              </td>
                           </tr>
                        ))}
                        {filteredItems.length === 0 && (
                          <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-bold italic">{isRtl ? 'لا يوجد بيانات إنجاز مالية لهذا البحث.' : 'No financial progress data for this search.'}</td></tr>
                        )}
                     </tbody>
                   </table>
                 )}
              </CardContent>
           </Card>

           <div className="p-8 rounded-[3rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4 shadow-inner">
              <Info className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
              <div className="text-start space-y-2">
                 <h5 className="font-black text-sm text-amber-800 uppercase tracking-tighter">{isRtl ? 'منطق الاحتساب الجزيئي' : 'Molecular Calculation Logic'}</h5>
                 <p className="text-[10px] text-amber-700 leading-relaxed font-bold italic">
                    {isRtl 
                      ? 'يتم احتساب التكلفة المباشرة للبند عبر تجميع ساعات العمل والمعدات الموثقة في سجلات المهندس الميدانية لهذا البند تحديداً، ومطابقتها مع الإيراد المعتمد في مستخلصات المالك (IPCs). هذا يمنحك رؤية حقيقية لربحية كل خطوة في المشروع.' 
                      : 'Direct cost per item is calculated by aggregating labor and equipment hours from field logs specifically for this item, and matching them with approved revenue from Owner IPCs.'}
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
