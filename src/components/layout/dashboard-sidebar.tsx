/**
 * @fileOverview القائمة الجانبية (Sidebar) بتصميم عائم (Floating Style) وحواف هندسية حادة.
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, HardHat, Calculator, UserCircle,
  ShoppingCart, Sparkles, Clock, ShieldCheck,
  Calendar, FileSpreadsheet, FileText, Package,
  Layers, FileSearch, Truck, Scale,
  Building2, Database, ChevronLeft, Settings2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
import { usePermissions } from "@/hooks/use-permissions"
import { useAuthContext } from "@/context/auth-context"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarGroup,
  SidebarGroupContent, SidebarFooter, SidebarMenu, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip, TooltipProvider, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip"

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { t, lang } = useLanguage()
  const { canAccess, check } = usePermissions()
  const { globalUser } = useAuthContext()
  const isRtl = lang === 'ar'
  const isCollapsed = state === "collapsed"

  const menuItems = React.useMemo(() => [
    { title: t('dashboard'), icon: LayoutDashboard, url: "/dashboard", resource: 'dashboard' },
    { 
      title: t('crm'), 
      icon: Users, 
      url: "/dashboard/crm", 
      resource: 'crm',
      subItems: [
        { title: t('leads'), url: "/dashboard/crm", icon: Users },
        { title: t('clients'), url: "/dashboard/clients", icon: UserCircle },
      ]
    },
    { 
      title: t('projects'), 
      icon: HardHat, 
      url: "/dashboard/projects", 
      resource: 'projects',
      subItems: [
        { title: t('activeProjects'), url: "/dashboard/projects", icon: Layers },
        { title: t('reports'), url: "/dashboard/reports", icon: FileText },
      ]
    },
    { 
      title: t('procurement'), 
      icon: ShoppingCart, 
      url: "/dashboard/procurement", 
      resource: 'procurement',
      subItems: [
        { title: t('suppliers'), url: "/dashboard/procurement/suppliers", icon: Truck },
        { title: t('quoteAnalysis'), url: "/dashboard/ai", icon: FileSearch },
      ]
    },
    { 
      title: t('hr'), 
      icon: UserCircle, 
      url: "/dashboard/hr", 
      resource: 'hr',
      subItems: [
        { 
          title: t('myProfile'), 
          url: globalUser?.employeeId ? `/dashboard/hr/reports/dossier/${globalUser.employeeId}` : '/dashboard/hr', 
          icon: ShieldCheck 
        },
        { 
          title: t('staffRecords'), 
          url: "/dashboard/hr/employees", 
          icon: Users,
          hideIfOwnScope: true 
        },
        { title: t('leaves'), url: "/dashboard/hr/leaves", icon: Calendar },
        { 
          title: t('payroll'), 
          url: "/dashboard/hr/payroll", 
          icon: Calculator,
          requiredAction: 'approve' as const
        },
      ]
    },
    { 
      title: t('accounting'), 
      icon: Calculator, 
      url: "/dashboard/accounting", 
      resource: 'accounting',
      subItems: [
        { title: t('reconciliation'), url: "/dashboard/accounting", icon: Sparkles },
      ]
    },
    { 
      title: t('inventory'), 
      icon: Package, 
      url: "/dashboard/inventory", 
      resource: 'inventory',
      subItems: [
        { title: t('warehouses'), url: "/dashboard/inventory", icon: Building2 },
      ]
    },
    { 
      title: t('settings'), 
      icon: Settings2, 
      url: "/dashboard/settings", 
      resource: 'settings',
      subItems: [
        { title: t('users'), url: "/dashboard/settings/users", icon: Users },
        { title: t('companyIdentity'), url: "/dashboard/settings/company", icon: Building2 },
        { title: t('rolesRef'), url: "/dashboard/settings/roles", icon: ShieldCheck },
      ]
    }
  ], [t, isRtl, globalUser]);

  const visibleItems = React.useMemo(() => {
    return menuItems.filter(item => {
      if (!canAccess(item.resource)) return false;
      if (item.subItems) {
        item.subItems = item.subItems.filter(sub => {
          const access = check(item.resource, (sub as any).requiredAction || 'view');
          if (!access.can) return false;
          if ((sub as any).hideIfOwnScope && access.scope === 'own') return false;
          return true;
        });
        if (item.subItems.length === 0 && item.resource !== 'dashboard') return false;
      }
      return true;
    });
  }, [menuItems, canAccess, check]);

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-[#F8F9FA]">
      <SidebarHeader className="p-4 pt-6">
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-2">
            <span className="font-headline font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">ENTERPRISE</span>
              <div className="h-[1.5px] w-8 bg-[#e87c24] rounded-none" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-12 w-9 rounded-none bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-xl transition-all">
             <Sparkles className="h-6 w-6" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4 overflow-y-auto scrollbar-hide">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-5">
              {visibleItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-none bg-white border border-orange-100 shadow-xl ring-1 ring-black/[0.02]">
             <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kuwait Cloud</span>
                <Badge className="bg-[#e87c24] text-white text-[8px] font-black uppercase h-4 px-2 rounded-none">v2.5</Badge>
             </div>
             <p className="text-[8px] font-black text-[#1e1b4b]/60 text-center uppercase tracking-tighter">Floating Architecture</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

function NavItemRenderer({ item, isCollapsed, isRtl, pathname }: any) {
  const isGroupActive = item.subItems?.some((sub: any) => pathname === sub.url)
  const isSelfActive = pathname === item.url
  const isActive = isSelfActive || isGroupActive
  
  const [isExpanded, setIsExpanded] = React.useState(isActive)

  // ستايل "الطفو" المطور: هوامش جانبية، ظلال، وتحريك عند الهوفر
  const floatingBase = "transition-all duration-300 rounded-none shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
  const expandedStyle = cn(
    "flex items-center w-full h-11 px-4",
    floatingBase,
    isActive 
      ? "bg-white text-[#e87c24] border-2 border-orange-100 shadow-orange-500/10" 
      : "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white border-0"
  )

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link 
                href={item.url}
                className={cn(
                  "flex h-12 w-9 items-center justify-center transition-all duration-300 rounded-none shadow-lg",
                  isActive 
                    ? "bg-white text-[#e87c24] border-2 border-orange-100 scale-110 z-10" 
                    : "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white hover:scale-105"
                )}
              >
                <item.icon className="h-6 w-6" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side={isRtl ? "left" : "right"} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-none border-0 shadow-2xl">
              {item.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem className="px-1">
      {item.subItems ? (
        <Collapsible open={isExpanded || isActive} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className={cn(expandedStyle)}>
              <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
                <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", isExpanded ? "rotate-90" : (isRtl ? "" : "rotate-180"))} />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-2 px-2 animate-in slide-in-from-top-2 duration-300">
              {item.subItems.map((sub: any) => (
                <Link 
                  key={sub.title} 
                  href={sub.url}
                  className={cn(
                    "flex items-center justify-between h-10 rounded-none px-4 transition-all text-[11px] font-black border-2 border-transparent",
                    pathname === sub.url 
                      ? "bg-white text-[#e87c24] shadow-lg border-orange-100 scale-[1.03] z-10" 
                      : "bg-white/40 text-slate-700 hover:bg-gradient-to-r hover:from-[#FFF3E0] hover:to-[#FFFDE7] hover:text-[#e87c24] hover:shadow-md hover:-translate-y-0.5"
                  )}
                >
                  <span className="truncate text-start flex-1">{sub.title}</span>
                  <sub.icon className={cn("h-3.5 w-3.5 ml-2", pathname === sub.url ? "opacity-100" : "opacity-40")} />
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <Link 
          href={item.url} 
          className={cn(expandedStyle)}
        >
          <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
          </div>
        </Link>
      )}
    </SidebarMenuItem>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
