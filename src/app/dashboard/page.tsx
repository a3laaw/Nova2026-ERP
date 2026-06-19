'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  ArrowUpRight, 
  Plus,
  HardHat,
  UserCircle,
  ShoppingCart,
  FileText
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
    label: "الإيرادات",
    color: "hsl(var(--primary))",
  },
  expenses: {
    label: "المصاريف",
    color: "hsl(var(--secondary-foreground))",
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const { user } = useAuthContext();
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
      color: "bg-primary/10 text-primary",
    },
    {
      title: isRtl ? "المشاريع النشطة" : "Active Projects",
      value: "24",
      change: isRtl ? "+2 جديد" : "+2 new",
      trend: "up",
      icon: Briefcase,
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      title: isRtl ? "القوى العاملة" : "Workforce",
      value: "142",
      change: isRtl ? "98% في الموقع" : "98% on-site",
      trend: "neutral",
      icon: Users,
      color: "bg-purple-500/10 text-purple-500",
    },
    {
      title: isRtl ? "معدل الإنجاز" : "Completion Rate",
      value: "84%",
      change: isRtl ? "+5% سنوي" : "+5% yearly",
      trend: "up",
      icon: TrendingUp,
      color: "bg-green-500/10 text-green-500",
    },
  ]

  return (
    <div className="space-y-8" dir={dir}>
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline">{isRtl ? 'مرحباً بك،' : 'Welcome back,'} {user?.email?.split('@')[0]}</h1>
          <p className="text-muted-foreground mt-1">{isRtl ? `نظرة عامة على عمليات شركة ${company?.name || '...'}` : `Overview of ${company?.name || '...'} operations`}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex rounded-xl">
            <FileText className="me-2 h-4 w-4" />
            {isRtl ? `تصدير تقرير ${company?.name || ''}` : `Export Report`}
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl px-6">
            <Plus className="me-2 h-4 w-4" />
            {isRtl ? 'إجراء سريع' : 'Quick Action'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-0 shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl group overflow-hidden bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className={cn(
                  "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                  stat.trend === "up" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                )}>
                  {stat.trend === "up" ? <ArrowUpRight className="me-1 h-3 w-3" /> : null}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4 text-start">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
                <h3 className="text-3xl font-black font-headline mt-1 tracking-tight">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-0 shadow-lg rounded-2xl bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between px-8 py-6 border-b border-muted">
            <div className="text-start">
              <CardTitle className="text-xl font-bold font-headline">{isRtl ? 'الأداء المالي للشركة' : 'Financial Performance'}</CardTitle>
              <CardDescription>{isRtl ? 'تحليل الإيرادات مقابل المصاريف (6 أشهر)' : 'Revenue vs Expenses Analysis (6 months)'}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig}>
                <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 600 }}
                  />
                  <ChartTooltip 
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden">
          <CardHeader className="px-8 py-6 border-b border-muted text-start">
            <CardTitle className="text-xl font-bold font-headline">{isRtl ? 'نشاط العمليات' : 'Operational Activity'}</CardTitle>
            <CardDescription>{isRtl ? 'أحداث تشغيلية في الوقت الفعلي' : 'Real-time operational events'}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-muted">
              {[
                { title: isRtl ? "تسجيل زيارة ميدانية" : "Field Visit Recorded", detail: isRtl ? "مصفاة الزور - المرحلة الثانية" : "Al-Zour Refinery - Phase 2", time: isRtl ? "منذ 12 دقيقة" : "12m ago", icon: HardHat, color: "text-blue-500" },
                { title: isRtl ? "إنشاء دفعة الرواتب" : "Payroll Batch Created", detail: isRtl ? "يوليو 2024 (142 موظف)" : "July 2024 (142 Emps)", time: isRtl ? "منذ ساعتين" : "2h ago", icon: UserCircle, color: "text-purple-500" },
                { title: isRtl ? "تحليل عروض الأسعار" : "Quote Analysis", detail: isRtl ? "مناقصة حديد التسليح" : "Steel Rebar Tender", time: isRtl ? "منذ 4 ساعات" : "4h ago", icon: ShoppingCart, color: "text-primary" },
                { title: isRtl ? "ترحيل قيد محاسبي" : "Journal Posted", detail: isRtl ? "عقد #AX202 - القسط الأول" : "Contract #AX202 - P1", time: isRtl ? "منذ 5 ساعات" : "5h ago", icon: FileText, color: "text-green-500" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-6 hover:bg-muted/50 transition-colors">
                  <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-muted", activity.color)}>
                    <activity.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 text-start">
                    <p className="text-sm font-bold truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.detail}</p>
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-muted/20">
              <Button variant="ghost" className="w-full text-xs font-bold text-primary">
                {isRtl ? 'عرض سجل التدقيق الشامل' : 'View Full Audit Trail'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
