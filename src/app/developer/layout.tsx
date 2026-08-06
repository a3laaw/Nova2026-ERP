'use client';

import { useAuthContext } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldCheck, Languages, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, globalUser, loading, logout } = useAuthContext();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!globalUser?.isDeveloper) {
        router.push('/dashboard');
      }
    }
  }, [user, globalUser, loading, router]);

  if (loading || !globalUser?.isDeveloper) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b-2 border-primary/10 p-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className={cn("flex items-center gap-3", lang === 'ar' ? "flex-row-reverse" : "flex-row")}>
          <div className="p-2 bg-primary rounded-xl text-white shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className={lang === 'ar' ? "text-right" : "text-left"}>
            <h1 className="font-headline font-black text-xl leading-none text-slate-900">{t('devConsole')}</h1>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[8px] text-primary font-black uppercase tracking-widest">Sovereign Control</span>
               <div className="h-1 w-4 bg-primary/20 rounded-full" />
            </div>
          </div>
        </div>
        <div className={cn("flex items-center gap-4", lang === 'ar' ? "flex-row-reverse" : "flex-row")}>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="h-9 px-4 gap-2 rounded-full border-primary/20 hover:border-primary/40 bg-white shadow-sm transition-all group"
          >
            <div className="bg-primary/5 p-1 rounded-full group-hover:bg-primary/10 transition-colors">
               <Languages className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
               {lang === 'ar' ? 'English' : 'العربية'}
            </span>
          </Button>
          <div className="h-6 w-[1px] bg-slate-100" />
          <span className="text-[10px] font-black bg-slate-50 border border-slate-100 px-4 py-1.5 rounded-full text-slate-500 hidden sm:inline-flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            {user?.email}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-rose-500 hover:bg-rose-50 font-bold"
          >
            <LogOut className="h-4 w-4 ml-2" />
            {t('logout')}
          </Button>
        </div>
      </header>
      <main className="p-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
