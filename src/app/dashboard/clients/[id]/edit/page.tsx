'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowRight, Edit3, Loader2 } from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions'; // استيراد الصلاحيات
import { ClientService } from '@/services/client-service';
import { ClientForm } from '@/components/clients/client-form';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function EditClientPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions(); // جلب مصفوفة الصلاحيات
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [saving, setSaving] = useState(false);

  const clientRef = useMemo(() => companyId && db ? doc(db, paths.clients(companyId), clientId) : null, [db, companyId, clientId]);
  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);

  const handleSubmit = async (data: any) => {
    if (!db || !companyId || !user) return;
    setSaving(true);
    try {
      // تمرير الصلاحيات للخدمة لضمان السماح بالإجراء
      const service = new ClientService(db, companyId, permissions);
      await service.updateClient(clientId, data, user.uid, user.displayName || user.email || 'User');
      toast({ title: t('saved'), description: isRtl ? 'تم تحديث بيانات العميل بنجاح.' : 'Client data updated successfully.' });
      router.push(`/dashboard/clients/${clientId}`);
    } catch (e: any) {
      console.error("Update Client Error:", e);
      toast({ 
        variant: "destructive", 
        title: t('error'), 
        description: e.message.includes('UNAUTHORIZED') 
          ? (isRtl ? 'لا تملك صلاحية تعديل بيانات العملاء.' : 'Unauthorized to edit clients.') 
          : t('saveFailed') 
      });
    } finally {
      setSaving(false);
    }
  };

  if (clientLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!client) return <div className="p-20 text-center font-black text-2xl">{isRtl ? 'العميل غير موجود' : 'Client not found'}</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center gap-6 border-b pb-8 border-slate-100">
        <Button variant="ghost" onClick={() => router.push(`/dashboard/clients/${clientId}`)} className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all">
          <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-4 text-slate-900">
            <Edit3 className="h-10 w-10 text-primary" />
            {isRtl ? 'تعديل بيانات العميل' : 'Edit Client Profile'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {client.nameAr} | {client.fileNumber}
          </p>
        </div>
      </div>

      <ClientForm initialData={client} onSubmit={handleSubmit} loading={saving} />
    </div>
  );
}
