'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  Plus,
  Activity,
  FileText,
  ShieldAlert,
  ArrowRight,
  Clock,
  LayoutDashboard
} from "lucide-react";
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { startOfDay, isBefore, parseISO, format, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';

const data = [
  { name: "Jan", revenue: 4500, expenses: 2400 },
  { name: "Feb", revenue: 5200, expenses: 2800 },
  { name: "Mar", revenue: 4800, expenses: 3200 },
  { name: "Apr", revenue: 6100, expenses: 2900 },
  { name: "May", revenue: 5900, expenses: 3500 },
  { name: "Jun", revenue: 7200, expenses: 4100 },
];

export default function DashboardPage() {
  const { globalUser } = useAuthContext();
  const { t, isRtl, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();

  const companyId = globalUser?.companyId;
  const isAdmin = globalUser?.roleCode === 'ADMIN' || globalUser?.role?.toUpperCase() === 'admin';

  const chartConfig = useMemo(() => ({
    revenue: { label: t('dashboard.chart.revenue'), color: "#039BE5" },
    expenses: { label: t('dashboard.chart.expenses'), color: "#FFA000" },
  } satisfies ChartConfig), [t]);

  const apptsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(
      collection(db, paths.appointments(companyId)),
      where('status', '==', 'scheduled'),
      orderBy('start', 'asc')
    );
  }, [db, companyId]);

  const { data: allScheduled } = useCollection<Appointment>(apptsQuery);

  const overdueMissions = useMemo(() => {
    const today = startOfDay(new Date());
    let list = (allScheduled || []).filter(a => isBefore(parseISO(a.start), today));
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(a => a.engineerId === globalUser.employeeId);
    }
    return list;
  }, [allScheduled, isAdmin, globalUser?.employeeId]);

  const stats = [
    {
      title: t('dashboard.stats.completion'),
      value: "84%",
      change: `5%+`,
      unit: t('dashboard.units.yr'),
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      title: t('dashboard.stats.workforce'),
      value: "142",
      change: `98%`,
      unit: t('dashboard.units.present'),
      icon: Users,
      color: "text-[#FFCA28]",
      bg: "bg-yellow-50",
    },
    {
      title: t('dashboard.stats.activeprojects'),
      value: "24",
      change: `2+`,
      unit: t('dashboard.units.new'),
      icon: Briefcase,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      title: t('dashboard.stats.revenue'),
      value: "1.2M",
      change: `12.5%+`,
      unit: t('dashboard.units.kwd'),
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6 w-full animate-in fade-in" dir={dir}>
      {/* Header الموحد للداشبورد */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex gap-3">
          <Button onClick={() => router.push('/dashboard/clients/new')} className="bg-primary text-white h-11 px-6 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
            {t('projects.addNew')} <Plus className="ms-2 h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-11 px-6 rounded-xl font-black border-2 bg-white text-slate-400 gap-2">
            {t('dashboard.export')} <FileText className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-start">
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('dashboard')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5">{t('dashboard.subtitle')}</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <LayoutDashboard className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="rounded-2xl shadow-sm border-slate-100 bg-white text-start">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div className="text-end">
                   <span className={cn("text-xs font-black", stat.color)}>{stat.unit} {stat.change}</span>
                   <div className="h-1 w-12 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className={cn("h-full", stat.color.replace('text', 'bg'))} style={{ width: '70%' }} />
                   </div>
                </div>
              </div>
              <div className="text-start">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.title}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value} <span className="text-xs font-bold text-slate-400">{stat.title === t('dashboard.stats.revenue') ? t('dashboard.units.kwd') : ''}</span></h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* النشاطات الأخيرة */}
        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-slate-900">{t('dashboard.recent')}</CardTitle>
            <Activity className="h-4 w-4 text-slate-300" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {[
                { title: t('dashboard.recent.quoteApproved'), detail: "Project Alpha", time: "5m", color: "bg-blue-500" },
                { title: t('dashboard.recent.attendanceLogged'), detail: "Staff present 120", time: "1h", color: "bg-orange-500" },
                { title: t('dashboard.recent.paymentVoucher'), detail: "Contract #2291", time: "3h", color: "bg-emerald-500" },
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
            <div className="p-4 bg-slate-50/30 border-t">
              <Button variant="ghost" className="w-full h-8 text-[10px] font-black text-primary hover:bg-primary/5" onClick={() => router.push('/dashboard/reports')}>
                {t('common.viewAll')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* رسم بياني */}
        <Card className="lg:col-span-2 rounded-2xl border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-slate-50/50">
            <div className="text-start">
              <CardTitle className="text-sm font-black text-slate-900">{t('accounting')}</CardTitle>
            </div>
            <Activity className="h-4 w-4 text-slate-300" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10, fontWeight: 700 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="#039BE5" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expenses" fill="#FFA000" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
