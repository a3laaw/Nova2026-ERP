'use client';

import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { Loader2, Languages, ShieldAlert, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading, logout } = useAuthContext();
  const { company, loading: companyLoading } = useCompanyContext();
  const { lang, setLang, t, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || companyLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#fdfaf3]">
        <Loader2 className="h-10 w-10 animate-spin text-[#e87c24]" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#fdfaf3] overflow-x-hidden" dir={dir}>
        <DashboardSidebar />
        <SidebarInset className="flex flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-20 items-center gap-6 border-b-0 bg-[#fdfaf3]/80 backdrop-blur-xl px-10">
            <SidebarTrigger className={cn("transition-transform text-[#1e1b4b] hover:bg-orange-50", isRtl ? "rotate-0" : "rotate-180")} />
            
            <div className="flex-1 hidden md:flex items-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder={t('search')} 
                  className="bg-white/50 border-0 rounded-2xl h-11 ps-11 focus:bg-white transition-all ring-0 focus:ring-2 focus:ring-orange-200" 
                />
              </div>
            </div>

            <div className="flex items-center gap-8">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="font-black gap-2 text-[#e87c24] hover:bg-orange-50 rounded-xl h-10 px-4"
              >
                <Languages className="h-4 w-4" />
                {t('switchLang')}
              </Button>
              <NotificationBell />
              <div className="h-8 w-[1px] bg-orange-100" />
              <UserNav />
            </div>
          </header>
          
          <main className="flex-1 p-10 lg:p-14 animate-in fade-in slide-in-from-bottom-4 duration-700" dir={dir}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
