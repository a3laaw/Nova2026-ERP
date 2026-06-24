/**
 * @fileOverview استعادة القائمة الجانبية الأصلية (The Sovereign Sidebar)
 * تم استعادة نمط الكبسولات البرتقالية المتراصة والخلفية الكريمية كما في الصورة المرفقة.
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
  Building2, Settings2, ChevronLeft
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
    { title: t('clients'), icon: UserCircle, url: "/dashboard/clients", resource: 'crm' },
    { title: t('projects'), icon: HardHat, url: "/dashboard/projects", resource: 'projects' },
    { title: t('procurement'), icon: ShoppingCart, url: "/dashboard/procurement", resource: 'procurement' },
    { title: t('hr'), icon: UserCircle, url: "/dashboard/hr", resource: 'hr' },
    { title: t('accounting'), icon: Calculator, url: "/dashboard/hr/payroll", resource: 'accounting' },
    { title: t('inventory'), icon: Package, url: "/dashboard/inventory", resource: 'inventory' },
    { title: t('settings'), icon: Settings2, url: "/dashboard/settings", resource: 'settings' }
  ], [t]);

  const visibleItems = React.useMemo(() => {
    return menuItems.filter(item => canAccess(item.resource));
  }, [menuItems, canAccess]);

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
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-4">
              {visibleItems.map((item) => (
                <NavItemRenderer key={item.title} item={item} isCollapsed={isCollapsed} isRtl={isRtl} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-6 mt-auto">
        {!isCollapsed && (
          <div className="p-4 rounded-[2rem] bg-slate-900 text-white shadow-xl">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">v2.5 Enterprise</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

function NavItemRenderer({ item, isCollapsed, isRtl, pathname }: any) {
  const isActive = pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url));
  const activeStyle = "sidebar-item-active shadow-xl shadow-orange-500/20";
  const inactiveStyle = "bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white opacity-90 hover:opacity-100 shadow-md";

  if (isCollapsed) {
    return (
      <SidebarMenuItem className="flex justify-center mb-4">
        <Link 
          href={item.url}
          className={cn(
            "flex items-center justify-center transition-all duration-300",
            "h-[42px] w-[42px] rounded-xl outline-none",
            isActive 
              ? "bg-[#FFF3E0] text-[#e87c24] shadow-sm ring-1 ring-[#e87c24]/20" 
              : "text-slate-400 hover:bg-white hover:text-primary"
          )}
        >
          <item.icon className="h-5 w-5" strokeWidth={2.5} />
        </Link>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Link 
        href={item.url} 
        className={cn(
          "flex items-center transition-all duration-300 rounded-full h-12 px-6 group", 
          isActive ? activeStyle : inactiveStyle
        )}
      >
        <div className={cn("flex items-center gap-4 w-full", isRtl ? "flex-row" : "flex-row-reverse")}>
          <item.icon className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          <span className="flex-1 text-start text-sm font-black tracking-tight">{item.title}</span>
        </div>
      </Link>
    </SidebarMenuItem>
  );
}