/**
 * @fileOverview القائمة الجانبية (Sidebar) الديناميكية المحدثة بمصطلحات عملية (Odoo Style).
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
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-transparent">
      <SidebarHeader className="p-4 pt-6">
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-2">
            <span className="font-headline font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">ENTERPRISE</span>
              <div className="h-[1.5px] w-8 bg-[#e87c24] rounded-full" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-[42px] w-[42px] rounded-[12px] bg-primary/5 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/10">
             <Sparkles className="h-5 w-5" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-4 overflow-y-auto scrollbar-hide">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className={cn("gap-4", isCollapsed && "gap-6")}>
              {visibleItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 mt-auto">
        {!isCollapsed && (
          <div className="p-3 rounded-2xl bg-white border border-orange-50 shadow-lg">
             <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Business Core</span>
                <Badge className="bg-[#e87c24] text-white text-[8px] font-black uppercase h-4 px-1.5 rounded-md">v2.5</Badge>
             </div>
             <p className="text-[8px] font-black text-[#1e1b4b]/60 text-center uppercase tracking-tighter">Odoo Style UI</p>
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
  const expandedStyle = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white shadow-lg hover:scale-[1.02] transition-all"

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link 
                href={item.url}
                className={cn(
                  "flex items-center justify-center transition-all duration-300",
                  "h-[42px] w-[42px] rounded-[12px]",
                  isActive 
                    ? "bg-[#FFF3E0] text-[#e87c24] shadow-sm ring-1 ring-[#e87c24]/10" 
                    : "text-slate-400 hover:bg-[#FFF3E0] hover:text-[#e87c24]"
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={2.5} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side={isRtl ? "left" : "right"} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg border-0 px-3 py-1.5 shadow-2xl">
              {item.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      {item.subItems ? (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className={cn("flex items-center transition-all duration-300 rounded-2xl w-full h-11 px-4", expandedStyle)}>
              <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1.5 px-1 animate-in slide-in-from-top-1 duration-200">
              {item.subItems.map((sub: any) => (
                <Link 
                  key={sub.title} 
                  href={sub.url}
                  className={cn(
                    "flex items-center justify-between h-9 rounded-xl px-4 transition-all text-[10px] font-black",
                    pathname === sub.url ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-md" : "bg-orange-50/50 text-[#1e1b4b] border border-orange-100/30"
                  )}
                >
                  <span className="truncate text-start flex-1">{sub.title}</span>
                  <sub.icon className={cn("h-3 w-3 ml-2", pathname === sub.url ? "opacity-100" : "opacity-40")} />
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <Link 
          href={item.url} 
          className={cn(
            "flex items-center transition-all duration-300 rounded-2xl h-11 px-4", 
            isActive ? "bg-white text-[#e87c24] shadow-xl border-2 border-orange-50" : expandedStyle
          )}
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
