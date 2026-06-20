"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  HardHat,
  Calculator,
  UserCircle,
  ShoppingCart,
  BarChart3,
  Sparkles,
  Clock,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Package,
  Layers,
  FileSearch,
  BookOpen,
  TrendingUp,
  Truck,
  Scale,
  Building2,
  UserCog,
  Database,
  ChevronLeft,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
import { usePermissions } from "@/hooks/use-permissions"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { t, lang } = useLanguage()
  const { canAccess, isAdmin } = usePermissions()
  const isRtl = lang === 'ar'
  const isCollapsed = state === "collapsed"

  const menuItems = [
    { title: t('dashboard'), icon: LayoutDashboard, url: "/dashboard", module: 'dashboard' },
    { 
      title: t('crm'), 
      icon: Users, 
      url: "/dashboard/crm", 
      module: 'crm',
      subItems: [
        { title: t('leads'), url: "/dashboard/crm", icon: Users },
        { title: t('clients'), url: "/dashboard/clients", icon: UserCircle },
      ]
    },
    { 
      title: t('projects'), 
      icon: HardHat, 
      url: "/dashboard/projects", 
      module: 'projects',
      subItems: [
        { title: t('projectExecution'), url: "/dashboard/projects", icon: Layers },
        { title: t('projectReports'), url: "/dashboard/reports", icon: FileText },
      ]
    },
    { 
      title: t('procurement'), 
      icon: ShoppingCart, 
      url: "/dashboard/procurement", 
      module: 'procurement',
      subItems: [
        { title: t('suppliers'), url: "/dashboard/procurement/suppliers", icon: Truck },
        { title: t('supplierQuotes'), url: "/dashboard/ai", icon: FileSearch },
        { title: t('purchaseOrders'), url: "/dashboard/procurement", icon: Package },
      ]
    },
    { 
      title: t('hr'), 
      icon: UserCircle, 
      url: "/dashboard/hr", 
      module: 'hr',
      subItems: [
        { title: t('employees'), url: "/dashboard/hr/employees", icon: Users },
        { title: t('leaves'), url: "/dashboard/hr/leaves", icon: Calendar },
        { title: t('permissions'), url: "/dashboard/hr/permissions", icon: Clock },
        { title: t('attendance'), url: "/dashboard/hr/attendance/import", icon: FileSpreadsheet },
        { title: t('payroll'), url: "/dashboard/hr/payroll", icon: Calculator },
        { title: t('gratuity'), url: "/dashboard/hr/gratuity", icon: Scale },
        { title: t('hrReports'), url: "/dashboard/hr/reports", icon: BarChart3 },
      ]
    },
    { 
      title: t('accounting'), 
      icon: Calculator, 
      url: "/dashboard/accounting", 
      module: 'accounting',
      subItems: [
        { title: t('smartReconciliation'), url: "/dashboard/accounting", icon: Sparkles },
        { title: t('journalEntries'), url: "/dashboard/ai", icon: FileText },
        { title: t('chartOfAccounts'), url: "/dashboard/accounting", icon: BookOpen },
      ]
    },
    { 
      title: t('reports'), 
      icon: BarChart3, 
      url: "/dashboard/reports", 
      module: 'reports',
      subItems: [
        { title: t('operationalReports'), url: "/dashboard/reports", icon: TrendingUp },
        { title: t('financialReports'), url: "/dashboard/hr/reports/payroll", icon: DollarSign },
      ]
    },
    { 
      title: t('settings'), 
      icon: Settings2, 
      url: "/dashboard/settings", 
      module: 'dashboard',
      subItems: [
        { title: t('companyIdentity'), url: "/dashboard/settings/company", icon: Building2, permission: 'admin' },
        { title: t('checklists'), url: "/dashboard/settings/checklists", icon: Database, permission: 'ref:view' },
        { title: t('rolesRef'), url: "/dashboard/settings/roles", icon: ShieldCheck, permission: 'admin' },
        { title: t('workHours'), url: "/dashboard/settings/work-hours", icon: Clock, permission: 'ref:view' },
        { title: t('profile'), url: "/dashboard/settings/profile", icon: UserCog, permission: 'public' },
      ].filter((sub: any) => {
        if (sub.permission === 'public') return true;
        if (sub.permission === 'admin') return isAdmin;
        return canAccess(sub.permission.split(':')[0]);
      })
    },
    { title: t('ai'), icon: Sparkles, url: "/dashboard/ai", module: 'dashboard' },
  ].filter(item => canAccess(item.module));

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-transparent">
      <SidebarHeader className="flex-none p-4 pt-6">
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-2">
            <span className="font-headline font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">SYSTEMS</span>
              <div className="h-[1.5px] w-8 bg-[#e87c24] rounded-full" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-10 w-10 rounded-[1.2rem] bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-lg">
             <Sparkles className="h-5 w-5" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="flex-1 px-3 overflow-y-auto scrollbar-hide py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-4">
              {menuItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="flex-none p-4 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-[2rem] bg-white border border-orange-100 shadow-2xl ring-1 ring-black/[0.02] animate-in fade-in zoom-in-95 duration-500">
             <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kuwait Cloud</span>
                </div>
                <Badge className="bg-[#e87c24] text-white text-[8px] font-black uppercase h-4 px-1.5 rounded-md">v1.9</Badge>
             </div>
             <p className="text-[9px] font-black text-[#1e1b4b]/80 text-center uppercase tracking-tighter">Enterprise Intelligence</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

function NavItemRenderer({ item, isCollapsed, isRtl, pathname }: any) {
  const [isFlyoutOpen, setIsFlyoutOpen] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const isActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url))

  const handlePointerEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (isCollapsed && item.subItems) {
      setIsFlyoutOpen(true)
    }
  }

  const handlePointerLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(false)
    }, 200)
  }

  // مظهر البطاقة الموحدة الكبيرة (للأقسام المفتوحة)
  const groupContainerActive = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] shadow-2xl shadow-orange-500/20 rounded-[2.2rem] p-1.5 pb-3 transition-all duration-500"
  
  // مظهر البطاقة الفردية (في حال عدم وجود عناصر فرعية أو طي السايدبار)
  const individualActive = "bg-white border-2 border-orange-100 shadow-xl text-[#1e1b4b] font-black rounded-[1.6rem]"
  const individualInactive = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] shadow-lg text-white font-black rounded-[1.6rem]"

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center">
        {item.subItems && item.subItems.length > 0 ? (
          <DropdownMenu open={isFlyoutOpen} onOpenChange={setIsFlyoutOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                className={cn(
                  "flex h-12 w-12 items-center justify-center transition-all duration-300 outline-none hover:scale-110 shadow-md rounded-[1.2rem]",
                  isActive ? "bg-white text-[#e87c24] border-2 border-orange-100" : "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white"
                )}
              >
                <item.icon className="h-6 w-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isRtl ? "left" : "right"}
              sideOffset={10}
              align="start"
              dir={isRtl ? "rtl" : "ltr"}
              className="w-64 p-3 bg-orange-50/95 backdrop-blur-xl border-2 border-orange-200/50 shadow-3xl rounded-[2.5rem] z-[9999] overflow-hidden"
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
            >
              <DropdownMenuLabel className="font-black text-[#1e1b4b] px-4 py-3 text-xs border-b border-orange-100 mb-4 uppercase tracking-widest text-start flex items-center justify-between">
                <span>{item.title}</span>
                <div className="p-2 rounded-xl bg-white shadow-sm text-orange-600">
                  <item.icon className="h-4 w-4" />
                </div>
              </DropdownMenuLabel>
              <div className="space-y-2">
                {item.subItems.map((sub: any) => {
                  const isSubActive = pathname === sub.url
                  return (
                    <DropdownMenuItem key={sub.title} asChild className="p-0 focus:bg-transparent">
                      <Link 
                        href={sub.url} 
                        className={cn(
                          "flex items-center justify-between h-12 rounded-[1.4rem] px-5 transition-all text-[11px] font-black",
                          isSubActive 
                            ? "bg-white text-[#e87c24] shadow-lg scale-[1.02]" 
                            : "bg-white/40 text-[#1e1b4b] hover:bg-white/60"
                        )}
                      >
                        <span className="flex-1 text-start">{sub.title}</span>
                        <sub.icon className={cn("h-4 w-4 ml-3 opacity-30", isSubActive && "text-[#e87c24] opacity-100")} />
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href={item.url}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center transition-all duration-300 hover:scale-110 shadow-md rounded-[1.2rem]",
                    isActive ? "bg-white text-[#e87c24] border-2 border-orange-100" : "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side={isRtl ? "left" : "right"} sideOffset={10} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg px-3 py-1.5">
                {item.title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      {item.subItems && item.subItems.length > 0 ? (
        <Collapsible defaultOpen={isActive} className="group/collapsible">
          <div className={cn(isActive ? groupContainerActive : "bg-transparent")}>
            <CollapsibleTrigger asChild>
              <button className={cn(
                "flex items-center justify-between w-full h-14 px-6 transition-all",
                isActive 
                  ? "text-white" 
                  : "individualInactive text-white hover:scale-[1.02]"
              )}>
                <div className={cn("flex items-center gap-4 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
                  <item.icon className="h-6 w-6 shrink-0" />
                  <span className="flex-1 text-start text-sm font-black tracking-tight">{item.title}</span>
                </div>
                <ChevronLeft className={cn(
                  "h-4 w-4 transition-transform opacity-60", 
                  isRtl ? "group-data-[state=open]/collapsible:-rotate-90" : "group-data-[state=open]/collapsible:rotate-90"
                )} />
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mx-2 mt-2 space-y-2 animate-in slide-in-from-top-2 duration-400">
                {item.subItems.map((sub: any) => {
                  const isSubActive = pathname === sub.url
                  return (
                    <Link 
                      key={sub.title} 
                      href={sub.url}
                      className={cn(
                        "flex items-center justify-between h-12 rounded-[1.5rem] px-6 transition-all text-[12px] font-black",
                        isSubActive 
                          ? "bg-white text-[#e87c24] shadow-xl scale-[1.03]" 
                          : "bg-white/15 text-white/90 hover:bg-white/25 border border-white/5"
                      )}
                    >
                      <span className="truncate text-start flex-1">{sub.title}</span>
                      <sub.icon className={cn("h-4 w-4 ml-3 transition-all", isSubActive ? "opacity-100" : "opacity-30")} />
                    </Link>
                  )
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ) : (
        <Link 
          href={item.url}
          className={cn(
            "flex items-center gap-4 transition-all duration-300 h-14 px-6 hover:scale-[1.02]",
            isActive ? individualActive : individualInactive
          )}
        >
          <div className={cn("flex items-center gap-4 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
            <item.icon className={cn("h-6 w-6 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
            <span className={cn("flex-1 text-start text-sm font-black tracking-tight", isActive ? "text-[#1e1b4b]" : "text-white")}>
               {item.title}
            </span>
          </div>
        </Link>
      )}
    </SidebarMenuItem>
  )
}
