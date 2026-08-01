
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
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, ShieldAlert, LogOut, Lock, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, globalUser, loading: authLoading, logout } = useAuthContext();
  const { company, loading: companyLoading, subscription } = useCompanyContext();
  const { lang, setLang, t, dir } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // التحقق السيادي الصارم
  // المطور الحقيقي هو من يحمل علامة isDeveloper في السجل العالمي فقط
  const isSovereignDev = globalUser?.isDeveloper === true;
  
  const isSuspended = company?.status === 'suspended';
  const isInactive = company?.status === 'inactive';
  const isPending = globalUser?.isPendingApproval === true;
  const isExpired = company?.status === 'expired' || subscription.isExpired;
  
  // تفعيل القفل إذا كان المستخدم ليس مطوراً والمنشأة غير جاهزة
  const needsLock = !isSovereignDev && (isExpired || isSuspended || isInactive || isPending);

  // واجهة الانتظار الشاملة لمنع تسريب البيانات قبل اكتمال الفحص
  if (authLoading || companyLoading || (user && !globalUser)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FA] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Authenticating Sovereign Session...</p>
      </div>
    );
  }

  if (!user) return null;

  if (needsLock) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center" dir={dir}>
        <div className="max-w-md space-y-8 animate-in zoom-in-95 duration-500">
           <div className={cn(
             "w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl ring-8",
             isSuspended ? "bg-amber-500/20 text-amber-500 ring-amber-500/5" : 
             (isInactive || isPending) ? "bg-blue-500/20 text-blue-500 ring-blue-500/5" :
             "bg-rose-500/20 text-rose-500 ring-rose-500/5"
           )}>
              {isSuspended ? <Lock className="h-12 w-12" /> : 
               (isInactive || isPending) ? <Clock className="h-12 w-12" /> :
               <ShieldAlert className="h-12 w-12" />}
           </div>
           <div className="space-y-3">
              <h1 className="text-4xl font-black text-white font-headline">
                {isSuspended ? (isRtl ? 'المنشأة مجمدة مؤقتاً' : 'Account Frozen') : 
                 (isInactive || isPending) ? (isRtl ? 'بانتظار تفعيل المنشأة' : 'Awaiting Activation') :
                 (isRtl ? 'انتهت صلاحية الوصول' : 'Subscription Expired')}
              </h1>
              <p className="text-slate-400 font-bold text-lg leading-relaxed">
                 {isSuspended 
                   ? (isRtl ? `عذراً، تم إيقاف الوصول لمنشأة ${company?.name} مؤقتاً بقرار إداري من المطور.` : `Access for ${company?.name} has been temporarily suspended by the developer.`)
                   : (isInactive || isPending)
                   ? (isRtl ? `شكراً لطلبكم. حساب منشأة ${company?.name || 'الجديدة'} قيد المراجعة حالياً من قبل المطور، سيتم إخطاركم فور التفعيل.` : `Thank you. Your account for ${company?.name || 'the new company'} is currently under review. You will be notified once activated.`)
                   : (isRtl ? `عذراً، انتهت فترة اشتراك منشأة ${company?.name}. يرجى التجديد لاستعادة الوصول للبيانات.` : `Subscription for ${company?.name} has expired. Please renew to regain access.`)
                 }
              </p>
           </div>
           <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
              <p className="text-[10px] text-slate-500 font-black text-center uppercase tracking-widest">Sovereign Cloud Guard</p>
              <Button onClick={logout} variant="outline" className="w-full border-white/10 text-white hover:bg-white/10 rounded-xl h-12 font-black">
                 <LogOut className="me-2 h-4 w-4" /> {t('logout')}
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
            <SidebarTrigger className={cn("text-slate-600 hover:bg-slate-100 rounded-lg shrink-0", isRtl ? "rotate-0" : "rotate-180")} />
            <div className="flex-1">
              <BreadcrumbNav />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="font-black gap-2 text-slate-600 h-10 px-4 text-xs">
                {t('switchLang')}
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
