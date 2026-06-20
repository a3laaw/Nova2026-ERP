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
  Database
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
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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
    <Sidebar collapsible="icon" className="border-e-0 bg-white/40 backdrop-blur-xl shadow-none" side={isRtl ? 'right' : 'left'}>
      <SidebarHeader className="p-8 flex flex-row items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center shrink-0 rounded-[1.25rem] bg-gradient-to-br from-[#e87c24] to-[#FFB000] text-white shadow-xl shadow-orange-500/30 rotate-3">
          <Sparkles className="h-6 w-6" />
        </div>
        {!isCollapsed && (
          <div className={cn("flex flex-col text-start overflow-hidden")}>
            <span className="font-headline font-black text-2xl leading-none text-[#1e1b4b]">NovaFlow</span>
            <span className="text-[9px] uppercase font-black tracking-[0.2em] text-[#e87c24] mt-1 truncate">Enterprise ERP</span>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[#1e1b4b]/40 font-black px-4 py-6 text-start uppercase text-[10px] tracking-widest">
              {isRtl ? 'القائمة الرئيسية' : 'Main Menu'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-6">
              {menuItems.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    {item.subItems ? (
                      <Collapsible asChild className="group/collapsible" defaultOpen={isActive}>
                        <div>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={isActive}
                              tooltip={item.title}
                              className={cn(
                                "transition-all duration-300 rounded-[1.5rem] h-auto group",
                                isCollapsed ? "py-5 px-0 justify-center" : "py-8 px-6",
                                isActive 
                                  ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-xl shadow-orange-500/20 font-black" 
                                  : "text-[#1e1b4b] hover:bg-orange-50/50"
                              )}
                            >
                              <item.icon className={cn(
                                "h-6 w-6 shrink-0 transition-colors", 
                                isActive ? "text-white" : "text-[#e87c24]"
                              )} />
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 text-start text-base truncate font-bold">{item.title}</span>
                                  <ChevronRight className={cn(
                                    "ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90", 
                                    isRtl && "rotate-180"
                                  )} />
                                </>
                              )}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {!isCollapsed && (
                              <SidebarMenuSub className="ms-8 mt-3 border-s-2 border-orange-100/50 space-y-2">
                                {item.subItems.map(sub => (
                                  <SidebarMenuSubItem key={sub.title}>
                                    <SidebarMenuSubButton asChild isActive={pathname === sub.url} className="h-10 rounded-xl px-4">
                                      <Link href={sub.url} className={cn(
                                        "text-sm flex items-center gap-3 transition-colors",
                                        pathname === sub.url ? "text-[#e87c24] font-black" : "text-slate-500 hover:text-[#1e1b4b]"
                                      )}>
                                        <sub.icon className={cn(
                                          "h-4 w-4 shrink-0 transition-colors",
                                          pathname === sub.url ? "text-[#e87c24]" : "text-[#e87c24]/50"
                                        )} />
                                        <span className="truncate">{sub.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                        tooltip={item.title}
                        className={cn(
                          "transition-all duration-300 rounded-[1.5rem] h-auto",
                          isCollapsed ? "py-5 px-0 justify-center" : "py-8 px-6",
                          pathname === item.url 
                            ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-xl shadow-orange-500/20 font-black" 
                            : "text-[#1e1b4b] hover:bg-orange-50/50"
                        )}
                      >
                        <Link href={item.url} className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-6")}>
                          <item.icon className={cn(
                            "h-6 w-6 transition-colors shrink-0", 
                            pathname === item.url ? "text-white" : "text-[#e87c24]"
                          )} />
                          {!isCollapsed && <span className="flex-1 text-start text-base truncate font-bold">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-8 text-center bg-white/5 border-t border-orange-100/30">
        <div className="flex flex-col items-center gap-3">
           {!isCollapsed && (
             <Badge variant="outline" className="bg-white/50 text-[9px] font-black uppercase tracking-widest text-[#e87c24] border-[#e87c24]/20 px-3 py-1">
               Premium Edition
             </Badge>
           )}
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
             {isCollapsed ? "v1.9" : "NovaFlow v1.9.5"}
           </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
