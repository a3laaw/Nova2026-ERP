/**
 * @fileOverview القائمة الجانبية (Sidebar) المستعادة بنظام الملاحة الأصلي المعتمد.
 * تم قفل التصميم الموسع واستعادة التراص الرأسي وإلغاء التكرار اللوني.
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, HardHat, Calculator, UserCircle,
  ShoppingCart, Sparkles, ShieldCheck,
  Calendar, FileText, Package,
  Layers, FileSearch, Truck,
  Building2, Settings2
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { t, lang } = useLanguage()
  const { canAccess } = usePermissions()
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
        { title: t('staffRecords'), url: "/dashboard/hr/employees", icon: Users },
        { title: t('leaves'), url: "/dashboard/hr/leaves", icon: Calendar },
        { title: t('payroll'), url: "/dashboard/hr/payroll", icon: Calculator },
      ]
    },
    { title: t('inventory'), icon: Package, url: "/dashboard/inventory", resource: 'inventory' },
    { 
      title: t('settings'), 
      icon: Settings2, 
      url: "/dashboard/settings", 
      resource: 'settings',
      subItems: [
        { title: t('users'), url: "/dashboard/settings/users", icon: Users },
        { title: t('companyIdentity'), url: "/dashboard/settings/company", icon: Building2 },
        { title: t('rolesRef'), url: "/dashboard/settings/roles", icon: ShieldCheck },
        { title: t('checklists'), url: "/dashboard/settings/checklists", icon: ShieldCheck },
      ]
    }
  ], [t, globalUser]);

  const visibleItems = React.useMemo(() => {
    return menuItems.filter(item => canAccess(item.resource));
  }, [menuItems, canAccess]);

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-white">
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
          <div className="mx-auto h-[42px] w-[42px] rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/10">
             <Sparkles className="h-5 w-5" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-4 overflow-y-auto scrollbar-hide">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-xl bg-slate-900 text-white shadow-xl">
             <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Business Core</span>
                <Badge className="bg-[#e87c24] text-white text-[8px] font-black h-4 px-1.5 rounded-md">v2.5</Badge>
             </div>
             <p className="text-[10px] font-bold text-slate-300">Enterprise Edition</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

function NavItemRenderer({ item, isCollapsed, isRtl, pathname }: any) {
  const isGroupActive = item.subItems?.some((sub: any) => pathname.startsWith(sub.url));
  const isSelfActive = pathname === item.url;
  const isActive = isSelfActive || isGroupActive;
  
  const [isExpanded, setIsExpanded] = React.useState(isActive);
  const activeStyle = "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-lg shadow-orange-500/20 font-black";

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(
                "flex items-center justify-center transition-all duration-300",
                "h-[42px] w-[42px] rounded-xl outline-none",
                isActive 
                  ? "bg-[#FFF3E0] text-[#e87c24] shadow-sm ring-1 ring-[#e87c24]/20" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-primary"
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </DropdownMenuTrigger>
          {item.subItems && (
            <DropdownMenuContent 
              side={isRtl ? "left" : "right"} 
              align="start" 
              className="z-[999] min-w-[200px] rounded-xl border border-primary/10 shadow-2xl p-2 bg-white"
            >
              <div className="px-3 py-2.5 mb-1 border-b border-slate-50">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.title}</p>
              </div>
              {item.subItems.map((sub: any) => (
                <DropdownMenuItem key={sub.title} asChild>
                  <Link 
                    href={sub.url}
                    className={cn(
                      "flex items-center justify-between h-10 rounded-lg px-4 transition-all text-xs font-black cursor-pointer mb-0.5",
                      pathname === sub.url 
                        ? "bg-[#FFFDE7] text-[#e87c24] shadow-sm" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">{sub.title}</span>
                    <sub.icon className={cn(
                      "h-4 w-4",
                      pathname === sub.url ? "opacity-100 text-[#e87c24]" : "opacity-40"
                    )} />
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem className="mb-0.5">
      {item.subItems ? (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className={cn(
              "flex items-center transition-all duration-300 rounded-xl w-full h-11 px-4", 
              isActive && !isSelfActive ? "bg-slate-50 text-slate-900" : (isSelfActive ? activeStyle : "text-slate-500 hover:bg-slate-50")
            )}>
              <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 space-y-0.5 px-1 animate-in slide-in-from-top-1 duration-200">
              {item.subItems.map((sub: any) => (
                <Link 
                  key={sub.title} 
                  href={sub.url}
                  className={cn(
                    "flex items-center justify-between h-9 rounded-xl px-4 transition-all text-[11px] font-black",
                    pathname === sub.url ? "bg-[#FFFDE7] text-[#e87c24] border border-primary/10" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className="truncate text-start flex-1">{sub.title}</span>
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <Link 
          href={item.url} 
          className={cn(
            "flex items-center transition-all duration-300 rounded-xl h-11 px-4", 
            isSelfActive ? activeStyle : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
          </div>
        </Link>
      )}
    </SidebarMenuItem>
  );
}