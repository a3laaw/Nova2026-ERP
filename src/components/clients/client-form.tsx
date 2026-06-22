'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, MapPin, Save, Loader2, RefreshCw, Link as LinkIcon, Map as MapIcon, Target, CheckCircle2 } from "lucide-react";
import { Client } from '@/types/client';
import { useLanguage } from '@/context/language-context';
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/context/auth-context';
import { ClientService } from '@/services/client-service';
import { cn } from '@/lib/utils';

export function ClientForm({ initialData, onSubmit, loading }: { initialData?: any, onSubmit: (data: any) => void, loading?: boolean }) {
  const { dir, lang } = useLanguage();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  
  const form = useForm({
    defaultValues: initialData || { fileNumber: '', nameAr: '', mobile: '', email: '', locationUrl: '' }
  });

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!initialData && db && globalUser?.companyId && !form.getValues('fileNumber')) {
      setGenerating(true);
      const service = new ClientService(db, globalUser.companyId);
      service.getNextFileNumber().then(num => {
        form.setValue('fileNumber', num);
        setGenerating(false);
      });
    }
  }, [db, globalUser, initialData, form]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-start">
      <Card className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden">
        <div className="bg-primary/5 p-6 border-b flex items-center justify-between">
           <div>
              <h3 className="text-lg font-black font-headline text-slate-800">{isRtl ? 'بيانات الهوية' : 'Basic Identity'}</h3>
           </div>
           <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">رقم الملف</Label>
              <div className="relative">
                <Input {...form.register('fileNumber')} readOnly className="h-11 rounded-xl border-2 font-mono font-black bg-slate-50" />
                {generating && <RefreshCw className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/30" />}
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">الاسم بالكامل</Label>
              <Input {...form.register('nameAr')} className="h-11 rounded-xl border-2 font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">الهاتف</Label>
              <Input {...form.register('mobile')} className="h-11 rounded-xl border-2 font-bold" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">رابط الموقع (Google Maps)</Label>
              <div className="relative">
                 <LinkIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...form.register('locationUrl')} placeholder="https://..." className="h-11 rounded-xl border-2 ps-10 font-mono text-xs" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || generating} className="h-14 rounded-2xl px-12 bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-3">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {isRtl ? 'حفظ ملف العميل' : 'Save Client'}
        </Button>
      </div>
    </form>
  );
}
