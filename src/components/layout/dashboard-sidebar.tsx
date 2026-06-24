/**
 * @fileOverview السايدبار السيادي لـ NovaFlow ERP (المستعاد).
 * يتميز بتصميم الكبسولات البرتقالية المتدرجة كما في رؤية المستخدم الأصلية.
 * يدعم القوائم المتشعبة (Sub-menus) في الوضعين الموسع والمصغر.
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, HardHat, Calculator, UserCircle,
  ShoppingCart, Sparkles, ShieldCheck,
  Calendar, FileText, Package,
  TrendingUp, BarChart3,
  Building2, Settings2, ChevronDown, ChevronRight,
  Clock, Briefcase, UserPlus, Search, Gavel, FileSpreadsheet,
  ListTree, Palette, UserCog, History, Scale, DollarSign,
  Landmark, Database, Plane, UserCheck, LayoutGrid
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
import { usePermissions } from "@/hooks/use-permissions"
import { useAuthContext } from "@/context/auth-context"
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarGroup,
  SidebarGroupContent, SidebarFooter, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { t, lang } = useLanguage()
  const { canAccess } = usePermissions()
  const isRtl = lang === 'ar'
  const isCollapsed = state === "collapsed"

  // تعريف هيكل القوائم المتشعب لضمان الوصول لكافة الموديولات
  const menuGroups = React.useMemo(() => [
    { 
      title: t('dashboard'), 
      icon: LayoutDashboard, 
      url: "/dashboard", 
      resource: 'dashboard' 
    },
    { 
      title: t('clients'), 
      icon: UserCircle, 
      url: "/dashboard/clients", 
      resource: 'crm',
      subItems: [
        { title: isRtl ? 'قاعدة العملاء' : 'All Clients', url: "/dashboard/clients", icon: Users },
        { title: isRtl ? 'تسجيل عميل جديد' : 'New Client', url: "/dashboard/clients/new", icon: UserPlus },
        { title: isRtl ? 'الفرص البيعية (CRM)' : 'Sales Leads', url: "/dashboard/crm", icon: TrendingUp },
      ]
    },
    { 
      title: t('projects'), 
      icon: HardHat, 
      url: "/dashboard/projects", 
      resource: 'projects',
      subItems: [
        { title: isRtl ? 'المشاريع النشطة' : 'Active Projects', url: "/dashboard/projects", icon: Briefcase },
        { title: isRtl ? 'مركز التقارير' : 'Reports Hub', url: "/dashboard/reports", icon: BarChart3 },
      ]
    },
    { 
      title: t('procurement'), 
      icon: ShoppingCart, 
      url: "/dashboard/procurement", 
      resource: 'procurement',
      subItems: [
        { title: isRtl ? 'لوحة المشتريات' : 'Procurement Overview', url: "/dashboard/procurement", icon: ShoppingCart },
        { title: isRtl ? 'سجل الموردين' : 'Suppliers', url: "/dashboard/procurement/suppliers", icon: Truck },
        { title: isRtl ? 'محلل عروض الأسعار' : 'Quote AI Analyzer', url: "/dashboard/procurement/quotes", icon: Sparkles },
      ]
    },
    { 
      title: t('hr'), 
      icon: Users, 
      url: "/dashboard/hr", 
      resource: 'hr',
      subItems: [
        { title: isRtl ? 'نظرة عامة' : 'HR Overview', url: "/dashboard/hr", icon: UserCircle },
        { title: isRtl ? 'سجل الموظفين' : 'Employees', url: "/dashboard/hr/employees", icon: Briefcase },
        { title: isRtl ? 'كشوف الرواتب' : 'Payroll', url: "/dashboard/hr/payroll", icon: Calculator },
        { title: isRtl ? 'طلبات الإجازات' : 'Leaves', url: "/dashboard/hr/leaves", icon: Plane },
        { title: isRtl ? 'الاستئذانات' : 'Permissions', url: "/dashboard/hr/permissions", icon: Clock },
        { title: isRtl ? 'التوظيف' : 'Recruitment', url: "/dashboard/hr/recruitment", icon: UserCheck },
        { title: isRtl ? 'نهاية الخدمة' : 'Indemnity', url: "/dashboard/hr/gratuity-calculator", icon: Scale },
        { title: isRtl ? 'مركز التقارير' : 'HR Reports', url: "/dashboard/hr/reports", icon: FileText },
      ]
    },
    { 
      title: t('inventory'), 
      icon: Package, 
      url: "/dashboard/inventory", 
      resource: 'inventory',
      subItems: [
        { title: isRtl ? 'المخازن والعهد' : 'Stock & Assets', url: "/dashboard/inventory", icon: Package },
      ]
    },
    { 
      title: t('settings'), 
      icon: Settings2, 
      url: "/dashboard/settings", 
      resource: 'settings',
      subItems: [
        { title: isRtl ? 'إعدادات المنشأة' : 'Company Settings', url: "/dashboard/settings/company", icon: Building2 },
        { title: isRtl ? 'المستخدمين' : 'User Management', url: "/dashboard/settings/users", icon: Users },
        { title: isRtl ? 'القوائم المرجعية' : 'Technical Setup', url: "/dashboard/settings/checklists", icon: Database },
        { title: isRtl ? 'قوالب المستندات' : 'Template Library', url: "/dashboard/settings/templates", icon: FileSpreadsheet },
        { title: isRtl ? 'مواعيد العمل' : 'Work Schedules', url: "/dashboard/settings/work-hours", icon: Clock },
        { title: isRtl ? 'الصلاحيات' : 'Role Matrix', url: "/dashboard/settings/roles", icon: ShieldCheck },
        { title: isRtl ? 'الملف الشخصي' : 'My Profile', url: "/dashboard/settings/profile", icon: UserCog },
      ]
    }
  ], [t, isRtl]);

  const visibleGroups = React.useMemo(() => {
    return menuGroups.filter(group => canAccess(group.resource));
  }, [menuGroups, canAccess]);

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-[#fdfaf3]">
      <SidebarHeader className="p-6 pt-10">
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-4">
            <span className="font-headline font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">ENTERPRISE</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto h-[42px] w-[42px] rounded-xl bg-primary/5 flex items-center justify-center text-primary">
             <Sparkles className="h-5 w-5" />
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-6 py-6 overflow-y-auto scrollbar-hide">
        <SidebarMenu className="gap-2">
          {visibleGroups.map((group) => (
            <NavGroupRenderer 
              key={group.title} 
              group={group} 
              isCollapsed={isCollapsed} 
              isRtl={isRtl} 
              pathname={pathname} 
            />
          ))}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-6 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-[2rem] bg-slate-900 text-white shadow-xl text-center">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">v2.5 Professional</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

function NavGroupRenderer({ group, isCollapsed, isRtl, pathname }: any) {
  const router = useRouter();
  const isActive = pathname === group.url || (group.url !== '/dashboard' && pathname.startsWith(group.url));
  const hasSubItems = group.subItems && group.subItems.length > 0;

  // الحالة الموسعة: تصميم الكبسولة البرتقالية الكاملة كما في الصورة
  if (!isCollapsed) {
    if (!hasSubItems) {
      return (
        <SidebarMenuItem>
          <Link 
            href={group.url} 
            className={cn(
              "flex items-center transition-all duration-300 rounded-full h-11 px-6 group", 
              isActive 
                ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-xl shadow-orange-500/20 scale-[1.02]" 
                : "text-slate-500 hover:bg-white hover:text-primary"
            )}
          >
            <div className={cn("flex items-center gap-4 w-full", isRtl ? "flex-row-reverse" : "flex-row")}>
              <group.icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 3 : 2} />
              <span className="flex-1 text-start text-sm font-black tracking-tight">{group.title}</span>
            </div>
          </Link>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <div 
              className={cn(
                "flex items-center transition-all duration-300 rounded-full h-11 px-6 group cursor-pointer", 
                isActive 
                  ? "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white shadow-xl shadow-orange-500/20 scale-[1.02]" 
                  : "text-slate-500 hover:bg-white hover:text-primary"
              )}
            >
              <div className={cn("flex items-center gap-4 w-full", isRtl ? "flex-row-reverse" : "flex-row")}>
                <group.icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 3 : 2} />
                <span className="flex-1 text-start text-sm font-black tracking-tight">{group.title}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180", !isActive && "text-slate-300")} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="ms-8 mt-2 border-s-2 border-primary/20 ps-4 space-y-1">
              {group.subItems.map((sub: any) => (
                <SidebarMenuSubItem key={sub.title}>
                  <SidebarMenuSubButton asChild isActive={pathname === sub.url}>
                    <Link href={sub.url} className={cn(
                      "flex items-center gap-3 py-2 px-3 rounded-xl transition-all font-bold text-xs",
                      pathname === sub.url ? "text-primary bg-primary/5" : "text-slate-400 hover:text-primary hover:bg-white"
                    )}>
                      {sub.icon && <sub.icon className="h-3.5 w-3.5" />}
                      {sub.title}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  // الحالة المصغرة: أيقونات عائمة مع قائمة منسدلة (Dropdown)
  return (
    <SidebarMenuItem className="flex justify-center mb-4">
      {hasSubItems ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(
                "flex items-center justify-center transition-all duration-300",
                "h-[42px] w-[42px] rounded-xl outline-none",
                isActive 
                  ? "bg-[#FFF3E0] text-[#e87c24] shadow-sm ring-1 ring-[#e87c24]/20" 
                  : "text-slate-400 hover:bg-white hover:text-primary"
              )}
            >
              <group.icon className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side={isRtl ? "left" : "right"} 
            align="start" 
            className="w-56 rounded-xl border-0 shadow-2xl p-2 bg-white z-[999]"
          >
            <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {group.title}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-50" />
            {group.subItems.map((sub: any) => (
              <DropdownMenuItem 
                key={sub.title} 
                onClick={() => router.push(sub.url)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-1 last:mb-0",
                  pathname === sub.url 
                    ? "bg-[#FFFDE7] text-[#e87c24] font-black" 
                    : "text-slate-600 font-bold hover:bg-slate-50"
                )}
              >
                {sub.icon && <sub.icon className="h-4 w-4" />}
                <span className="text-xs">{sub.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link 
          href={group.url}
          className={cn(
            "flex items-center justify-center transition-all duration-300",
            "h-[42px] w-[42px] rounded-xl outline-none",
            isActive 
              ? "bg-[#FFF3E0] text-[#e87c24] shadow-sm ring-1 ring-[#e87c24]/20" 
              : "text-slate-400 hover:bg-white hover:text-primary"
          )}
        >
          <group.icon className="h-5 w-5" strokeWidth={2.5} />
        </Link>
      )}
    </SidebarMenuItem>
  );
}
