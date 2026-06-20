'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus } from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ClientService } from '@/services/client-service';
import { ClientForm } from '@/components/clients/client-form';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NewClientPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;

  const handleSubmit = async (data: any) => {
    if (!db || !companyId || !user) return;
    setLoading(true);
    try {
      const service = new ClientService(db, companyId, []); // Permissions logic can be expanded
      const clientId = await service.addClient(data, user.uid, user.displayName || user.email || 'User');
      toast({ title: t('saved'), description: isRtl ? 'تم إنشاء ملف العميل بنجاح.' : 'Client file created successfully.' });
      router.push(`/dashboard/clients/${clientId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in slide-in-from-bottom-6 duration-700" dir={dir}>
      <div className="flex items-center gap-6 border-b pb-8 border-slate-100">
        <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all">
          <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-4 text-slate-900">
            <UserPlus className="h-10 w-10 text-primary" />
            {isRtl ? 'تسجيل عميل جديد' : 'Register New Client'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'فتح ملف تجاري جديد لربطه بالمعاملات الفنية لاحقاً' : 'Open new commercial file for future transactions'}
          </p>
        </div>
      </div>

      <ClientForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
