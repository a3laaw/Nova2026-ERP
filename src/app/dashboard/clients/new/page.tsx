
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { UserPlus, ArrowRight } from "lucide-react";
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
  const { t, dir, isRtl } = useLanguage();
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
      const clientId = await service.addClient(data, user.uid, user.displayName || user.email || 'User');
      toast({ title: t('common.saved') });
      router.push(`/dashboard/clients/${clientId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full px-4 md:px-6 animate-in fade-in" dir={dir}>
      <div className="flex items-center gap-3 border-b pb-4 border-slate-100">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 rounded-md border text-slate-400">
           <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {t('clients.registerNew')}
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            {t('clients.registerNewDesc')}
          </p>
        </div>
      </div>

      <div className="w-full">
         <ClientForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
