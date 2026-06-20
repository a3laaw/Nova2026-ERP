
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
    <Sidebar collapsible="icon" className="border-e-0 bg-transparent shadow-none" side={isRtl ? 'right' : 'left'}>
      <SidebarHeader className="p-8 mb-4">
        {!isCollapsed && (
          <div className="flex flex-col text-start animate-in fade-in slide-in-from-top-4 duration-700">
            <span className="font-headline font-black text-4xl text-[#1e1b4b] leading-tight tracking-tighter">NovaFlow</span>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-8 bg-gradient-to-r from-[#FFB000] to-[#e87c24]" />
              <span className="text-[9px] uppercase font-black tracking-[0.3em] text-[#e87c24]">SYSTEMS</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-xl rotate-3">
             <Sparkles className="h-6 w-6" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-6 scrollbar-hide">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[#1e1b4b]/40 font-black px-4 mb-4 text-start uppercase text-[10px] tracking-[0.2em]">
              {isRtl ? 'إدارة العمليات' : 'Operation Hub'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-5">
              {menuItems.map((item) => (
                <SidebarCardRenderer 
                  key={item.title} 
                  item={item} 
                  isCollapsed={isCollapsed} 
                  isRtl={isRtl} 
                  pathname={pathname}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-12 mb-10">
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[#1e1b4b]/40 font-black px-4 mb-4 text-start uppercase text-[10px] tracking-[0.2em] border-t border-orange-100/30 pt-8">
              {isRtl ? 'التهيئة والإعدادات' : 'System Config'}
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="gap-5">
            {settingsItems.map((item) => (
              <SidebarCardRenderer 
                key={item.title} 
                item={item} 
                isCollapsed={isCollapsed} 
                isRtl={isRtl} 
                pathname={pathname}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      
      {!isCollapsed && (
        <SidebarFooter className="p-10 text-center">
          <div className="p-6 rounded-[2rem] bg-white/40 backdrop-blur-md border border-white/60 shadow-lg group hover:bg-white/60 transition-all cursor-pointer">
             <div className="flex items-center justify-between mb-2">
                <Badge className="bg-[#e87c24] text-white text-[8px] font-black uppercase">Enterprise</Badge>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
             </div>
             <p className="text-[10px] font-bold text-[#1e1b4b]/60 text-start leading-tight">All systems operational in your Kuwait Cloud.</p>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}

function SidebarCardRenderer({ item, isCollapsed, isRtl, pathname }: any) {
  const [isOpen, setIsOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const isActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url));

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isCollapsed) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  // بطاقة غير نشطة: زجاجية ملونة برتقالي ذهبي
  const inactiveCard = "bg-gradient-to-br from-[#FFB000]/90 to-[#e87c24]/90 backdrop-blur-lg border border-white/20 shadow-xl shadow-orange-500/10 text-white hover:scale-[1.02] hover:shadow-orange-500/20";
  
  // بطاقة نشطة: زجاجية بيضاء فاتحة بارزة
  const activeCard = "bg-white/95 backdrop-blur-xl border border-orange-100 shadow-2xl shadow-orange-500/10 scale-[1.03] text-[#1e1b4b] font-black";

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {item.subItems ? (
                <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-[1.5rem] transition-all duration-500 outline-none",
                        isActive ? activeCard : inactiveCard
                      )}
                    >
                      <item.icon className={cn("h-7 w-7 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side={isRtl ? "left" : "right"}
                    sideOffset={20}
                    align="start"
                    dir={isRtl ? "rtl" : "ltr"}
                    className="w-72 p-2 bg-white/95 backdrop-blur-2xl border-2 border-orange-100 shadow-3xl rounded-[2.5rem] z-[9999]"
                  >
                    <DropdownMenuLabel className="font-black text-[#1e1b4b] px-6 py-5 text-sm border-b-2 border-orange-50 mb-2 uppercase tracking-widest text-start flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                        <item.icon className="h-4 w-4" />
                      </div>
                      {item.title}
                    </DropdownMenuLabel>
                    {item.subItems.map((sub: any) => {
                      const isSubActive = pathname === sub.url;
                      return (
                        <DropdownMenuItem key={sub.title} asChild className="rounded-2xl py-4 px-5 focus:bg-orange-50 cursor-pointer mb-1">
                          <Link href={sub.url} className="flex items-center justify-between w-full">
                            <span className={cn("font-black text-sm flex-1 text-start", isSubActive ? "text-[#e87c24]" : "text-[#1e1b4b]")}>{sub.title}</span>
                            <sub.icon className={cn("h-4 w-4 ml-4", isSubActive ? "text-[#e87c24]" : "text-slate-300")} />
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-[1.5rem] transition-all duration-500",
                    isActive ? activeCard : inactiveCard
                  )}
                >
                  <Link href={item.url}>
                    <item.icon className={cn("h-7 w-7 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
                  </Link>
                </SidebarMenuButton>
              )}
            </TooltipTrigger>
            {!item.subItems && (
              <TooltipContent side={isRtl ? "left" : "right"} sideOffset={12} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg border-0 px-3 py-1.5 z-[9999]">
                {item.title}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem className="px-1">
      {item.subItems ? (
        <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
          <div className={cn("rounded-[2rem] transition-all duration-500 overflow-hidden", isActive ? activeCard : inactiveCard)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="h-auto py-7 px-8 hover:bg-transparent">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-6">
                    <item.icon className={cn("h-7 w-7 shrink-0 transition-transform group-hover/collapsible:scale-110", isActive ? "text-[#e87c24]" : "text-white")} />
                    <span className="text-start text-base font-black truncate">{item.title}</span>
                  </div>
                  <ChevronLeft className={cn(
                    "h-4 w-4 transition-transform group-data-[state=open]/collapsible:-rotate-90 opacity-40", 
                    !isRtl && "rotate-180"
                  )} />
                </div>
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 space-y-2">
                {item.subItems.map((sub: any) => {
                  const isSubActive = pathname === sub.url;
                  return (
                    <Link 
                      key={sub.title} 
                      href={sub.url}
                      className={cn(
                        "flex items-center justify-between h-12 rounded-2xl px-6 transition-all",
                        isSubActive 
                          ? (isActive ? "bg-orange-50 text-[#e87c24] shadow-inner" : "bg-white text-[#e87c24] shadow-lg")
                          : (isActive ? "text-slate-500 hover:bg-orange-50/50" : "text-white/70 hover:bg-white/10")
                      )}
                    >
                      <span className="text-xs font-black truncate text-start">{sub.title}</span>
                      <sub.icon className={cn("h-4 w-4 ml-4 opacity-50", isSubActive && "opacity-100")} />
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
            "transition-all duration-500 rounded-[2rem] h-auto py-7 px-8",
            isActive ? activeCard : inactiveCard
          )}
        >
          <Link href={item.url} className="flex items-center gap-6">
            <item.icon className={cn("h-7 w-7 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-[#e87c24]" : "text-white")} />
            <span className="flex-1 text-start text-base font-black truncate">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}
