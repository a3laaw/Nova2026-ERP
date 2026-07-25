'use client';

import { useAuthContext } from '@/context/auth-context';
import { useCompanyContext } from '@/context/company-context';
import { useLanguage } from '@/context/language-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { Loader2, Languages, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const pathname = usePathname();
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  /**
   * Sovereign Absolute Thaw Protocol V7: 
   * عدواني جداً في فك أي قفل للنقر يتركه الـ Dropdown أو الـ Dialog.
   * يضمن استجابة زر الحذف وكافة الأزرار الأخرى.
   */
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const thaw = () => {
        const body = document.body;
        
        // 1. فك قفل النقر القسري
        if (body.style.pointerEvents === 'none') {
          body.style.pointerEvents = 'auto';
        }
        
        // 2. فك قفل التمرير (Scroll Lock)
        if (body.style.overflow === 'hidden' || body.getAttribute('data-scroll-locked') !== null) {
           body.style.overflow = 'auto';
           body.style.paddingRight = '0px';
           body.removeAttribute('data-scroll-locked');
        }

        // 3. تنظيف بقايا الراديكس (Radix Focus Guards)
        const focusGuards = document.querySelectorAll('[data-radix-focus-guard]');
        focusGuards.forEach(el => el.remove());
      };

      thaw();
      
      // التنفيذ عند كل نقرة لضمان الإذابة الفورية
      window.addEventListener('mousedown', thaw);
      const interval = setInterval(thaw, 200); 
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('mousedown', thaw);
      };
    }
  }, [pathname]);

  if (authLoading || companyLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FA] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#e87c24]" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
           Authenticating Sovereign Session...
        </p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#F8F9FA] overflow-x-hidden" dir={dir}>
        <div className="print:hidden">
          <DashboardSidebar />
        </div>
        
        <SidebarInset className="flex flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/90 backdrop-blur-md px-6 print:hidden shadow-sm">
            <SidebarTrigger className={cn("text-slate-600 hover:bg-slate-100 rounded-lg shrink-0", isRtl ? "rotate-0" : "rotate-180")} />
            
            <div className="flex-1 flex items-center gap-4 overflow-hidden">
              <div className="h-6 w-[1.5px] bg-slate-100 rounded-full mx-2 hidden md:block" />
              <BreadcrumbNav />
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="font-black gap-2 text-slate-600 hover:bg-slate-100 rounded-lg h-10 px-4 text-xs"
              >
                <Languages className="h-4 w-4 text-[#FFA000]" />
                {t('switchLang')}
              </Button>

              {/* زر المواعيد بجوار التنبيهات */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/dashboard/appointments')}
                className="text-muted-foreground hover:text-primary transition-colors h-10 w-10 relative"
                title={isRtl ? 'المواعيد' : 'Appointments'}
              >
                <CalendarDays className="h-5 w-5" />
              </Button>

              <NotificationBell />
              <div className="h-8 w-[1.5px] bg-slate-100 rounded-full" />
              <UserNav />
            </div>
          </header>
          
          <main className="flex-1 p-6 lg:p-8 animate-in fade-in duration-700 print:p-0" dir={dir}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
