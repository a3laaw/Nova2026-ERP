'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { EquipmentService } from '@/services/equipment-service';
import { EquipmentForm } from '@/components/equipment/equipment-form';
import { toast } from '@/hooks/use-toast';
import { Truck, ArrowRight } from 'lucide-react';
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

  const handleSave = async (formData: any) => {
    if (!db || !companyId || !user) return;
    
    setLoading(true);
    try {
      const equipmentService = new EquipmentService(db, companyId);
      await equipmentService.createEquipment(formData, user.uid);
      toast({ title: isRtl ? "تمت إضافة المعدة بنجاح" : "Equipment Registered" });
      router.push('/dashboard/equipment');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in duration-700" dir={dir}>
      <div className="flex items-center gap-6 border-b pb-8 border-slate-100 text-start">
        <Button variant="ghost" onClick={() => router.push('/dashboard/equipment')} className="h-12 w-12 p-0 rounded-2xl bg-white border-2 text-slate-400 shadow-sm">
           <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start space-y-1">
          <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">
             {isRtl ? 'تسجيل أصل تشغيلي جديد' : 'Register New Asset'}
          </h1>
          <p className="text-muted-foreground font-bold italic text-sm">
             {isRtl ? 'إدراج معدة مملوكة أو مستأجرة وتحديد مسارها المالي.' : 'Register owned or rented equipment with financial metrics.'}
          </p>
        </div>
      </div>

      <EquipmentForm onSubmit={handleSave} loading={loading} isRtl={isRtl} />
    </div>
  );
}
