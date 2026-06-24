'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ArrowRight,
  Plus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useAuthContext } from '@/context/auth-context';

type SidebarItem = {
  title: string;
  icon: React.ElementType;
  url: string;
  module?: string;
  permission?: string;
  subItems?: {
    title: string;
    url: string;
    icon: React.ElementType;
  }[];
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { t, lang } = useLanguage();
  const { canAccess, isAdmin } = usePermissions();
  const { globalUser } = useAuthContext();

  const isRtl = lang === 'ar';
  const isCollapsed = state === 'collapsed';

  const menuItems: SidebarItem[] = [
    { title: t('dashboard'), icon: LayoutDashboard, url: '/dashboard', module: 'dashboard' },
    {
      title: t('crm'),
      icon: Users,
      url: '/dashboard/crm',
      module: 'crm',
      subItems: [
        { title: t('leads'), url: '/dashboard/crm', icon: Users },
        { title: t('clients'), url: '/dashboard/clients', icon: UserCircle },
      ],
    },
    {
      title: t('projects'),
      icon: HardHat,
      url: '/dashboard/projects',
      module: 'projects',
      subItems: [
        { title: t('activeProjects'), url: '/dashboard/projects', icon: Layers },
        { title: t('reports'), url: '/dashboard/reports', icon: FileText },
      ],
    },
    {
      title: t('procurement'),
      icon: ShoppingCart,
      url: '/dashboard/procurement',
      module: 'procurement',
      subItems: [
        { title: t('suppliers'), url: '/dashboard/procurement/suppliers', icon: Truck },
        { title: t('supplierQuotes'), url: '/dashboard/ai', icon: FileSearch },
        { title: t('purchaseOrders'), url: '/dashboard/procurement', icon: Package },
      ],
    },
    {
      title: t('hr'),
      icon: UserCircle,
      url: '/dashboard/hr',
      module: 'hr',
      subItems: [
        { title: t('employees'), url: '/dashboard/hr/employees', icon: Users },
        { title: t('leaves'), url: '/dashboard/hr/leaves', icon: Calendar },
        { title: t('permissions'), url: '/dashboard/hr/permissions', icon: Clock },
        { title: t('attendance'), url: '/dashboard/hr/attendance/import', icon: FileSpreadsheet },
        { title: t('payroll'), url: '/dashboard/hr/payroll', icon: Calculator },
        { title: t('gratuity'), url: '/dashboard/hr/gratuity', icon: Scale },
        { title: t('hrReports'), url: '/dashboard/hr/reports', icon: BarChart3 },
      ],
    },
    {
      title: t('accounting'),
      icon: Calculator,
      url: '/dashboard/accounting',
      module: 'accounting',
      subItems: [
        { title: t('smartReconciliation'), url: '/dashboard/accounting', icon: Sparkles },
        { title: t('chartOfAccounts'), url: '/dashboard/accounting', icon: BookOpen },
      ],
    },
    {
      title: t('inventory'),
      icon: Warehouse,
      url: '/dashboard/inventory',
      module: 'inventory',
      subItems: [
        { title: t('warehouses'), url: '/dashboard/inventory', icon: Warehouse },
        { title: t('fieldAssets'), url: '/dashboard/inventory', icon: HardHat },
      ],
    },
    { title: t('ai'), icon: Sparkles, url: '/dashboard/ai', module: 'dashboard' },
  ].filter((item) => !item.module || canAccess(item.module));

  const settingsItems: SidebarItem[] = [
    { title: t('companyIdentity'), url: '/dashboard/settings/company', icon: Building2, permission: 'admin' },
    { title: t('checklists'), url: '/dashboard/settings/checklists', icon: Database, permission: 'ref:view' },
    { title: t('rolesRef'), url: '/dashboard/settings/roles', icon: ShieldCheck, permission: 'admin' },
    { title: t('workHours'), url: '/dashboard/settings/work-hours', icon: Clock, permission: 'ref:view' },
    { title: t('profile'), url: '/dashboard/settings/profile', icon: UserCog, permission: 'public' },
  ].filter((item) => {
    if (item.permission === 'public') return true;
    if (item.permission === 'admin') return isAdmin;
    if (item.permission?.includes(':view')) {
      const mod = item.permission.split(':')[0];
      return canAccess(mod);
    }
    return isAdmin;
  });

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"} className="border-none bg-[#F8F9FA]">
      <SidebarHeader className={cn('p-4 pt-6 transition-all duration-300', isCollapsed ? 'p-2' : 'px-4 py-4')}>
        {!isCollapsed ? (
          <div className="flex flex-col text-start px-2">
            <span className="font-headline font-black text-2xl text-[#1e1b4b] tracking-tighter leading-none">NovaFlow</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] uppercase font-black tracking-[0.3em] text-[#e87c24]">ENTERPRISE</span>
              <div className="h-[1.5px] w-8 bg-[#e87c24] rounded-full" />
            </div>
          </div>
        ) : (
          <div className="mx-auto h-11 w-11 rounded-2xl bg-gradient-to-br from-[#FFB000] to-[#e87c24] flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="flex-1 px-1.5 scrollbar-hide bg-transparent">
        <SidebarGroup className="p-0">
          {!isCollapsed && (
            <SidebarGroupLabel className="mt-3 mb-2 px-2 text-start text-[9px] font-black uppercase tracking-widest text-[#1e1b4b]/40">
              {isRtl ? 'إدارة العمليات' : 'Operations'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {menuItems.map((item) => (
                <SidebarNavItem key={item.title} item={item} pathname={pathname} isCollapsed={isCollapsed} isRtl={isRtl} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4 p-0">
          {!isCollapsed && (
            <SidebarGroupLabel className="mb-2 border-t border-orange-100/30 px-2 pt-4 text-start text-[9px] font-black uppercase tracking-widest text-[#1e1b4b]/40">
              {isRtl ? 'الإعدادات' : 'Settings'}
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="gap-2">
            {settingsItems.map((item) => (
              <SidebarNavItem key={item.title} item={item} pathname={pathname} isCollapsed={isCollapsed} isRtl={isRtl} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn('p-4 mt-auto transition-all duration-300', isCollapsed ? 'p-2' : 'px-3 py-3')}>
        {!isCollapsed ? (
          <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-orange-100 bg-white p-3 shadow-xl ring-1 ring-black/[0.02]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Business Core</span>
              <Badge className="h-3.5 bg-[#e87c24] px-1.5 text-[8px] font-black uppercase text-white">v2.5</Badge>
            </div>
            <p className="text-center text-[9px] font-black uppercase tracking-tighter text-[#1e1b4b]/80">Odoo Style UI</p>
          </div>
        ) : (
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarNavItem({
  item,
  pathname,
  isCollapsed,
  isRtl,
}: {
  item: SidebarItem;
  pathname: string;
  isCollapsed: boolean;
  isRtl: boolean;
}) {
  const [isFlyoutOpen, setIsFlyoutOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);

  const isActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url));

  const expandedStyle = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white shadow-lg hover:scale-[1.02] transition-all rounded-full";
  
  // تصميم الكبسولات العمودية للحالة المصغرة بناءً على الصورة
  const collapsedActive = "bg-white text-[#e87c24] shadow-xl ring-1 ring-orange-100";
  const collapsedInactive = "bg-[#FFA000] text-white shadow-md";

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center mb-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {item.subItems ? (
                <DropdownMenu open={isFlyoutOpen} onOpenChange={setIsFlyoutOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex h-12 w-9 items-center justify-center rounded-full transition-all duration-300 outline-none",
                        isActive ? collapsedActive : collapsedInactive
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side={isRtl ? "left" : "right"}
                    sideOffset={14}
                    align="start"
                    className="z-[999] w-64 rounded-[1.5rem] border-2 border-orange-100 bg-white p-2 shadow-2xl"
                  >
                    <DropdownMenuLabel className="px-4 py-4 text-xs font-black text-[#1e1b4b] border-b mb-1 flex items-center gap-3">
                      <div className="p-2 bg-orange-50 rounded-xl text-orange-600"><item.icon className="h-4 w-4" /></div>
                      {item.title}
                    </DropdownMenuLabel>
                    {item.subItems.map((sub) => (
                      <DropdownMenuItem key={sub.title} asChild className="p-0 focus:bg-transparent">
                        <Link 
                          href={sub.url}
                          className={cn(
                            "flex items-center justify-between h-10 rounded-xl px-4 transition-all text-[11px] font-black w-full mb-1",
                            pathname === sub.url 
                              ? "bg-gradient-to-r from-[#FFF3E0] to-[#FFFDE7] text-[#e87c24] shadow-sm" 
                              : "text-[#1e1b4b] hover:bg-gradient-to-r hover:from-[#FFF3E0] hover:to-[#FFFDE7] hover:text-[#e87c24]"
                          )}
                        >
                          <span className="truncate">{sub.title}</span>
                          <sub.icon className={cn("h-3.5 w-3.5", pathname === sub.url ? "opacity-100" : "opacity-30")} />
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href={item.url}
                  className={cn(
                    "flex h-12 w-9 items-center justify-center rounded-full transition-all duration-300",
                    isActive ? collapsedActive : collapsedInactive
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                </Link>
              )}
            </TooltipTrigger>
            <TooltipContent side={isRtl ? "left" : "right"} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg">
              {item.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      {item.subItems ? (
        <Collapsible open={isExpanded || isActive} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className={cn("flex items-center transition-all duration-300 w-full h-11 px-4", expandedStyle)}>
              <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
                <ChevronLeft className={cn("h-4 w-4 transition-transform", (isExpanded || isActive) ? "rotate-90" : "rotate-0")} />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1 px-2 animate-in slide-in-from-top-1 duration-200">
              {item.subItems.map((sub: any) => (
                <Link 
                  key={sub.title} 
                  href={sub.url}
                  className={cn(
                    "flex items-center justify-between h-9 rounded-xl px-4 transition-all text-[10px] font-black",
                    pathname === sub.url 
                      ? "bg-white/20 text-white shadow-inner" 
                      : "text-white/70 hover:bg-gradient-to-r hover:from-[#FFF3E0] hover:to-[#FFFDE7] hover:text-[#e87c24]"
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
            "flex items-center transition-all duration-300 h-11 px-4", 
            isActive ? "bg-white text-[#e87c24] shadow-xl border-2 border-orange-50 rounded-full" : expandedStyle
          )}
        >
          <div className={cn("flex items-center gap-3 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#e87c24]" : "text-white")} />
            <span className="flex-1 text-start text-xs font-black tracking-tight">{item.title}</span>
          </div>
        </Link>
      )}
    </SidebarMenuItem>
  );
}
