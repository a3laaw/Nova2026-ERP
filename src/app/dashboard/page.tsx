'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  ArrowUpRight, 
  Plus,
  Activity,
  FileText
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/context/auth-context"
import { useCompanyContext } from "@/context/company-context"
import { useLanguage } from "@/context/language-context"

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
    color: "#039BE5", // Firebase Blue
  },
  expenses: {
    label: "Expenses",
    color: "#FFA000", // Firebase Orange
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const { company } = useCompanyContext();
  const { t, dir, lang } = useLanguage();
  const isRtl = lang === 'ar';

  const stats = [
    {
      title: isRtl ? "إيرادات المشاريع" : "Project Revenue",
      value: "1.2M KWD",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-[#039BE5]",
      bg: "bg-blue-50",
    },
    {
      title: isRtl ? "المشاريع النشطة" : "Active Projects",
      value: "24",
      change: "+2 new",
      trend: "up",
      icon: Briefcase,
      color: "text-[#FFA000]",
      bg: "bg-orange-50",
    },
    {
      title: isRtl ? "القوى العاملة" : "Workforce",
      value: "142",
      change: "98% present",
      trend: "neutral",
      icon: Users,
      color: "text-[#FFCA28]",
      bg: "bg-yellow-50",
    },
    {
      title: isRtl ? "معدل الإنجاز" : "Completion Rate",
      value: "84%",
      change: "+5% yr",
      trend: "up",
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ]

  return (
    <div className="space-y-6" dir={dir}>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-start">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{isRtl ? 'نظرة عامة على العمليات' : 'Operations Overview'}</h1>
          <p className="text-muted-foreground text-sm font-medium">{company?.name || '...'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 h-9 font-bold px-4">
            <FileText className="me-2 h-4 w-4" />
            {isRtl ? `تصدير التقرير` : `Export`}
          </Button>
          <Button size="sm" className="bg-[#FFA000] hover:bg-[#F57C00] text-white shadow-sm h-9 font-bold px-5">
            <Plus className="me-2 h-4 w-4" />
            {isRtl ? 'مشروع جديد' : 'New Project'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm card-shadow bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={cn("p-2 rounded-lg", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-bold border-none",
                  stat.trend === "up" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                )}>
                  {stat.change}
                </Badge>
              </div>
              <div className="text-start">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.title}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm card-shadow bg-white">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-slate-50">
            <div className="text-start">
              <CardTitle className="text-lg font-bold text-slate-900">{isRtl ? 'الأداء المالي والإنتاجي' : 'Financial Performance'}</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500">{isRtl ? 'تحليل الإيرادات والمصروفات' : 'Monthly revenue analysis'}</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-slate-300" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748B", fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#64748B", fontSize: 11, fontWeight: 700 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm card-shadow bg-white">
          <CardHeader className="px-6 py-5 border-b border-slate-50 text-start">
            <CardTitle className="text-lg font-bold text-slate-900">{isRtl ? 'سجل العمليات' : 'Live Activity'}</CardTitle>
            <CardDescription className="text-xs font-bold text-slate-500">Real-time site updates</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {[
                { title: isRtl ? "موافقة على عرض سعر" : "Quote Approved", detail: "Project Alpha - Steel Supply", time: "5m", color: "bg-[#039BE5]" },
                { title: isRtl ? "تحديث بصمة الحضور" : "Attendance Logged", detail: "120 Staff checked-in", time: "1h", color: "bg-[#FFCA28]" },
                { title: isRtl ? "إصدار مستند مالي" : "Payment Voucher", detail: "Contract #2291 - Installment 1", time: "3h", color: "bg-emerald-500" },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-4 p-5 hover:bg-slate-50/50 transition-colors">
                  <div className={cn("h-2 w-2 rounded-full mt-2 shrink-0", activity.color)} />
                  <div className="flex-1 min-w-0 text-start">
                    <p className="text-sm font-bold text-slate-800 truncate">{activity.title}</p>
                    <p className="text-xs text-slate-600 font-bold truncate mt-0.5">{activity.detail}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{activity.time}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50/30">
              <Button variant="ghost" className="w-full h-9 text-xs font-black text-[#039BE5] hover:bg-blue-50">
                {isRtl ? 'عرض السجل الكامل' : 'View All'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
