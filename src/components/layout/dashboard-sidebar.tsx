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
  ClipboardList
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
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
  useSidebar,
} from "@/components/ui/sidebar"

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { t, lang, dir } = useLanguage()

  const menuItems = [
    { title: t('dashboard'), icon: LayoutDashboard, url: "/dashboard" },
    { title: t('crm'), icon: Users, url: "/dashboard/crm" },
    { title: t('projects'), icon: HardHat, url: "/dashboard/projects" },
    { title: t('accounting'), icon: Calculator, url: "/dashboard/accounting" },
    { title: t('hr'), icon: UserCircle, url: "/dashboard/hr" },
    { title: t('procurement'), icon: ShoppingCart, url: "/dashboard/procurement" },
    { title: t('inventory'), icon: Warehouse, url: "/dashboard/inventory" },
    { title: t('checklists'), icon: ClipboardList, url: "/dashboard/checklists" },
    { title: t('reports'), icon: BarChart3, url: "/dashboard/reports" },
    { title: t('ai'), icon: Sparkles, url: "/dashboard/ai" },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r-0 shadow-xl" side={lang === 'ar' ? 'right' : 'left'}>
      <SidebarHeader className="bg-sidebar p-4 flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
          <Sparkles className="h-6 w-6" />
        </div>
        {state === "expanded" && (
          <div className={cn("flex flex-col text-start")}>
            <span className="font-headline font-bold text-lg leading-tight text-white">NovaFlow</span>
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">ERP Ecosystem</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 font-semibold px-4 py-2 text-start">
            {lang === 'ar' ? 'التنقل' : 'Navigation'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200 hover:bg-sidebar-accent group relative py-6",
                      pathname === item.url ? "bg-primary/20 text-white font-semibold" : "text-sidebar-foreground"
                    )}
                  >
                    <Link href={item.url} className={cn("flex items-center gap-3")}>
                      <item.icon className={cn("h-5 w-5", pathname === item.url ? "text-primary" : "text-sidebar-foreground/70")} />
                      <span className="flex-1 text-start">{item.title}</span>
                      {pathname === item.url && (
                        <div className={cn("absolute top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-full", dir === 'rtl' ? 'right-0' : 'left-0')} />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('settings')} className="text-sidebar-foreground hover:bg-sidebar-accent py-6">
              <Link href="/dashboard/settings" className={cn("flex items-center gap-3")}>
                <Settings className="h-5 w-5 text-sidebar-foreground/70" />
                <span className="text-start">{t('settings')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
