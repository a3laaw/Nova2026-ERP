'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  Plus,
  Activity,
  FileText,
  LayoutDashboard,
  ArrowUpRight
} from "lucide-react";
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useRouter } from 'next/navigation';

const chartData = [
  { name: "Jan", revenue: 4500, expenses: 2400 },
  { name: "Feb", revenue: 5200, expenses: 2800 },
  { name: "Mar", revenue: 4800, expenses: 3200 },
  { name: "Apr", revenue: 6100, expenses: 2900 },
  { name: "May", revenue: 5900, expenses: 3500 },
  { name: "Jun", revenue: 7200, expenses: 4100 },
];

export default function DashboardPage() {
  const { t, dir, isRtl } = useLanguage();
  const router = useRouter();

  const chartConfig = {
    revenue: {
      label: isRtl ? "الإيرادات" : "Revenue",
      color: "hsl(var(--primary))",
    },
    expenses: {
      label: isRtl ? "المصروفات" : "Expenses",
      color: "hsl(var(--secondary))",
    },
  } satisfies ChartConfig;

  const stats = [
    {
      title: t('dashboard.stats.revenue'),
      value: "1.2M",
      change: t('dashboard.units.yearly'),
      unit: t('dashboard.units.kwd'),
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      title: t('dashboard.stats.activeprojects'),
      value: "24",
      change: t('dashboard.units.new'),
      unit: t('dashboard.units.project'),
      icon: Briefcase,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      title: t('dashboard.stats.workforce'),
      value: "142",
      change: t('dashboard.units.present'),
      unit: t('dashboard.units.employee'),
      icon: Users,
      color: "text-yellow-500",
      bg: "bg-yellow-50",
    },
    {
      title: t('dashboard.stats.completion'),
      value: "84%",
      change: t('dashboard.units.yearly'),
      unit: "",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-700" dir={dir}>
      {/* Sovereign Header Design (H-14) */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <LayoutDashboard className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('dashboard')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">
               {t('dashboard.description')}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => router.push('/dashboard/projects')} className="bg-primary text-white h-11 px-6 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
             <Plus className={cn("h-4 w-4", isRtl ? "ms-2" : "me-2")} /> {t('common.add')}
          </Button>
          <Button variant="outline" className="h-11 px-6 rounded-xl font-black border-2 bg-white text-slate-400 gap-2">
             <FileText className="h-4 w-4" /> {t('dashboard.export')}
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="rounded-2xl shadow-sm border-slate-100 bg-white text-start group hover:shadow-xl transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div className="text-end">
                   <span className={cn("text-xs font-black", stat.color)}>{stat.change}</span>
                </div>
              </div>
              <div className="text-start">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.title}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value} <span className="text-xs font-bold text-slate-400">{stat.unit}</span></h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white text-start">
          <CardHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-slate-900">{t('dashboard.recent')}</CardTitle>
            <Activity className="h-4 w-4 text-slate-300" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {[
                { title: isRtl ? "اعتماد ميزانية مشروع صباح السالم" : "Approve Project Budget", detail: t('boqexplorer'), time: "5m", color: "bg-blue-500" },
                { title: isRtl ? "تسجيل حضور طاقم العمل الميداني" : "Record site crew attendance", detail: t('hr'), time: "1h", color: "bg-orange-500" },
                { title: isRtl ? "إصدار سند صرف للمورد" : "Issue payment voucher", detail: t('accounting'), time: "3h", color: "bg-emerald-500" },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3 p-4 hover:bg-slate-50/50 transition-colors">
                  <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", activity.color)} />
                  <div className="flex-1 min-w-0 text-start">
                    <p className="text-xs font-black text-slate-800 truncate">{activity.title}</p>
                    <p className="text-[10px] text-slate-500 font-bold truncate">{activity.detail}</p>
                  </div>
                  <span className="text-[9px] font-bold text-slate-300">{activity.time}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50/30 border-t text-center">
              <Button variant="ghost" className="w-full h-8 text-[10px] font-black text-primary hover:bg-primary/5">
                {t('common.viewall')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white text-start">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-slate-50/50">
            <div className="text-start">
              <CardTitle className="text-sm font-black text-slate-900">{isRtl ? 'الأداء المالي للمشاريع' : 'Project Financial Performance'}</CardTitle>
            </div>
            <Activity className="h-4 w-4 text-slate-300" />
          </CardHeader>
          <CardContent className="p-6">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
