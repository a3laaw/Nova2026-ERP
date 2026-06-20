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
  Warehouse,
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
      <SidebarHeader className="flex-none p-4">
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-2">
            <span className="font-headline font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">SYSTEMS</span>
              <div className="h-[1.5px] w-8 bg-[#e87c24] rounded-full" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-9 w-9 rounded-xl bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-lg">
             <Sparkles className="h-5 w-5" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="flex-1 px-2 overflow-y-auto scrollbar-hide py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-3">
              {menuItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="flex-none p-3 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-3xl bg-white border border-orange-100 shadow-2xl ring-1 ring-black/[0.02] animate-in fade-in zoom-in-95 duration-500">
             <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kuwait Cloud</span>
                </div>
                <Badge className="bg-[#e87c24] text-white text-[8px] font-black uppercase h-4 px-1.5">v1.9</Badge>
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

  const activeCard = "bg-white border-2 border-orange-100 shadow-2xl text-[#1e1b4b] font-black"
  const inactiveCard = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] border-0 shadow-lg text-white font-black"

  // المظهر المشترك للبطاقة الفرعية العائمة
  const subCardBase = "flex items-center justify-between h-11 rounded-[1.2rem] px-4 transition-all text-[11px] font-black mb-1.5 backdrop-blur-md"
  
  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center mb-1">
        {item.subItems && item.subItems.length > 0 ? (
          <DropdownMenu open={isFlyoutOpen} onOpenChange={setIsFlyoutOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-[1.4rem] transition-all duration-300 outline-none hover:scale-105 shadow-md",
                  isActive ? activeCard : inactiveCard
                )}
              >
                <item.icon className={cn("h-6 w-6", isActive ? "text-[#e87c24]" : "text-white")} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isRtl ? "left" : "right"}
              sideOffset={8}
              align="start"
              dir={isRtl ? "rtl" : "ltr"}
              className="w-64 p-3 bg-orange-50/95 backdrop-blur-xl border-2 border-orange-200/50 shadow-3xl rounded-[2.5rem] z-[9999] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
            >
              <DropdownMenuLabel className="font-black text-[#1e1b4b] px-4 py-3 text-xs border-b border-orange-100 mb-4 uppercase tracking-widest text-start flex items-center justify-between">
                <span>{item.title}</span>
                <div className="p-2 rounded-xl bg-white shadow-sm text-orange-600">
                  <item.icon className="h-4 w-4" />
                </div>
              </DropdownMenuLabel>
              
              <div className="space-y-1">
                {item.subItems.map((sub: any) => {
                  const isSubActive = pathname === sub.url
                  return (
                    <DropdownMenuItem key={sub.title} asChild className="p-0 focus:bg-transparent bg-transparent">
                      <Link 
                        href={sub.url} 
                        className={cn(
                          subCardBase,
                          isSubActive 
                            ? "bg-white text-[#e87c24] shadow-lg scale-[1.02]" 
                            : "bg-white/40 text-[#1e1b4b] border border-white/40 hover:bg-white/60"
                        )}
                      >
                        <span className="flex-1 text-start">{sub.title}</span>
                        <sub.icon className={cn("h-3.5 w-3.5 ml-3 transition-all", isSubActive ? "text-[#e87c24] opacity-100" : "opacity-30")} />
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
                    "flex h-12 w-12 items-center justify-center rounded-[1.4rem] transition-all duration-300 hover:scale-105 shadow-md",
                    isActive ? activeCard : inactiveCard
                  )}
                >
                  <item.icon className={cn("h-6 w-6", isActive ? "text-[#e87c24]" : "text-white")} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side={isRtl ? "left" : "right"} sideOffset={8} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg px-3 py-1.5 shadow-2xl border-0 z-[9999]">
                {item.title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem className="px-1">
      {item.subItems && item.subItems.length > 0 ? (
        <Collapsible defaultOpen={isActive} className="group/collapsible">
          <div className={cn(
            "rounded-[1.8rem] transition-all duration-300 overflow-hidden",
            isActive ? activeCard : inactiveCard
          )}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full h-12 px-5 hover:bg-white/10 transition-colors">
                <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
                  <span className="flex-1 text-start text-sm font-black truncate">{item.title}</span>
                </div>
                <ChevronLeft className={cn(
                  "h-3.5 w-3.5 transition-transform opacity-40", 
                  isRtl ? "group-data-[state=open]/collapsible:-rotate-90" : "group-data-[state=open]/collapsible:rotate-90"
                )} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mx-3 mb-4 mt-2 space-y-1 animate-in slide-in-from-top-2 duration-300">
                {item.subItems.map((sub: any) => {
                  const isSubActive = pathname === sub.url
                  return (
                    <Link 
                      key={sub.title} 
                      href={sub.url}
                      className={cn(
                        subCardBase,
                        isActive 
                          ? (isSubActive ? "bg-white text-[#e87c24] shadow-lg scale-[1.02]" : "bg-amber-50/15 text-white/80 hover:bg-white/20 hover:text-white border border-white/5")
                          : (isSubActive ? "bg-white/90 text-[#e87c24] shadow-lg" : "bg-white/20 text-white/90 hover:bg-white/30 hover:text-white border border-white/10")
                      )}
                    >
                      <span className="truncate text-start">{sub.title}</span>
                      <sub.icon className={cn("h-3.5 w-3.5 ml-2 transition-all", isSubActive ? "opacity-100" : "opacity-30")} />
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
            "flex items-center gap-3 transition-all duration-300 rounded-[1.8rem] h-12 px-5",
            isActive ? activeCard : inactiveCard
          )}
        >
          <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
            <span className="flex-1 text-start text-sm font-black truncate">{item.title}</span>
          </div>
        </Link>
      )}
    </SidebarMenuItem>
  )
}
