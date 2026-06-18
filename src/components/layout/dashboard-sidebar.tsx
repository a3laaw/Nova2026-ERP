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
    <Sidebar collapsible="icon" className="border-r-0 bg-transparent" side={lang === 'ar' ? 'right' : 'left'}>
      <div className="flex flex-col h-full m-4 rounded-[2rem] glass-card overflow-hidden">
        <SidebarHeader className="p-6 flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-solaris-gradient text-white shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          {state === "expanded" && (
            <div className={cn("flex flex-col text-start")}>
              <span className="font-headline font-black text-xl leading-none text-black">Solaris</span>
              <span className="text-[10px] uppercase tracking-widest text-black/50">Energy Portal</span>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-black/40 font-bold px-6 py-2 text-start">
              {lang === 'ar' ? 'التنقل' : 'Navigation'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-4 space-y-2">
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className={cn(
                        "transition-all duration-300 rounded-2xl group relative py-7 px-4",
                        pathname === item.url 
                          ? "bg-primary/10 text-primary font-black shadow-sm" 
                          : "text-black hover:bg-black/5"
                      )}
                    >
                      <Link href={item.url} className={cn("flex items-center gap-4")}>
                        <item.icon className={cn(
                          "h-5 w-5 transition-colors", 
                          pathname === item.url ? "text-primary" : "text-black/60 group-hover:text-black"
                        )} />
                        <span className={cn(
                          "flex-1 text-start",
                          pathname === item.url && "bg-solaris-gradient bg-clip-text text-transparent"
                        )}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-black/5 p-6">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t('settings')} className="text-black hover:bg-black/5 py-7 px-4 rounded-2xl">
                <Link href="/dashboard/settings" className={cn("flex items-center gap-4")}>
                  <Settings className="h-5 w-5 text-black/60" />
                  <span className="text-start">{t('settings')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}