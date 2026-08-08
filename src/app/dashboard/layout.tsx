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
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { Loader2, LogOut, Lock, Clock, ShieldAlert, AlertTriangle, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, globalUser, loading: authLoading, logout } = useAuthContext();
  const { company, loading: companyLoading, subscription } = useCompanyContext();
  const { lang, setLang, t, dir, isRtl } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const isSovereignDev = globalUser?.isDeveloper === true;
  
  const isSuspended = company?.status === 'suspended';
  const isInactive = company?.status === 'inactive';
  const isExpired = subscription.isExpired;
  
  const isStuck = user && !globalUser && !authLoading;
  const needsLock = !isSovereignDev && (isExpired || isSuspended || isInactive);

  if (authLoading || companyLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FA] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse italic">Synchronizing Secure Session...</p>
      </div>
    );
  }

  if (!user) return null;

  if (isStuck) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-6 text-center" dir={dir}>
        <div className="max-w-md space-y-6">
           <div className="h-20 w-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><ShieldAlert className="h-10 w-10" /></div>
           <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900">{t('inline.profile.link.failed')}</h1>
           </div>
           <Button onClick={logout} variant="outline" className="w-full rounded-xl h-12 gap-2"><LogOut className="h-4 w-4" /> {t('logout')}</Button>
        </div>
      </div>
    );
  }

  if (needsLock) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 p-6" dir={dir}>
        <div className="max-w-xl w-full bg-white rounded-[3rem] p-12 text-center shadow-3xl animate-in zoom-in-95 duration-500 border-t-8 border-rose-500">
           <div className={cn(
             "w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl ring-8 mb-8",
             isSuspended ? "bg-amber-100 text-amber-600 ring-amber-50" : 
             isInactive ? "bg-blue-100 text-blue-600 ring-blue-50" :
             "bg-rose-100 text-rose-600 ring-rose-50"
           )}>
              {isSuspended ? <Lock className="h-12 w-12" /> : 
               isInactive ? <Clock className="h-12 w-12" /> :
               <AlertTriangle className="h-12 w-12" />}
           </div>
           
           <div className="space-y-4">
              <h1 className="text-4xl font-black text-slate-900 font-headline leading-tight">
                {isSuspended ? t('inline.account.frozen') : 
                 isInactive ? t('inline.awaiting.activation') :
                 t('inline.subscription.expired')}
              </h1>
           </div>

           <div className="mt-12 pt-8 border-t space-y-4">
              <Button onClick={logout} className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black text-xl hover:bg-slate-800 transition-all gap-3 shadow-xl">
                 <LogOut className="h-6 w-6" /> {t('logout')}
              </Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#F8F9FA] overflow-x-hidden" dir={dir}>
        <DashboardSidebar />
        
        <SidebarInset className="flex flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/90 backdrop-blur-md px-6 print:hidden shadow-sm">
            <SidebarTrigger className={cn("text-slate-600 hover:bg-slate-100 rounded-lg shrink-0", isRtl ? "rotate-180" : "rotate-0")} />
            <div className="flex-1">
              <BreadcrumbNav />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} 
                className="h-9 px-3 gap-2 rounded-full border-primary/20 hover:border-primary/40 bg-white shadow-sm transition-all group"
              >
                <div className="bg-primary/5 p-1 rounded-full group-hover:bg-primary/10 transition-colors">
                  <Languages className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  {lang === 'ar' ? 'English' : 'العربية'}
                </span>
              </Button>
              <NotificationBell />
              <div className="h-8 w-[1.5px] bg-slate-100 rounded-full" />
              <UserNav />
            </div>
          </header>
          
          <main className="flex-1 p-6 lg:p-8 animate-in fade-in duration-700 print:p-0">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
