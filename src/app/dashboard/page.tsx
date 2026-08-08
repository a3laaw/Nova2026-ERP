'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Loader2
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/context/auth-context"
import { useCompanyContext } from "@/context/company-context"
import { useLanguage } from "@/context/language-context"
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
]

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "#039BE5", 
  },
  expenses: {
    label: "Expenses",
    color: "#FFA000", 
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const { company } = useCompanyContext();
  const { globalUser } = useAuthContext();
  const { t, isRtl } = useLanguage();
  const db = useFirestore();
  const router = useRouter();

  const companyId = globalUser?.companyId;
  const isAdmin = globalUser?.roleCode === 'ADMIN' || globalUser?.role?.toLowerCase() === 'admin';

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
    let list = allScheduled.filter(a => isBefore(parseISO(a.start), today));
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(a => a.engineerId === globalUser.employeeId);
    }
    return list;
  }, [allScheduled, isAdmin, globalUser?.employeeId]);

  const stats = [
    {
      title: t('dashboard.stats.revenue'),
      value: "1.2M KWD",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-[#039BE5]",
      bg: "bg-blue-50",
    },
    {
      title: t('dashboard.stats.activeProjects'),
      value: "24",
      change: "+2 new",
      trend: "up",
      icon: Briefcase,
      color: "text-[#FFA000]",
      bg: "bg-orange-50",
    },
    {
      title: t('dashboard.stats.workforce'),
      value: "142",
      change: "98% present",
      trend: "neutral",
      icon: Users,
      color: "text-[#FFCA28]",
      bg: "bg-yellow-50",
    },
    {
      title: t('dashboard.stats.completion'),
      value: "84%",
      change: "+5% yr",
      trend: "up",
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ]

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-xs text-muted-foreground font-medium">{company?.name || '...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 font-semibold px-4 border-slate-200">
            <FileText className="me-2 h-3.5 w-3.5" />
            {t('dashboard.export')}
          </Button>
          <Button size="sm" onClick={() => router.push('/dashboard/clients')} className="h-9 font-semibold px-4 shadow-sm">
            <Plus className="me-2 h-3.5 w-3.5" />
            {t('projects.addNew')}
          </Button>
        </div>
      </header>

      {overdueMissions.length > 0 && (
        <div className="animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-2 mb-3 px-1">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900">
                {t('dashboard.missions')}
              </h2>
              <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 font-bold h-5 px-2 text-[10px] rounded-full">
                 {overdueMissions.length}
              </Badge>
           </div>
           
           <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {overdueMissions.map((mission) => {
                const daysLate = differenceInDays(startOfDay(new Date()), startOfDay(parseISO(mission.start)));
                return (
                  <Card 
                    key={mission.id} 
                    onClick={() => router.push(`/dashboard/appointments/${mission.id}`)}
                    className="min-w-[220px] border-slate-100 bg-white hover:border-primary/20 transition-all cursor-pointer rounded-lg shadow-sm"
                  >
                     <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                           <div className="text-start">
                              <p className="text-[10px] font-bold text-rose-500 uppercase">{t('common.pending')}</p>
                              <p className="text-xs font-bold text-slate-600">{daysLate} {isRtl ? 'أيام' : 'Days'}</p>
                           </div>
                        </div>
                        <div className="text-start space-y-0.5">
                           <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{mission.clientName}</h4>
                           <p className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {format(parseISO(mission.start), 'dd MMM')}
                           </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                           <span className="text-[9px] font-bold text-slate-500 truncate">{mission.engineerName}</span>
                           <ArrowRight className={cn("h-3.5 w-3.5 text-slate-300", isRtl && "rotate-180")} />
                        </div>
                     </CardContent>
                  </Card>
                );
              })}
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="rounded-lg shadow-sm border-slate-100 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-1.5 rounded-md", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold",
                  stat.trend === "up" ? "text-emerald-600" : "text-slate-500"
                )}>
                  {stat.change}
                </span>
              </div>
              <div className="text-start">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                <h3 className="text-xl font-bold text-slate-900">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-lg border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-slate-50/50">
            <div className="text-start">
              <CardTitle className="text-sm font-bold text-slate-900">{t('accounting')}</CardTitle>
            </div>
            <Activity className="h-4 w-4 text-slate-300" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[260px] w-full">
              <ChartContainer config={chartConfig}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748B", fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748B", fontSize: 10, fontWeight: 600 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[2, 2, 0, 0]} barSize={16} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[2, 2, 0, 0]} barSize={16} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="px-6 py-4 border-b bg-slate-50/50 text-start">
            <CardTitle className="text-sm font-bold text-slate-900">{t('dashboard.recent')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {[
                { title: "Quote Approved", detail: "Project Alpha", time: "5m", color: "bg-blue-500" },
                { title: "Attendance Logged", detail: "120 Staff present", time: "1h", color: "bg-orange-500" },
                { title: "Payment Voucher", detail: "Contract #2291", time: "3h", color: "bg-emerald-500" },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3 p-4 hover:bg-slate-50/50 transition-colors">
                  <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", activity.color)} />
                  <div className="flex-1 min-w-0 text-start">
                    <p className="text-xs font-bold text-slate-800 truncate">{activity.title}</p>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{activity.detail}</p>
                  </div>
                  <span className="text-[9px] font-bold text-slate-300">{activity.time}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-slate-50/30">
              <Button variant="ghost" className="w-full h-8 text-[10px] font-bold text-primary hover:bg-primary/5">
                {t('common.viewAll')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
