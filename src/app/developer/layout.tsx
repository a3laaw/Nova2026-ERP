
'use client';

import { useAuthContext } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, globalUser, loading } = useAuthContext();
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-headline font-bold text-xl leading-none">Developer Console</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">NovaFlow Core Management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300">
            {user?.email}
          </span>
          <button onClick={() => router.push('/')} className="text-sm hover:text-primary">Exit Console</button>
        </div>
      </header>
      <main className="p-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
