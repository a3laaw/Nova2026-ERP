'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { UserPlus, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions'; 
import { ClientService } from '@/services/client-service';
import { ClientForm } from '@/components/clients/client-form';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NewClientPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const companyId = globalUser?.companyId;

  const handleSubmit = async (data: any) => {
    if (!db || !companyId || !user) return;
    setLoading(true);
    try {
      const service = new ClientService(db, companyId); 
      const clientId = await service.addClient(data, user.uid, globalUser?.fullName || user.displayName || 'User');
      toast({ 
        title: tSafe('common.saved', 'تم الحفظ بنجاح', 'Saved Successfully'),
        description: isRtl ? "تم تسجيل العميل وفتح ملفه الفني بنجاح." : "Client registered successfully."
      });
      router.push(`/dashboard/clients/${clientId}`);
    } catch (e: any) {
      console.error("Registration error:", e);
      toast({ 
        variant: "destructive", 
        title: tSafe('common.error', 'خطأ في عملية التسجيل', 'Registration Error'),
        description: e.message || tSafe('common.unexpectedError', 'حدث خطأ غير متوقع، يرجى مراجعة البيانات.', 'Unexpected error occurred.')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <UserPlus className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('clients.registerNew')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">
               {tSafe('clients.registerNewDesc', 'فتح ملف تجاري جديد لربطه بالمعاملات الفنية والمالية السيادية.', 'Open a new commercial file for technical and financial tracking.')}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => router.back()} className="h-11 px-6 rounded-xl border-2 font-black gap-2 bg-white shadow-sm hover:bg-slate-50">
           <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           {t('common.back')}
        </Button>
      </header>

      <div className="w-full">
         <ClientForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
