
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ArrowLeft } from 'lucide-react';

export default function Home() {
  const { user, globalUser, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && globalUser) {
      const target = globalUser.isDeveloper ? '/developer' : '/dashboard';
      router.push(target);
    }
  }, [user, globalUser, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-primary/20 mb-8">
        <Sparkles className="h-10 w-10" />
      </div>
      <h1 className="text-5xl font-black font-headline mb-4 tracking-tight">NovaFlow ERP</h1>
      <p className="text-xl text-muted-foreground max-w-md mb-12">
        نظام الإدارة المتكامل للمقاولات والهندسة. ذكاء اصطناعي في خدمة عملياتك.
      </p>

      {user ? (
        <div className="space-y-4">
          <p className="font-bold">مرحباً بك، {user.email}</p>
          <Button 
            onClick={() => router.push(globalUser?.isDeveloper ? '/developer' : '/dashboard')}
            className="bg-primary text-white px-8 py-6 rounded-2xl text-lg font-bold"
          >
            الانتقال إلى لوحة التحكم
            <ArrowLeft className="mr-2 h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Button 
            onClick={() => router.push('/login')}
            className="bg-primary text-white px-12 py-6 rounded-2xl text-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
          >
            تسجيل الدخول للنظام
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/register')}
            className="px-12 py-6 rounded-2xl text-lg font-bold border-2"
          >
            طلب انضمام شركة جديدة
          </Button>
          <p className="text-sm text-muted-foreground mt-4">نظام مغلق للمؤسسات المعتمدة فقط.</p>
        </div>
      )}
    </div>
  );
}
