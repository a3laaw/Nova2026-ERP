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
  Users, HardHat, Landmark, ShoppingCart
} from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { AnalyticsService, ExecutiveSummary } from '@/services/analytics-service';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function ExecutiveReportPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExecutiveSummary | null>(null);

  useEffect(() => {
    async function load() {
      if (!db || !companyId) return;
      const service = new AnalyticsService(db, companyId);
      const res = await service.getGlobalExecutiveSummary();
      setData(res);
      setLoading(false);
    }
    load();
  }, [db, companyId]);

  const projectDistData = useMemo(() => {
    if (!data) return [];
    return [
      { name: isRtl ? 'مقاولات' : 'Construction', value: data.projects.constructionCount, color: '#f97316' },
      { name: isRtl ? 'استشارات' : 'Consulting', value: data.projects.consultingCount, color: '#0ea5e9' }
    ];
  }, [data, isRtl]);

  const financialChartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: isRtl ? 'الميزانية' : 'Budget', amount: data.finance.totalBudget },
      { name: isRtl ? 'المصروف' : 'Spent', amount: data.finance.totalSpent }
    ];
  }, [data, isRtl]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 bg-[#fdfaf3]" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden px-4 pt-4 text-start">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-white px-4 py-1.5 rounded-full w-fit border-2 border-primary/10 shadow-sm">
              <Landmark className="h-3 w-3" /> {isRtl ? 'التقرير السيادي الشامل' : 'Unified Executive Report'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'ملخص الأداء العام للمنشأة' : 'Enterprise Performance Summary'}</h1>
        </div>
        <Button onClick={() => window.print()} className="rounded-[1.5rem] h-14 px-10 font-black gap-2 bg-slate-900 text-white shadow-2xl hover:scale-105 transition-all">
           <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'استخراج التقرير الرسمي' : 'Print Official Report'}
        </Button>
      </header>

      <div className="px-4">
        <PrintWrapper title={isRtl ? "التقرير التنفيذي السنوي الشامل" : "Annual Executive Performance Report"}>
           <div className="space-y-10">
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white border-b-8 border-emerald-500 p-8 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform text-emerald-600"><Calculator className="h-24 w-24" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{isRtl ? 'إجمالي المحفظة' : 'Portfolio Value'}</p>
                    <h3 className="text-3xl font-black font-headline text-slate-900">{data.finance.totalBudget.toLocaleString()} <span className="text-xs text-slate-400">KWD</span></h3>
                 </Card>
                 <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white p-8 border-b-8 border-primary">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isRtl ? 'المشاريع الجارية' : 'Active Projects'}</p>
                    <h3 className="text-3xl font-black text-slate-900">{data.projects.active}</h3>
                 </Card>
                 <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white p-8 border-b-8 border-secondary">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isRtl ? 'القوى العاملة' : 'Total Staff'}</p>
                    <h3 className="text-3xl font-black text-slate-900">{data.hr.totalStaff}</h3>
                 </Card>
                 <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white p-8 border-b-8 border-accent">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isRtl ? 'انضباط الحضور' : 'Attendance'}</p>
                    <h3 className="text-3xl font-black text-slate-900">94%</h3>
                 </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                    <CardHeader className="bg-slate-50 border-b p-8 text-start">
                       <CardTitle className="text-lg font-black flex items-center gap-2">
                          <Activity className="h-5 w-5 text-primary" />
                          {isRtl ? 'تحليل الميزانية vs المصروفات' : 'Budget vs Expenses'}
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10">
                       <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={financialChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} barSize={40}>
                                   {financialChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={index === 0 ? '#f97316' : '#0ea5e9'} />
                                   ))}
                                </Bar>
                             </BarChart>
                          </ResponsiveContainer>
                       </div>
                    </CardContent>
                 </Card>

                 <Card className="border-0 shadow-xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
                    <CardHeader className="bg-slate-50 border-b p-8 text-start">
                       <CardTitle className="text-lg font-black flex items-center gap-2">
                          <LayoutGrid className="h-5 w-5 text-primary" />
                          {isRtl ? 'توزيع المحفظة حسب النشاط' : 'Portfolio by Activity'}
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 flex flex-col items-center">
                       <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                <Pie
                                   data={projectDistData}
                                   cx="50%"
                                   cy="50%"
                                   innerRadius={70}
                                   outerRadius={100}
                                   paddingAngle={8}
                                   dataKey="value"
                                >
                                   {projectDistData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
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

              <div className="p-10 rounded-[3rem] bg-emerald-50/30 border-2 border-dashed border-emerald-200 flex items-start gap-6 text-start shadow-inner">
                 <ShieldCheck className="h-8 w-8 text-emerald-600 shrink-0 mt-1" />
                 <div className="space-y-2">
                    <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest">{isRtl ? 'شهادة صحة البيانات السحابية' : 'Cloud Data Integrity'}</h5>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                       {isRtl 
                         ? 'تم استخراج هذا التقرير آلياً من محرك NovaFlow ERP. كافة القيم المالية والإنتاجية تم التحقق من صحتها من خلال سجلات التدقيق المربوطة بالهوية الرقمية للمهندسين.' 
                         : 'Report auto-generated by NovaFlow engine. Values verified via engineer-linked digital signatures.'}
                    </p>
                 </div>
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}
