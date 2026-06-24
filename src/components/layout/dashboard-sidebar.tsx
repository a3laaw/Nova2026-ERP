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

type SidebarItem = {
  title: string;
  icon: React.ElementType;
  url: string;
  module?: string;
  subItems?: {
    title: string;
    url: string;
    icon: React.ElementType;
  }[];
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { t, lang, dir } = useLanguage();
  const { canAccess, isAdmin } = usePermissions();

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
        { title: t('projectExecution'), url: '/dashboard/projects', icon: Layers },
        { title: t('reports'), url: '/dashboard/reports', icon: BarChart3 },
      ],
    },
    {
      title: t('procurement'),
      icon: ShoppingCart,
      url: '/dashboard/procurement',
      module: 'procurement',
      subItems: [
        { title: t('suppliers'), url: '/dashboard/procurement/suppliers', icon: Truck },
        { title: t('supplierQuotes'), url: '/dashboard/procurement/quotes', icon: FileSearch },
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
        { title: t('journalEntries'), url: '/dashboard/ai', icon: FileText },
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
    {
      title: t('reports'),
      icon: BarChart3,
      url: '/dashboard/reports',
      module: 'reports',
      subItems: [
        { title: t('operationalReports'), url: '/dashboard/reports', icon: TrendingUp },
        { title: t('financialReports'), url: '/dashboard/hr/reports/payroll', icon: DollarSign },
      ],
    },
    { title: t('ai'), icon: Sparkles, url: '/dashboard/ai', module: 'dashboard' },
  ].filter((item) => !item.module || canAccess(item.module));

  const settingsItems: SidebarItem[] = [
    { title: t('companyIdentity'), url: '/dashboard/settings/company', icon: Building2 },
    { title: t('checklists'), url: '/dashboard/settings/checklists', icon: Database },
    { title: t('rolesRef'), url: '/dashboard/settings/roles', icon: ShieldCheck },
    { title: t('workHours'), url: '/dashboard/settings/work-hours', icon: Clock },
    { title: t('profile'), url: '/dashboard/settings/profile', icon: UserCog },
  ].filter(() => isAdmin);

  return (
    <>
      <SidebarHeader
        className={cn(
          'shrink-0 grow-0 basis-auto items-center gap-0 transition-all duration-300 bg-[#fdfaf3]',
          isCollapsed ? 'p-3' : 'px-4 py-8'
        )}
      >
        {!isCollapsed ? (
          <div className="mx-auto flex w-full max-w-[220px] flex-col items-center text-center animate-in fade-in slide-in-from-top-2">
            <span className="font-headline text-3xl font-black leading-none tracking-tight text-[#1e1b4b]">
              NovaFlow
            </span>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[#e87c24]">
                SYSTEMS
              </span>
              <div className="h-[2px] w-8 rounded-full bg-[#e87c24]" />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white shadow-xl shadow-orange-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="flex-1 min-h-0 px-2.5 scrollbar-hide bg-[#fdfaf3]">
        <SidebarGroup className="p-0">
          {!isCollapsed && (
            <SidebarGroupLabel className="mt-4 mb-4 px-4 text-start text-[10px] font-black uppercase tracking-widest text-[#1e1b4b]/40">
              {isRtl ? 'إدارة العمليات' : 'Operations'}
            </SidebarGroupLabel>
          )}

          <SidebarGroupContent>
            <SidebarMenu className="gap-3">
              {menuItems.map((item) => (
                <SidebarNavItem
                  key={item.title}
                  item={item}
                  pathname={pathname}
                  isCollapsed={isCollapsed}
                  isRtl={isRtl}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8 mb-4 p-0">
          {!isCollapsed && (
            <SidebarGroupLabel className="mb-4 border-t border-orange-100/30 px-4 pt-6 text-start text-[10px] font-black uppercase tracking-widest text-[#1e1b4b]/40">
              {isRtl ? 'الإعدادات' : 'Settings'}
            </SidebarGroupLabel>
          )}

          <SidebarMenu className="gap-3">
            {settingsItems.map((item) => (
              <SidebarNavItem
                key={item.title}
                item={item}
                pathname={pathname}
                isCollapsed={isCollapsed}
                isRtl={isRtl}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn(
          'shrink-0 grow-0 basis-auto items-center gap-0 transition-all duration-300 bg-[#fdfaf3]',
          isCollapsed ? 'p-2' : 'px-4 py-6'
        )}
      >
        {!isCollapsed ? (
          <div className="mx-auto w-full max-w-[220px] rounded-[2rem] border-2 border-orange-100 bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Kuwait Cloud
                </span>
              </div>
              <Badge className="h-4 bg-[#e87c24] px-1.5 text-[8px] font-black uppercase text-white border-0">
                v1.9
              </Badge>
            </div>
            <p className="text-center text-[10px] font-black uppercase tracking-tighter text-[#1e1b4b]">
              ERP Intelligence
            </p>
          </div>
        ) : (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border-2 border-emerald-100 bg-emerald-50 text-emerald-600 shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
        )}
      </SidebarFooter>
    </>
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
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const isActive =
    pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url));

  // التصميم الكبسولي الموحد كما في الصورة
  const capsuleStyle = "bg-gradient-to-br from-[#FFB000] to-[#e87c24] text-white shadow-xl rounded-full";

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isCollapsed && item.subItems) setIsFlyoutOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(false);
    }, 150);
  };

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
                        'flex h-12 w-12 items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95',
                        capsuleStyle
                      )}
                    >
                      <item.icon className="h-6 w-6 shrink-0 text-white" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    side={isRtl ? 'left' : 'right'}
                    sideOffset={14}
                    align="start"
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className="z-[9999] w-64 rounded-[2rem] border-2 border-orange-100 bg-white p-2 shadow-2xl"
                  >
                    <DropdownMenuLabel className="mb-2 flex items-center gap-3 border-b border-orange-50 px-4 py-4 text-start text-xs font-black uppercase tracking-widest text-[#1e1b4b]">
                      <div className="rounded-xl bg-orange-50 p-2 text-orange-600">
                        <item.icon className="h-4 w-4" />
                      </div>
                      {item.title}
                    </DropdownMenuLabel>

                    {item.subItems.map((sub) => (
                      <DropdownMenuItem
                        key={sub.title}
                        asChild
                        className="group mb-1 cursor-pointer rounded-xl px-4 py-3 focus:bg-orange-50"
                      >
                        <Link href={sub.url} className="flex w-full items-center justify-between">
                          <span className={cn(
                            'flex-1 text-start text-[12px] font-black',
                            pathname === sub.url ? 'text-[#e87c24]' : 'text-[#1e1b4b]'
                          )}>
                            {sub.title}
                          </span>
                          <sub.icon className={cn(
                            'ml-3 h-4 w-4 opacity-30',
                            pathname === sub.url && 'text-[#e87c24] opacity-100'
                          )} />
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href={item.url}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center transition-all duration-300 hover:scale-105',
                    capsuleStyle
                  )}
                >
                  <item.icon className="h-6 w-6 shrink-0 text-white" />
                </Link>
              )}
            </TooltipTrigger>
            {!item.subItems && (
              <TooltipContent side={isRtl ? 'left' : 'right'} className="bg-[#1e1b4b] text-white font-black text-[10px] rounded-lg border-0 shadow-2xl">
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
      <div className={cn(
        'overflow-hidden transition-all duration-500',
        capsuleStyle,
        isExpanded && item.subItems ? 'rounded-[2.5rem]' : 'rounded-full'
      )}>
        <button
          className={cn(
            'flex h-14 w-full items-center gap-4 px-6 transition-colors hover:bg-white/10',
            isRtl ? 'flex-row-reverse' : 'flex-row'
          )}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <item.icon className="h-6 w-6 shrink-0 text-white" />
          <span className="flex-1 truncate text-start text-base font-black">
            {item.title}
          </span>
          {item.subItems && (
            <ChevronLeft className={cn(
              'h-4 w-4 shrink-0 text-white/60 transition-transform duration-300',
              isExpanded ? (isRtl ? 'rotate-90' : '-rotate-90') : (!isRtl ? 'rotate-180' : '')
            )} />
          )}
        </button>

        {isExpanded && item.subItems && (
          <div className="animate-in slide-in-from-top-2 space-y-2 px-4 pb-6 duration-300">
            {item.subItems.map((sub) => {
              const isSubActive = pathname === sub.url;
              return (
                <Link
                  key={sub.title}
                  href={sub.url}
                  className={cn(
                    'flex h-11 items-center justify-between rounded-full px-5 text-[13px] font-bold transition-all',
                    isSubActive ? 'bg-white/20 text-white shadow-inner scale-105' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span className="truncate text-start">{sub.title}</span>
                  <sub.icon className={cn('ml-3 h-4 w-4 opacity-50', isSubActive && 'opacity-100')} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </SidebarMenuItem>
  );
}
