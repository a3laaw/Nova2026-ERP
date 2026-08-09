'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { EquipmentService } from '@/services/equipment-service';
import { EquipmentForm } from '@/components/equipment/equipment-form';
import { toast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NewEquipmentPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);

  const handleSave = (formData: any) => {
    if (!db || !companyId || !user) return;
    setLoading(true);
    const equipmentService = new EquipmentService(db, companyId);
    equipmentService.createEquipment(formData, user.uid);
    toast({ title: t('common.saved') });
    router.push('/dashboard/equipment');
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-700" dir={dir}>
      <div className="flex items-center gap-4 border-b pb-4 border-slate-100 text-start">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 rounded-md border border-slate-200 text-slate-400">
           <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
             {t('equipment.registerNew')}
          </h1>
          <p className="text-muted-foreground font-medium text-xs">
             {t('equipment.registerNewDesc')}
          </p>
        </div>
      </div>

      <EquipmentForm onSubmit={handleSave} loading={loading} isRtl={isRtl} />
    </div>
  );
}
