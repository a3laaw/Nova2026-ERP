
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { NotificationBell } from "@/components/layout/notification-bell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardSidebar />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Workspace / Control Center</h2>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="h-6 w-[1px] bg-border" />
              <UserNav />
            </div>
          </header>
          <main className="flex-1 p-6 lg:p-10 animate-in fade-in duration-500">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
