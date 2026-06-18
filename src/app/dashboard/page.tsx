
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  CheckCircle2,
  FileText,
  Plus,
  HardHat,
  UserCircle,
  ShoppingCart
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  Cell,
  CartesianGrid
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const data = [
  { name: "Jan", revenue: 4500, expenses: 2400 },
  { name: "Feb", revenue: 5200, expenses: 2800 },
  { name: "Mar", revenue: 4800, expenses: 3200 },
  { name: "Apr", revenue: 6100, expenses: 2900 },
  { name: "May", revenue: 5900, expenses: 3500 },
  { name: "Jun", revenue: 7200, expenses: 4100 },
]

const stats = [
  {
    title: "Project Revenue",
    value: "$1.2M",
    change: "+12.5%",
    trend: "up",
    icon: DollarSign,
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Active Projects",
    value: "24",
    change: "+2 new",
    trend: "up",
    icon: Briefcase,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    title: "Workforce",
    value: "142",
    change: "98% onsite",
    trend: "neutral",
    icon: Users,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    title: "Avg. Completion",
    value: "84%",
    change: "+5% vs LY",
    trend: "up",
    icon: TrendingUp,
    color: "bg-green-500/10 text-green-500",
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline">Executive Overview</h1>
          <p className="text-muted-foreground mt-1">Operational intelligence for Nova Builders Kuwait</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex">
            <FileText className="mr-2 h-4 w-4" />
            Export Monthly Report
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl px-6">
            <Plus className="mr-2 h-4 w-4" />
            Quick Action
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-0 shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl group overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className={cn(
                  "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                  stat.trend === "up" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                )}>
                  {stat.trend === "up" ? <ArrowUpRight className="mr-1 h-3 w-3" /> : null}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{stat.title}</p>
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
            <div>
              <CardTitle className="text-xl font-bold font-headline">Financial Performance</CardTitle>
              <CardDescription>Revenue vs Expenses analysis (6 months)</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <div className="h-3 w-3 rounded-full bg-primary" />
                Revenue
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <div className="h-3 w-3 rounded-full bg-secondary-foreground" />
                Expenses
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
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
                  <Tooltip 
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="expenses" fill="hsl(var(--secondary-foreground))" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden">
          <CardHeader className="px-8 py-6 border-b border-muted">
            <CardTitle className="text-xl font-bold font-headline">Pipeline Activity</CardTitle>
            <CardDescription>Real-time operational events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-muted">
              {[
                { type: "visit", title: "Site Visit Logged", detail: "Al-Zour Refinery - Phase 2", time: "12m ago", icon: HardHat, color: "text-blue-500" },
                { type: "hr", title: "Payroll Batch Generated", detail: "July 2024 (142 employees)", time: "2h ago", icon: UserCircle, color: "text-purple-500" },
                { type: "purchasing", title: "RFQ Comparative Analysis", detail: "Steel reinforcement bids", time: "4h ago", icon: ShoppingCart, color: "text-primary" },
                { type: "accounting", title: "Journal Entry Posted", detail: "Contract #AX202 - Installment 1", time: "5h ago", icon: FileText, color: "text-green-500" },
                { type: "project", title: "Milestone Completed", detail: "Structural foundation - Project 4", time: "1d ago", icon: CheckCircle2, color: "text-emerald-500" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-6 hover:bg-muted/50 transition-colors">
                  <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-muted", activity.color)}>
                    <activity.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
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
              <Button variant="ghost" className="w-full text-xs font-bold text-primary">View Comprehensive Audit Log</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold font-headline">New Site Visit</h4>
              <p className="text-xs text-muted-foreground">Log site progress & WBS updates</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-500">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold font-headline">Register Client</h4>
              <p className="text-xs text-muted-foreground">Convert lead to transaction pipeline</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-purple-500">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold font-headline">AI Financial Advisory</h4>
              <p className="text-xs text-muted-foreground">Generate cash flow projections</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
