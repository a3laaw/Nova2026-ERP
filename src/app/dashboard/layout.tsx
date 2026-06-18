'use client';

import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading } = useAuthContext();
  const { company, loading: companyLoading } = useCompanyContext();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/'); // Redirect to login/home
    }
  }, [user, authLoading, router]);

  if (authLoading || companyLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <DashboardSidebar />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
            <SidebarTrigger className="-mr-1" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                {company?.name || 'مساحة العمل'} / لوحة التحكم
              </h2>
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
