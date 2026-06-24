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
import { Loader2, Languages, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading } = useAuthContext();
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
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-10 w-10 animate-spin text-[#FFA000]" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#F8F9FA] overflow-x-hidden" dir={dir}>
        {/* RIGHT SIDEBAR REMAINS UNTOUCHED */}
        <div className="print:hidden">
          <DashboardSidebar />
        </div>
        
        <SidebarInset className="flex flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-8 print:hidden shadow-sm">
            <SidebarTrigger className={cn("text-slate-600 hover:bg-slate-100 rounded-lg", isRtl ? "rotate-0" : "rotate-180")} />
            
            <div className="flex-1 hidden md:flex items-center">
              <div className="relative w-full max-w-xs">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder={t('search')} 
                  className="bg-slate-100/50 border-none rounded-xl h-10 ps-10 text-xs font-bold focus:bg-white transition-all ring-0 focus-visible:ring-0" 
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="font-black gap-2 text-slate-600 hover:bg-slate-100 rounded-lg h-10 px-4 text-xs"
              >
                <Languages className="h-4 w-4 text-[#FFA000]" />
                {t('switchLang')}
              </Button>
              <NotificationBell />
              <div className="h-8 w-[1.5px] bg-slate-100 rounded-full" />
              <UserNav />
            </div>
          </header>
          
          <main className="flex-1 p-6 lg:p-10 animate-in fade-in duration-700 print:p-0" dir={dir}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}