'use client';

import { useAuthContext } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldCheck, Languages, LogOut } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-2xl">
        <div className={cn("flex items-center gap-3", lang === 'ar' ? "flex-row-reverse" : "flex-row")}>
          <div className="p-2 bg-primary rounded-xl">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className={lang === 'ar' ? "text-right" : "text-left"}>
            <h1 className="font-headline font-bold text-xl leading-none">{t('devConsole')}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">NovaFlow Core Management</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-4", lang === 'ar' ? "flex-row-reverse" : "flex-row")}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="text-white hover:bg-slate-800 gap-2"
          >
            <Languages className="h-4 w-4" />
            {t('switchLang')}
          </Button>
          <div className="h-6 w-[1px] bg-slate-700" />
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 hidden sm:inline">
            {user?.email}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
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
