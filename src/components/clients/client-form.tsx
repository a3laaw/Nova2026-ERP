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

  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGovId ? query(collection(db, paths.areas(companyId, selectedGovId)), orderBy('order')) : null, [db, companyId, selectedGovId]);

  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: areas } = useCollection<Area>(areasQuery);

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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 text-start pb-20">
      
      {/* القسم الأول: الهوية والتعريف */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-primary/5 p-6 border-b flex items-center justify-between">
           <h3 className="text-base font-black font-headline text-slate-800">{isRtl ? 'البيانات الأساسية والقانونية' : 'Identity & Legal'}</h3>
           <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">رقم الملف</Label>
              <div className="relative">
                <Input {...form.register('fileNumber')} readOnly className="h-12 rounded-2xl border-2 font-mono font-black bg-slate-50 text-primary border-slate-100 cursor-not-allowed" />
                {generating && <RefreshCw className="absolute end-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/40" />}
              </div>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الاسم الكامل (Ar)</Label>
                  <Input {...form.register('nameAr')} className="h-12 rounded-2xl border-2 font-bold focus:bg-white bg-slate-50/30" placeholder="أدخل الاسم بالعربي..." />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Name (En)</Label>
                  <Input {...form.register('nameEn')} className="h-12 rounded-2xl border-2 font-bold text-start bg-slate-50/30" dir="ltr" placeholder="Enter Full Name..." />
               </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الرقم المدني</Label>
              <div className="relative">
                 <Fingerprint className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...form.register('civilId')} maxLength={12} className="h-12 rounded-2xl border-2 ps-11 font-mono font-bold bg-slate-50/30" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الهاتف</Label>
              <Input {...form.register('mobile')} className="h-12 rounded-2xl border-2 font-bold bg-slate-50/30" placeholder="+965" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">البريد الإلكتروني</Label>
              <div className="relative">
                 <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...form.register('email')} type="email" className="h-12 rounded-2xl border-2 ps-11 font-bold text-start bg-slate-50/30" dir="ltr" placeholder="email@example.com" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* القسم الثاني: الموقع الجغرافي المطور (مطابق للصورة) */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-blue-50/30 p-6 border-b flex items-center justify-between">
           <h3 className="text-base font-black font-headline text-slate-800">{isRtl ? 'رادار الموقع والعنوان الذكي' : 'Smart Location Radar'}</h3>
           <MapPinned className="h-5 w-5 text-blue-600" />
        </div>
        <CardContent className="p-8 space-y-10">
           
           {/* المنطقة الخاصة برابط جوجل ماب - مطابقة للصورة */}
           <div className="p-10 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-blue-100 relative">
              <Label className="absolute top-4 right-10 text-[10px] font-black uppercase text-blue-400 tracking-[0.1em]">
                {isRtl ? 'رابط الموقع (GOOGLE MAPS)' : 'Google Maps Link'}
              </Label>
              
              <div className={cn("flex items-center gap-4 pt-4", isRtl ? "flex-row-reverse" : "flex-row")}>
                 {/* زر البحث المظلم */}
                 <Button 
                   type="button"
                   onClick={() => setIsMapOpen(true)}
                   className="h-14 px-8 rounded-2xl bg-[#1e1b4b] text-white font-black text-sm gap-3 hover:bg-slate-800 transition-all shadow-2xl shadow-indigo-900/20 shrink-0"
                 >
                    <Search className="h-5 w-5 text-[#e87c24]" />
                    {isRtl ? 'فتح الخريطة والبحث' : 'Open Map & Search'}
                 </Button>

                 {/* حقل الرابط الأنيق */}
                 <div className="relative flex-1">
                    <Input 
                      {...form.register('locationUrl')} 
                      placeholder="https://www.google.com/maps?q=..." 
                      className="h-14 rounded-2xl border-2 border-orange-100 ps-6 pe-12 font-mono text-[11px] bg-white focus:border-primary/40 transition-all shadow-inner" 
                      dir="ltr"
                    />
                    <Globe className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-200" />
                 </div>
              </div>
           </div>

           {/* تفاصيل العنوان المرجعي */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المحافظة</Label>
                <Select value={selectedGovId} onValueChange={(v) => { form.setValue('governorateId', v); form.setValue('areaId', ''); }}>
                   <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      {governorates?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المنطقة</Label>
                <Select disabled={!selectedGovId} value={selectedAreaId} onValueChange={(v) => form.setValue('areaId', v)}>
                   <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      {areas?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 md:col-span-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">القطعة</Label>
                    <Input {...form.register('block')} className="h-12 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الشارع</Label>
                    <Input {...form.register('street')} className="h-12 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المنزل</Label>
                    <Input {...form.register('houseNumber')} className="h-12 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-6">
        <Button 
          type="submit" 
          disabled={loading || generating} 
          className="h-20 rounded-[2.5rem] px-20 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
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
