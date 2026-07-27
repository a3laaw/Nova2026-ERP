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
      {/* هيدر فاتح مشرق متوافق مع الهوية الجديدة */}
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
            variant="ghost" 
            size="sm" 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="text-slate-600 hover:bg-slate-50 gap-2 font-bold"
          >
            <Languages className="h-4 w-4 text-primary" />
            {t('switchLang')}
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
