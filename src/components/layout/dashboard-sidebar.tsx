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
  Settings,
  Building2,
  Database,
  UserCog,
  ChevronRight,
  Clock,
  ShieldCheck,
  Scale,
  Calendar,
  FileSpreadsheet,
  Briefcase,
  FileText,
  DollarSign,
  Package,
  Layers,
  FileSearch,
  BookOpen,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
import { usePermissions } from "@/hooks/use-permissions"
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
      title: t('procurement'), 
      icon: ShoppingCart, 
      url: "/dashboard/procurement", 
      module: 'procurement',
      subItems: [
        { title: t('supplierQuotes'), url: "/dashboard/ai", icon: FileSearch },
        { title: t('purchaseOrders'), url: "/dashboard/procurement", icon: Package },
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
    <Sidebar collapsible="icon" className="border-e bg-white shadow-sm" side={lang === 'ar' ? 'right' : 'left'}>
      <SidebarHeader className="p-6 flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
          <Sparkles className="h-6 w-6" />
        </div>
        {state === "expanded" && (
          <div className={cn("flex flex-col text-start")}>
            <span className="font-headline font-black text-xl leading-none text-black">NovaFlow</span>
            <span className="text-[10px] uppercase tracking-widest text-black/50">Enterprise ERP</span>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-black/40 font-bold px-6 py-2 text-start">
            {lang === 'ar' ? 'التنقل' : 'Navigation'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-4 space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.subItems ? (
                    <Collapsible asChild className="group/collapsible" defaultOpen={pathname.startsWith(item.url)}>
                      <div>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={pathname.startsWith(item.url)}
                            className={cn(
                              "transition-all duration-200 rounded-xl py-6 px-4",
                              pathname.startsWith(item.url) ? "bg-primary/10 text-primary font-black" : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="flex-1 text-start">{item.title}</span>
                            <ChevronRight className={cn("ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90", lang === 'ar' && "rotate-180")} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ms-6 mt-1 border-s-2 border-slate-100">
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={pathname === item.url}>
                                <Link href={item.url} className="text-xs font-bold">{lang === 'ar' ? 'نظرة عامة' : 'Overview'}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            {item.subItems.map(sub => (
                              <SidebarMenuSubItem key={sub.url}>
                                <SidebarMenuSubButton asChild isActive={pathname === sub.url}>
                                  <Link href={sub.url} className="text-xs flex items-center gap-2">
                                    <sub.icon className="h-3.5 w-3.5 opacity-70" />
                                    <span>{sub.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className={cn(
                        "transition-all duration-200 rounded-xl group py-6 px-4",
                        pathname === item.url 
                          ? "bg-primary/10 text-primary font-black shadow-sm" 
                          : "text-slate-600 hover:bg-slate-50 hover:text-black"
                      )}
                    >
                      <Link href={item.url} className={cn("flex items-center gap-4")}>
                        <item.icon className={cn(
                          "h-5 w-5 transition-colors", 
                          pathname === item.url ? "text-primary" : "text-slate-400 group-hover:text-black"
                        )} />
                        <span className="flex-1 text-start">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {settingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-black/40 font-bold px-6 py-2 text-start">
              {lang === 'ar' ? 'النظام' : 'System'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-4">
                <Collapsible
                  asChild
                  defaultOpen={pathname.startsWith("/dashboard/settings")}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        tooltip={t('settings')}
                        className={cn(
                          "transition-all duration-200 rounded-xl py-6 px-4",
                          pathname.startsWith("/dashboard/settings") 
                            ? "bg-slate-100 text-black font-black" 
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Settings className="h-5 w-5 text-slate-400 group-hover:text-black" />
                        <span className="flex-1 text-start">{t('settings')}</span>
                        <ChevronRight className={cn(
                          "ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90",
                          lang === 'ar' && "rotate-180"
                        )} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="mx-0 border-s-2 border-slate-100 ms-6 mt-1 space-y-1">
                        {settingsItems.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton 
                              asChild 
                              isActive={pathname === subItem.url}
                              className={cn(
                                "rounded-lg h-10 px-4 transition-all",
                                pathname === subItem.url 
                                  ? "text-primary font-bold bg-primary/5" 
                                  : "text-slate-500 hover:text-black hover:bg-slate-50"
                              )}
                            >
                              <Link href={subItem.url} className="flex items-center gap-3">
                                <subItem.icon className="h-3.5 w-3.5" />
                                <span className="text-xs">{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t p-6 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          NovaFlow v1.9.0
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
