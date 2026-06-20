
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
  ChevronRight,
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
  Search
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
import { usePermissions } from "@/hooks/use-permissions"
import { Badge } from "@/components/ui/badge"
import {
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
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
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
        { title: t('clients'), url: "/dashboard/crm?tab=clients", icon: UserCircle },
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
      title: t('inventory'), 
      icon: Warehouse, 
      url: "/dashboard/inventory", 
      module: 'inventory',
      subItems: [
        { title: t('warehouses'), url: "/dashboard/inventory", icon: Warehouse },
        { title: t('fieldAssets'), url: "/dashboard/inventory", icon: HardHat },
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
    { title: t('ai'), icon: Sparkles, url: "/dashboard/ai", module: 'dashboard' },
  ].filter(item => canAccess(item.module));

  const settingsItems = [
    { title: t('companyIdentity'), url: "/dashboard/settings/company", icon: Building2, permission: 'admin' },
    { title: t('checklists'), url: "/dashboard/settings/checklists", icon: Database, permission: 'ref:view' },
    { title: t('rolesRef'), url: "/dashboard/settings/roles", icon: ShieldCheck, permission: 'admin' },
    { title: t('workHours'), url: "/dashboard/settings/work-hours", icon: Clock, permission: 'ref:view' },
    { title: t('profile'), url: "/dashboard/settings/profile", icon: UserCog, permission: 'public' },
  ].filter(item => {
    if (item.permission === 'public') return true;
    if (item.permission === 'admin') return isAdmin;
    if (item.permission.includes(':view')) {
        const mod = item.permission.split(':')[0];
        return canAccess(mod);
    }
    return isAdmin;
  });

  return (
    <>
      <SidebarHeader className={cn("transition-all duration-300", isCollapsed ? "p-4" : "p-6")}>
        {!isCollapsed ? (
          <div className="flex flex-col text-start animate-in fade-in slide-in-from-top-2">
            <span className="font-headline font-black text-3xl text-[#1e1b4b] tracking-tighter">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] uppercase font-black tracking-[0.3em] text-[#e87c24]">SYSTEMS</span>
              <div className="h-0.5 w-8 bg-[#e87c24]" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-10 w-10 rounded-xl bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-lg">
             <Sparkles className="h-5 w-5" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4 scrollbar-hide">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[#1e1b4b]/40 font-black px-4 mb-4 text-start uppercase text-[9px] tracking-widest">
              {isRtl ? 'إدارة العمليات' : 'Operations'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {menuItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8 mb-4">
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[#1e1b4b]/40 font-black px-4 mb-4 text-start uppercase text-[9px] tracking-widest border-t border-orange-100/30 pt-6">
              {isRtl ? 'الإعدادات' : 'Settings'}
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="gap-2">
            {settingsItems.map((item) => (
              <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className={cn("transition-all duration-300", isCollapsed ? "p-2" : "p-6")}>
        {!isCollapsed ? (
          <div className="p-5 rounded-2xl bg-white border border-orange-100 shadow-xl">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cloud OK</span>
                </div>
                <Badge className="bg-[#e87c24] text-white text-[7px] font-black uppercase h-4 px-1.5">v1.9</Badge>
             </div>
             <p className="text-[9px] font-bold text-[#1e1b4b]/60 text-center">Enterprise Intelligence</p>
          </div>
        ) : (
          <div className="mx-auto h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
             <ShieldCheck className="h-4 w-4" />
          </div>
        )}
      </SidebarFooter>
    </>
  )
}

function NavItemRenderer({ item, isCollapsed, isRtl, pathname }: any) {
  const [isFlyoutOpen, setIsFlyoutOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const isActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url));

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isCollapsed && item.subItems) setIsFlyoutOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(false);
    }, 150);
  };

  // الأنماط المحسنة للأحجام
  const inactiveCard = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] border-0 shadow-lg text-white";
  const activeCard = "bg-white border-2 border-orange-100 shadow-xl text-[#1e1b4b] font-black";

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {item.subItems ? (
                <DropdownMenu open={isFlyoutOpen} onOpenChange={setIsFlyoutOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 outline-none",
                        isActive ? activeCard : inactiveCard
                      )}
                    >
                      <item.icon className={cn("h-6 w-6 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side={isRtl ? "left" : "right"}
                    sideOffset={15}
                    align="start"
                    dir={isRtl ? "rtl" : "ltr"}
                    className="w-64 p-2 bg-white/98 backdrop-blur-xl border-2 border-orange-100 shadow-2xl rounded-[2rem] z-[9999]"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <DropdownMenuLabel className="font-black text-[#1e1b4b] px-4 py-4 text-xs border-b border-orange-50 mb-2 uppercase tracking-widest text-start flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                        <item.icon className="h-4 w-4" />
                      </div>
                      {item.title}
                    </DropdownMenuLabel>
                    {item.subItems.map((sub: any) => (
                      <DropdownMenuItem key={sub.title} asChild className="rounded-xl py-3 px-4 focus:bg-orange-50 cursor-pointer mb-1">
                        <Link href={sub.url} className="flex items-center justify-between w-full">
                          <span className={cn("font-black text-xs flex-1 text-start", pathname === sub.url ? "text-[#e87c24]" : "text-[#1e1b4b]")}>{sub.title}</span>
                          <sub.icon className={cn("h-4 w-4 ml-3 opacity-40", pathname === sub.url && "text-[#e87c24] opacity-100")} />
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link 
                  href={item.url}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                    isActive ? activeCard : inactiveCard
                  )}
                >
                  <item.icon className={cn("h-6 w-6 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
                </Link>
              )}
            </TooltipTrigger>
            {!item.subItems && (
              <TooltipContent side={isRtl ? "left" : "right"} sideOffset={10} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg px-3 py-1.5 shadow-xl">
                {item.title}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      {item.subItems ? (
        <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
          <div className={cn("rounded-2xl transition-all duration-300 overflow-hidden", isActive ? activeCard : inactiveCard)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="h-14 px-5 hover:bg-transparent">
                <div className={cn("flex items-center justify-between w-full", isRtl ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn("flex items-center gap-4", isRtl ? "flex-row-reverse" : "flex-row")}>
                    <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
                    <span className="text-start text-sm font-black truncate">{item.title}</span>
                  </div>
                  <ChevronLeft className={cn(
                    "h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-60", 
                    !isRtl && "rotate-180"
                  )} />
                </div>
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-1">
                {item.subItems.map((sub: any) => {
                  const isSubActive = pathname === sub.url;
                  return (
                    <Link 
                      key={sub.title} 
                      href={sub.url}
                      className={cn(
                        "flex items-center justify-between h-10 rounded-xl px-4 transition-all text-xs font-bold",
                        isSubActive 
                          ? (isActive ? "bg-orange-50 text-[#e87c24] shadow-sm" : "bg-white/20 text-white shadow-inner")
                          : (isActive ? "text-slate-500 hover:bg-orange-50/50" : "text-white/70 hover:bg-white/10")
                      )}
                    >
                      <span className="truncate text-start">{sub.title}</span>
                      <sub.icon className={cn("h-3.5 w-3.5 ml-3 opacity-50", isSubActive && "opacity-100")} />
                    </Link>
                  )
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ) : (
        <SidebarMenuButton
          asChild
          className={cn(
            "transition-all duration-300 rounded-2xl h-14 px-5",
            isActive ? activeCard : inactiveCard
          )}
        >
          <Link href={item.url} className={cn("flex items-center gap-4", isRtl ? "flex-row-reverse" : "flex-row")}>
            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
            <span className="flex-1 text-start text-sm font-black truncate">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}
