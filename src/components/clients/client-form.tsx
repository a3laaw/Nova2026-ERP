'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  UserPlus, MapPin, Save, Loader2, 
  RefreshCw, Link as LinkIcon, Mail, 
  Fingerprint, MapPinned, Building2,
  Navigation, Search, Globe
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { ClientService } from '@/services/client-service';
import { paths } from '@/firebase/multi-tenant';
import { Governorate, Area } from '@/types/reference';
import { LocationPickerDialog } from './location-picker-dialog';
import { cn } from '@/lib/utils';

export function ClientForm({ initialData, onSubmit, loading }: { initialData?: any, onSubmit: (data: any) => void, loading?: boolean }) {
  const { dir, lang, t } = useLanguage();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;
  
  const form = useForm({
    defaultValues: initialData || { 
      fileNumber: '', 
      nameAr: '', 
      nameEn: '', 
      mobile: '', 
      email: '', 
      civilId: '',
      governorateId: '',
      governorateName: '',
      areaId: '',
      areaName: '',
      block: '',
      street: '',
      houseNumber: '',
      locationUrl: '' 
    }
  });

  const [generating, setGenerating] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const selectedGovId = form.watch('governorateId');

  // جلب البيانات المرجعية للجغرافيا
  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGovId ? query(collection(db, paths.areas(companyId, selectedGovId)), orderBy('order')) : null, [db, companyId, selectedGovId]);

  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: areas } = useCollection<Area>(areasQuery);

  // توليد رقم الملف تلقائياً للعملاء الجدد
  useEffect(() => {
    if (!initialData && db && companyId && !form.getValues('fileNumber')) {
      setGenerating(true);
      const service = new ClientService(db, companyId);
      service.getNextFileNumber().then(num => {
        form.setValue('fileNumber', num);
        setGenerating(false);
      });
    }
  }, [db, companyId, initialData, form]);

  // تحديث أسماء المحافظات والمناطق نصياً للحفظ
  useEffect(() => {
    if (selectedGovId && governorates) {
      const gov = governorates.find(g => g.id === selectedGovId);
      if (gov) form.setValue('governorateName', isRtl ? gov.name : gov.nameEn);
    }
  }, [selectedGovId, governorates, isRtl, form]);

  const selectedAreaId = form.watch('areaId');
  useEffect(() => {
    if (selectedAreaId && areas) {
      const area = areas.find(a => a.id === selectedAreaId);
      if (area) form.setValue('areaName', isRtl ? area.name : area.nameEn);
    }
  }, [selectedAreaId, areas, isRtl, form]);

  const handleLocationSelect = (url: string) => {
    form.setValue('locationUrl', url);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-start pb-20">
      
      {/* القسم الأول: الهوية والتعريف */}
      <Card className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-primary/5 p-5 border-b flex items-center justify-between">
           <h3 className="text-sm font-black font-headline text-slate-800">{isRtl ? 'البيانات الأساسية والقانونية' : 'Identity & Legal'}</h3>
           <UserPlus className="h-4 w-4 text-primary" />
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">رقم الملف</Label>
              <div className="relative">
                <Input {...form.register('fileNumber')} readOnly className="h-10 rounded-xl border-2 font-mono font-black bg-slate-100 text-primary border-slate-200" />
                {generating && <RefreshCw className="absolute end-3 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-primary/40" />}
              </div>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">الاسم الكامل (Ar)</Label>
                  <Input {...form.register('nameAr')} className="h-10 rounded-xl border-2 font-bold" placeholder="أحمد محمد..." />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Name (En)</Label>
                  <Input {...form.register('nameEn')} className="h-10 rounded-xl border-2 font-bold text-start" dir="ltr" placeholder="Ahmad..." />
               </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">الرقم المدني</Label>
              <div className="relative">
                 <Fingerprint className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...form.register('civilId')} maxLength={12} className="h-10 rounded-xl border-2 ps-10 font-mono font-bold" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">الهاتف</Label>
              <Input {...form.register('mobile')} className="h-10 rounded-xl border-2 font-bold" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">البريد الإلكتروني</Label>
              <div className="relative">
                 <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...form.register('email')} type="email" className="h-10 rounded-xl border-2 ps-10 font-bold text-start" dir="ltr" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* القسم الثاني: الموقع الجغرافي والعنوان (مُحدث بمحرك الخرائط) */}
      <Card className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-blue-50/50 p-5 border-b flex items-center justify-between">
           <h3 className="text-sm font-black font-headline text-slate-800">{isRtl ? 'رادار الموقع والعنوان الذكي' : 'Smart Location Radar'}</h3>
           <MapPinned className="h-4 w-4 text-blue-600" />
        </div>
        <CardContent className="p-6 space-y-6">
           {/* حقل البحث السريع والخرائط */}
           <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-blue-100">
              <Label className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">{isRtl ? 'رابط الموقع (GOOGLE MAPS)' : 'Google Maps Link'}</Label>
              <div className="flex gap-3">
                 <div className="relative flex-1">
                    <Globe className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input 
                      {...form.register('locationUrl')} 
                      placeholder=".../https://maps.google.com" 
                      className="h-12 rounded-xl border-2 ps-11 font-mono text-[10px] bg-white" 
                      dir="ltr"
                    />
                 </div>
                 <Button 
                   type="button"
                   onClick={() => setIsMapOpen(true)}
                   className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black text-xs gap-2 hover:scale-[1.02] transition-all"
                 >
                    <Search className="h-4 w-4 text-primary" />
                    {isRtl ? 'فتح الخريطة والبحث' : 'Open Map'}
                 </Button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-50">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">المحافظة</Label>
                <Select value={selectedGovId} onValueChange={(v) => { form.setValue('governorateId', v); form.setValue('areaId', ''); }}>
                   <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      {governorates?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">المنطقة</Label>
                <Select disabled={!selectedGovId} value={selectedAreaId} onValueChange={(v) => form.setValue('areaId', v)}>
                   <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      {areas?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 md:col-span-2 gap-3">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">القطعة</Label>
                    <Input {...form.register('block')} className="h-10 rounded-xl border-2 font-bold text-center" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">الشارع</Label>
                    <Input {...form.register('street')} className="h-10 rounded-xl border-2 font-bold text-center" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">المنزل</Label>
                    <Input {...form.register('houseNumber')} className="h-10 rounded-xl border-2 font-bold text-center" />
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          disabled={loading || generating} 
          className="h-16 rounded-[1.5rem] px-16 bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
          {initialData ? (isRtl ? 'تحديث الملف' : 'Update File') : (isRtl ? 'حفظ ملف العميل' : 'Save Client')}
        </Button>
      </div>

      {/* مودال الخريطة الذكي */}
      <LocationPickerDialog 
        isOpen={isMapOpen} 
        onClose={() => setIsMapOpen(false)}
        onSelect={handleLocationSelect}
        initialUrl={form.watch('locationUrl')}
      />
    </form>
  );
}
