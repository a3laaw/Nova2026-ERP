
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
  ShieldCheck
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
  const { t, lang, dir } = useLanguage()

  const menuItems = [
    { title: t('dashboard'), icon: LayoutDashboard, url: "/dashboard" },
    { title: t('crm'), icon: Users, url: "/dashboard/crm" },
    { title: t('projects'), icon: HardHat, url: "/dashboard/projects" },
    { title: t('accounting'), icon: Calculator, url: "/dashboard/accounting" },
    { title: t('hr'), icon: UserCircle, url: "/dashboard/hr" },
    { title: t('procurement'), icon: ShoppingCart, url: "/dashboard/procurement" },
    { title: t('inventory'), icon: Warehouse, url: "/dashboard/inventory" },
    { title: t('reports'), icon: BarChart3, url: "/dashboard/reports" },
    { title: t('ai'), icon: Sparkles, url: "/dashboard/ai" },
  ]

  const settingsItem = {
    title: t('settings'),
    icon: Settings,
    url: "/dashboard/settings",
    items: [
      { title: t('companyIdentity'), url: "/dashboard/settings/company", icon: Building2 },
      { title: t('checklists'), url: "/dashboard/settings/checklists", icon: Database },
      { title: t('rolesRef'), url: "/dashboard/settings/roles", icon: ShieldCheck },
      { title: t('workHours'), url: "/dashboard/settings/work-hours", icon: Clock },
      { title: t('profile'), url: "/dashboard/settings/profile", icon: UserCog },
    ]
  }

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
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-black/40 font-bold px-6 py-2 text-start">
            {lang === 'ar' ? 'النظام' : 'System'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-4">
              <Collapsible
                key={settingsItem.title}
                asChild
                defaultOpen={pathname.startsWith("/dashboard/settings")}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      tooltip={settingsItem.title}
                      className={cn(
                        "transition-all duration-200 rounded-xl py-6 px-4",
                        pathname.startsWith("/dashboard/settings") 
                          ? "bg-slate-100 text-black font-black" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <settingsItem.icon className="h-5 w-5 text-slate-400 group-hover:text-black" />
                      <span className="flex-1 text-start">{settingsItem.title}</span>
                      <ChevronRight className={cn(
                        "ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90",
                        lang === 'ar' && "rotate-180"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-0 border-s-2 border-slate-100 ms-6 mt-1 space-y-1">
                      {settingsItem.items.map((subItem) => (
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
      </SidebarContent>
      
      <SidebarFooter className="border-t p-6 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          NovaFlow v1.4.7
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
