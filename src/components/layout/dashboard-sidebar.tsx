/**
 * @fileOverview القائمة الجانبية (Sidebar) بتصميم الكبسولات البرتقالية المدمجة.
 * تم إصلاح خطأ الـ Unique Keys عبر استخدام الروابط كمعرفات.
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, HardHat, Calculator, UserCircle,
  ShoppingCart, Sparkles, Clock, ShieldCheck,
  Calendar, FileText, Package,
  Layers, FileSearch, Truck,
  Building2, ChevronLeft, Settings2, ChevronDown,
  Database, FileSpreadsheet, CalendarDays, Gavel,
  MapPinned, Hammer, MapPin, Landmark
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

  const menuItems = React.useMemo(() => {
    const hrAccess = check('hr', 'view');
    const isHrManager = hrAccess.can && hrAccess.scope !== 'own';

    return [
      { title: t('common.dashboard'), icon: LayoutDashboard, url: "/dashboard", resource: 'dashboard' },
      { 
        title: t('common.crm'), 
        icon: Users, 
        url: "/dashboard/crm", 
        resource: 'crm',
        subItems: [
          { title: t('common.leads'), url: "/dashboard/crm", icon: Users },
          { title: t('common.clients'), url: "/dashboard/clients", icon: UserCircle },
          { title: isRtl ? 'المواعيد والزيارات' : 'Appointments', url: "/dashboard/appointments", icon: CalendarDays },
          { title: isRtl ? 'حجز القاعات والاجتماعات' : 'Halls & Meetings', url: "/dashboard/meetings", icon: Landmark },
          { title: isRtl ? 'سجل تفاعل العملاء' : 'Visits Dossier', url: "/dashboard/projects/reports/client-visits", icon: MapPinned },
        ]
      },
      { 
        title: t('common.projects'), 
        icon: HardHat, 
        url: "/dashboard/projects", 
        resource: 'projects',
        subItems: [
          { title: t('dashboard.stats.activeProjects'), url: "/dashboard/projects", icon: Layers },
          { title: t('projects.boqExplorer'), url: "/dashboard/projects/boqs", icon: FileSpreadsheet },
          { title: t('common.reports'), url: "/dashboard/reports", icon: FileText },
        ]
      },
      { 
        title: t('common.construction'), 
        icon: Hammer, 
        url: "/dashboard/construction/bookings", 
        resource: 'projects',
        subItems: [
          { title: t('construction.radar'), url: "/dashboard/construction/bookings", icon: MapPin },
          { title: t('construction.groups'), url: "/dashboard/construction/groups", icon: Users },
          { title: t('construction.equipment'), url: "/dashboard/equipment", icon: Truck },
          { title: t('construction.reports'), url: "/dashboard/construction/field-visits", icon: FileText },
        ]
      },
      { 
        title: t('common.procurement'), 
        icon: ShoppingCart, 
        url: "/dashboard/procurement", 
        resource: 'procurement',
        subItems: [
          { title: isRtl ? 'الموردين' : 'Suppliers', url: "/dashboard/procurement/suppliers", icon: Truck },
          { title: isRtl ? 'العقود' : 'Contracts', url: "/dashboard/procurement/contracts", icon: Gavel },
          { title: isRtl ? 'تحليل العروض' : 'Quotes', url: "/dashboard/ai", icon: FileSearch },
        ]
      },
      { 
        title: isHrManager ? t('common.hr') : (isRtl ? 'شؤوني الوظيفية' : 'Personal Workspace'), 
        icon: UserCircle, 
        url: "/dashboard/hr", 
        resource: 'hr',
        subItems: [
          { title: isRtl ? 'ملفي الشخصي' : 'My Profile', url: globalUser?.employeeId ? `/dashboard/hr/reports/dossier/${globalUser.employeeId}` : '/dashboard/hr', icon: ShieldCheck },
          { title: t('hr.staff'), url: "/dashboard/hr/employees", icon: Users, hideIfOwnScope: true },
          { title: t('hr.leaves'), url: "/dashboard/hr/leaves", icon: Calendar },
          { title: t('hr.payroll'), url: "/dashboard/hr/payroll", icon: Calculator, requiredAction: 'approve', hideIfOwnScope: true },
        ]
      },
      { 
        title: t('common.accounting'), 
        icon: Calculator, 
        url: "/dashboard/accounting", 
        resource: 'accounting',
        subItems: [
          { title: isRtl ? 'المطابقة البنكية' : 'Reconciliation', url: "/dashboard/accounting", icon: Sparkles },
        ]
      },
      { 
        title: t('common.inventory'), 
        icon: Package, 
        url: "/dashboard/inventory", 
        resource: 'inventory',
        subItems: [
          { title: isRtl ? 'المخازن' : 'Warehouses', url: "/dashboard/inventory", icon: Building2 },
        ]
      },
      { 
        title: t('common.settings'), 
        icon: Settings2, 
        url: "/dashboard/settings", 
        resource: 'settings',
        subItems: [
          { title: isRtl ? 'المستخدمين' : 'Users', url: "/dashboard/settings/users", icon: Users },
          { title: isRtl ? 'هوية الشركة' : 'Identity', url: "/dashboard/settings/company", icon: Building2 },
          { title: isRtl ? 'الدستور التشغيلي' : 'Lists', url: "/dashboard/settings/checklists", icon: Database },
          { title: isRtl ? 'صلاحيات الأدوار' : 'Roles', url: "/dashboard/settings/roles", icon: ShieldCheck },
          { title: isRtl ? 'مواعيد العمل' : 'Work Hours', url: "/dashboard/settings/work-hours", icon: Clock },
          { title: isRtl ? 'الملف الشخصي' : 'Profile', url: "/dashboard/settings/profile", icon: UserCircle },
        ]
      }
    ];
  }, [t, isRtl, globalUser, check]);

  const visibleItems = React.useMemo(() => {
    const finalItems: any[] = [];
    menuItems.forEach(item => {
      if (!canAccess(item.resource)) return;
      if (item.subItems) {
        const filteredSubs = item.subItems.filter(sub => {
          const action = (sub as any).requiredAction || 'view';
          const access = check(item.resource, action);
          if (!access.can) return false;
          if ((sub as any).hideIfOwnScope && access.scope === 'own') return false;
          return true;
        });
        if (filteredSubs.length > 0) {
          finalItems.push({ ...item, subItems: filteredSubs });
        } else if (item.url === "/dashboard") {
          finalItems.push(item);
        }
      } else {
        finalItems.push(item);
      }
    });
    return finalItems;
  }, [menuItems, canAccess, check]);

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-[#F8F9FA]">
      <SidebarHeader className="p-4 pt-6">
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-2 border-b-2 border-orange-50 pb-4">
            <span className="font-headline font-black text-2xl text-slate-900 tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">ENTERPRISE</span>
              <div className="h-[1.5px] w-8 bg-[#e87c24] rounded-full" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-9 w-9 rounded-lg bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-sm transition-all">
             <Sparkles className="h-4 w-4" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4 overflow-y-auto scrollbar-hide">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-4">
              {visibleItems.map((item) => (
                <NavItemRenderer key={item.url} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-3xl bg-white border border-orange-100 shadow-xl ring-1 ring-black/[0.02] flex justify-between items-center">
             <Badge className="bg-[#e87c24] text-white text-[8px] font-black uppercase h-5 px-2 rounded-full">V2.5</Badge>
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">KUWAIT CLOUD</span>
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
  const commonStyle = "flex items-center w-full h-11 px-5 transition-all duration-300 rounded-full shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] border-0"
  
  const expandedStyle = cn(
    commonStyle,
    isActive 
      ? "bg-white text-[#e87c24] border-2 border-orange-100 shadow-orange-500/10 font-black" 
      : "bg-gradient-to-r from-[#FFB000] to-[#e87c24] text-white"
  )

  if (isCollapsed) {
    const collapsedStyle = cn(
      "flex h-9 w-9 items-center justify-center transition-all duration-300 rounded-lg shadow-sm",
      isActive 
        ? "bg-white text-[#e87c24] border-2 border-orange-100 scale-110 z-10" 
        : "bg-[#FFA000] text-white hover:scale-105"
    )
    return (
      <SidebarMenuItem className="flex justify-center">
        {item.subItems ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative group">
                  <button className={collapsedStyle}>
                    <item.icon className="h-4 w-4" />
                  </button>
                  <div className={cn(
                    "absolute top-0 z-[999] hidden group-hover:block animate-in fade-in zoom-in-95 duration-200",
                    isRtl ? "right-full mr-3" : "left-full ml-3"
                  )}>
                    <div className="bg-white border-2 border-slate-100 shadow-3xl rounded-[1.5rem] min-w-[220px] overflow-hidden ring-4 ring-black/[0.02]">
                      <div className="px-5 py-4 bg-slate-50 border-b flex items-center justify-between">
                        <p className="text-sm font-black text-slate-800 uppercase tracking-widest">{item.title}</p>
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <item.icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                      </div>
                      <div className="p-3 space-y-1.5 bg-white max-h-[60vh] overflow-y-auto scrollbar-hide">
                        {item.subItems.map((sub: any) => (
                          <Link 
                            key={sub.url} 
                            href={sub.url}
                            className={cn(
                              "flex items-center justify-between h-11 px-4 rounded-xl text-[11px] font-black transition-all shadow-sm border border-slate-100 bg-white group/sub",
                              pathname === sub.url 
                                ? "bg-primary text-white border-primary shadow-primary/20" 
                                : "text-slate-700 hover:bg-primary/5 hover:text-primary hover:border-primary/20 hover:-translate-y-0.5"
                            )}
                          >
                            <span className="truncate">{sub.title}</span>
                            <sub.icon className={cn("h-3.5 w-3.5 transition-all", pathname === sub.url ? "text-white" : "opacity-30 group-hover/sub:opacity-100 group-hover/sub:scale-110")} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side={isRtl ? "left" : "right"} className="bg-white text-slate-900 font-black text-[10px] rounded-lg border-2 shadow-2xl py-2 px-4">
                {item.title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={item.url} className={collapsedStyle}>
                  <item.icon className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side={isRtl ? "left" : "right"} className="bg-white text-slate-900 font-black text-[10px] rounded-lg border-2 shadow-2xl py-2 px-4">
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
      {item.subItems ? (
        <Collapsible open={isExpanded || isActive} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className={cn(expandedStyle)}>
              <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row-reverse" : "flex-row")}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isExpanded && "rotate-180")} />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-3 px-1 animate-in slide-in-from-top-2 duration-300">
              {item.subItems.map((sub: any) => (
                <Link 
                  key={sub.url} 
                  href={sub.url}
                  className={cn(
                    "flex items-center justify-between h-11 px-5 transition-all duration-300 text-[11px] font-black rounded-2xl border border-orange-100/30 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
                    pathname === sub.url 
                      ? "bg-white text-[#e87c24] border-primary/40 shadow-primary/5 ring-1 ring-primary/5" 
                      : "bg-white text-slate-700 hover:bg-gradient-to-r hover:from-[#FFF3E0] hover:to-[#FFFDE7] hover:text-[#e87c24]"
                  )}
                >
                  <span className="truncate text-start flex-1">{sub.title}</span>
                  <sub.icon className={cn("h-3.5 w-3.5 ml-2 transition-all", pathname === sub.url ? "opacity-100 text-[#e87c24] scale-110" : "opacity-30")} />
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <Link href={item.url} className={cn(expandedStyle)}>
          <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row-reverse" : "flex-row")}>
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
          </div>
        </Link>
      )}
    </SidebarMenuItem>
  )
}
