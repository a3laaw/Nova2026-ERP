
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions'; 
import { ClientService } from '@/services/client-service';
import { ClientForm } from '@/components/clients/client-form';
import { toast } from '@/hooks/use-toast';

export default function NewClientPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;

  const handleSubmit = async (data: any) => {
    if (!db || !companyId || !user) return;
    setLoading(true);
    try {
      const service = new ClientService(db, companyId, permissions); 
      const clientId = await service.addClient(data, user.uid, user.displayName || user.email || 'User');
      toast({ title: t('saved'), description: isRtl ? 'تم إنشاء ملف العميل بنجاح.' : 'Client file created successfully.' });
      router.push(`/dashboard/clients/${clientId}`);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: t('error'), 
        description: e.message.includes('UNAUTHORIZED') 
          ? (isRtl ? 'لا تملك صلاحية إضافة عملاء.' : 'Unauthorized to add clients.') 
          : t('saveFailed') 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in slide-in-from-bottom-6 duration-700" dir={dir}>
      <div className="flex items-center gap-6 border-b pb-8 border-slate-100">
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
