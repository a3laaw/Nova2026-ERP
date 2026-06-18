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
import { Loader2, Languages, ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading, logout } = useAuthContext();
  const { company, loading: companyLoading } = useCompanyContext();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || companyLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (company?.status === 'suspended') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border-t-8 border-destructive">
          <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-black font-headline mb-4">تم إيقاف حساب المنشأة</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            عذراً، تم إيقاف الوصول لشركة <span className="font-bold text-foreground">{company.name}</span> لعدم تجديد الاشتراك أو مخالفة الشروط.
            <br />
            <span className="text-xs mt-2 block font-bold text-destructive">تنبيه: سيتم حذف كافة البيانات تلقائياً بعد 3 أشهر من تاريخ الإيقاف.</span>
          </p>
          <div className="space-y-4">
            <Button className="w-full bg-solaris-gradient py-6 text-lg font-bold rounded-2xl text-white">تجديد الاشتراك الآن</Button>
            <Button variant="ghost" onClick={logout} className="w-full flex items-center justify-center gap-2">
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <DashboardSidebar />
        <SidebarInset className="flex flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-20 items-center gap-4 px-8 mt-4 mx-4 rounded-3xl glass-card">
            <SidebarTrigger className={lang === 'ar' ? 'ml-0' : '-mr-1'} />
            <div className="flex-1">
              <h2 className={cn("text-xs font-black text-black/40 uppercase tracking-[0.2em]", lang === 'ar' ? 'text-right' : 'text-left')}>
                {company?.name || t('workspace')} / <span className="text-black">{t('dashboard')}</span>
              </h2>
            </div>
            <div className="flex items-center gap-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="font-black gap-2 text-primary hover:bg-primary/5 rounded-xl"
              >
                <Languages className="h-4 w-4" />
                {t('switchLang')}
              </Button>
              <div className="h-8 w-[1px] bg-black/5" />
              <NotificationBell />
              <div className="h-8 w-[1px] bg-black/5" />
              <UserNav />
            </div>
          </header>
          <main className="flex-1 p-8 lg:p-12 animate-in fade-in duration-700">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}