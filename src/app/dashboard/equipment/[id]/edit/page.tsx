'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { doc } from 'firebase/firestore';
import { EquipmentService } from '@/services/equipment-service';
import { EquipmentForm } from '@/components/equipment/equipment-form';
import { Equipment } from '@/types/equipment';
import { toast } from '@/hooks/use-toast';
import { Truck, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function EditEquipmentPage() {
  const params = useParams();
  const equipId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);

  const equipRef = useMemo(() => 
    companyId && db ? doc(db, paths.equipment(companyId), equipId) : null, 
  [db, companyId, equipId]);
  
  const { data: equipment, loading: fetchLoading } = useDoc<Equipment>(equipRef);

  const handleSave = async (formData: any) => {
    if (!db || !companyId || !user) return;
    
    setLoading(true);
    try {
      const equipmentService = new EquipmentService(db, companyId);
      await equipmentService.updateEquipment(equipId, formData, user.uid);
      toast({ title: t('saved') });
      router.push('/dashboard/equipment');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex items-center gap-6 border-b pb-8 border-slate-100 text-start">
        <Button variant="ghost" onClick={() => router.push('/dashboard/equipment')} className="h-12 w-12 p-0 rounded-2xl bg-white border-2 text-slate-400 shadow-sm">
           <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start space-y-1">
          <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">
             {isRtl ? 'تعديل بيانات الأصل' : 'Edit Asset Details'}
          </h1>
          <p className="text-muted-foreground font-bold italic text-sm">
             {equipment?.name} | {equipment?.code}
          </p>
        </div>
      </div>

      {equipment && <EquipmentForm initialData={equipment} onSubmit={handleSave} loading={loading} isRtl={isRtl} />}
    </div>
  );
}
