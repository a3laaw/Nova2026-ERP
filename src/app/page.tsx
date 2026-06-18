'use client';

import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function Home() {
  const { user, globalUser } = useAuthContext();
  const router = useRouter();

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
            onClick={() => router.push('/dashboard')}
            className="bg-primary text-white px-8 py-6 rounded-2xl text-lg font-bold"
          >
            الانتقال إلى لوحة التحكم
            <ArrowLeft className="mr-2 h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Button 
            onClick={() => router.push('/login')} // Placeholder path
            className="bg-primary text-white px-8 py-6 rounded-2xl text-lg font-bold"
          >
            تسجيل الدخول للنظام
          </Button>
          <p className="text-sm text-muted-foreground">تواصل مع الإدارة للحصول على صلاحية الوصول.</p>
        </div>
      )}
      
      {globalUser?.isDeveloper && (
        <Button 
          variant="outline"
          onClick={() => router.push('/developer')}
          className="mt-8 border-primary/20 text-primary"
        >
          أدوات المطور
        </Button>
      )}
    </div>
  );
}
