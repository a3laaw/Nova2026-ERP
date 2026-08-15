'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  UserPlus, Save, Loader2, 
  RefreshCw, Mail, Fingerprint, MapPinned,
  Briefcase, CheckCircle2,
  LocateFixed
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { ClientService } from '@/services/client-service';
import { paths } from '@/firebase/multi-tenant';
import { Governorate, Area } from '@/types/reference';
import { Employee } from '@/types/hr';
import { LocationPickerDialog } from './location-picker-dialog';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";

const clientFormSchema = z.object({
  fileNumber: z.string().min(1, "رقم الملف مطلوب"),
  nameAr: z.string().min(3, "يجب أن يكون الاسم 3 حروف على الأقل"),
  nameEn: z.string().default(''),
  mobile: z.string().min(8, "رقم الهاتف غير صحيح"),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal('')),
  civilId: z.string().default(''),
  governorateId: z.string().min(1, "يرجى اختيار المحافظة"),
  governorateName: z.string().default(''),
  areaId: z.string().min(1, "يرجى اختيار المنطقة"),
  areaName: z.string().default(''),
  block: z.string().default(''),
  street: z.string().default(''),
  houseNumber: z.string().default(''),
  locationUrl: z.string().default(''),
  assignedEngineerId: z.string().min(1, "يجب تعيين مهندس مسؤول"),
  assignedEngineerName: z.string().default('')
});

export function ClientForm({ initialData, onSubmit, loading }: { initialData?: any, onSubmit: (data: any) => void, loading?: boolean }) {
  const { dir, lang, t, tSafe } = useLanguage();
  const { globalUser } = useAuthContext();
  const { isAdmin } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;
  
  const { register, handleSubmit, formState: { errors }, setValue, watch, getValues } = useForm({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialData || { 
      fileNumber: '', nameAr: '', nameEn: '', mobile: '', email: '', civilId: '',
      governorateId: '', areaId: '', block: '', street: '', houseNumber: '', locationUrl: '',
      assignedEngineerId: globalUser?.employeeId || ''
    }
  });

  const [generating, setGenerating] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  const selectedGovId = watch('governorateId');
  const selectedAreaId = watch('areaId');
  const assignedEngineerId = watch('assignedEngineerId');
  const locationUrl = watch('locationUrl');

  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGovId ? query(collection(db, paths.areas(companyId, selectedGovId)), orderBy('order')) : null, [db, companyId, selectedGovId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('status', '==', 'active')) : null, [db, companyId]);

  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: areas } = useCollection<Area>(areasQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const engineers = useMemo(() => {
    return (employees || []).filter(e => 
      e.departmentName?.includes('معماري') || e.departmentName?.includes('Arch') ||
      e.jobTitle?.includes('معماري') || e.jobTitle?.includes('Arch')
    );
  }, [employees]);

  useEffect(() => {
    if (!initialData && db && companyId && !getValues('fileNumber')) {
      setGenerating(true);
      const service = new ClientService(db, companyId);
      service.getNextFileNumber().then(num => {
        setValue('fileNumber', num);
        setGenerating(false);
      });
    }
  }, [db, companyId, initialData, setValue, getValues]);

  useEffect(() => {
    if (selectedGovId && governorates) {
      const gov = governorates.find(g => g.id === selectedGovId);
      if (gov) setValue('governorateName', isRtl ? gov.name : gov.nameEn);
    }
  }, [selectedGovId, governorates, isRtl, setValue]);

  useEffect(() => {
    if (assignedEngineerId && engineers) {
      const eng = engineers.find(e => e.id === assignedEngineerId);
      if (eng) setValue('assignedEngineerName', eng.fullName);
    }
  }, [assignedEngineerId, engineers, setValue]);

  useEffect(() => {
    if (selectedAreaId && areas) {
      const area = areas.find(a => a.id === selectedAreaId);
      if (area) setValue('areaName', isRtl ? area.name : area.nameEn);
    }
  }, [selectedAreaId, areas, isRtl, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 text-start pb-20 w-full max-w-[1600px] mx-auto">
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-primary/5 p-6 border-b flex items-center justify-between">
           <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-primary" />
              <h3 className="text-base font-black font-headline text-slate-800">{t('clients.form.identity')}</h3>
           </div>
        </div>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.fileNumber')} <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Input {...register('fileNumber')} readOnly className="h-10 rounded-xl border-2 font-mono font-black bg-slate-50 text-primary border-slate-100 cursor-not-allowed" />
                {generating && <RefreshCw className="absolute end-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary/40" />}
              </div>
              {errors.fileNumber && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.fileNumber.message as string}</p>}
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.nameAr')} <span className="text-rose-500">*</span></Label>
                  <Input {...register('nameAr')} className={cn("h-10 rounded-xl border-2 font-bold focus:bg-white bg-slate-50/30", errors.nameAr && "border-rose-200 bg-rose-50/20")} />
                  {errors.nameAr && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.nameAr.message as string}</p>}
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.nameEn')}</Label>
                  <Input {...register('nameEn')} className="h-10 rounded-xl border-2 font-bold text-start bg-slate-50/30" dir="ltr" />
               </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.civilId')}</Label>
              <div className="relative">
                 <Fingerprint className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...register('civilId')} maxLength={12} className="h-10 rounded-xl border-2 ps-11 font-mono font-bold bg-slate-50/30" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.mobile')} <span className="text-rose-500">*</span></Label>
              <Input {...register('mobile')} className={cn("h-10 rounded-xl border-2 font-bold bg-slate-50/30", errors.mobile && "border-rose-200 bg-rose-50/20")} placeholder="+965" />
              {errors.mobile && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.mobile.message as string}</p>}
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.email')}</Label>
              <div className="relative">
                 <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                 <Input {...register('email')} type="email" className="h-10 rounded-xl border-2 ps-11 font-bold text-start bg-slate-50/30" dir="ltr" />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50">
             <div className="bg-orange-50/50 p-6 rounded-3xl border-2 border-orange-100 flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center gap-4 shrink-0 text-start">
                   <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-[#e87c24] shadow-sm border border-orange-100">
                      <Briefcase className="h-5 w-5" />
                   </div>
                   <div className="text-start">
                      <h4 className="font-black text-sm text-slate-800">{t('clients.form.engineer')} <span className="text-rose-500">*</span></h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{t('clients.form.assignment')}</p>
                   </div>
                </div>
                
                <div className="flex-1 w-full text-start">
                   <Select 
                     disabled={!isAdmin && !!initialData} 
                     value={assignedEngineerId} 
                     onValueChange={(v) => setValue('assignedEngineerId', v, { shouldValidate: true })}
                   >
                      <SelectTrigger className={cn("h-11 rounded-xl border-2 bg-white font-bold", errors.assignedEngineerId && "border-rose-200 bg-rose-50")}>
                         <SelectValue placeholder={t('common.search')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-2 shadow-2xl z-[200] max-h-[300px] overflow-y-auto">
                         {engineers.map(eng => (
                           <SelectItem key={eng.id} value={eng.id!} className="font-bold py-3">
                              {eng.fullName}
                           </SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                   {errors.assignedEngineerId && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.assignedEngineerId.message as string}</p>}
                </div>
             </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-blue-50/30 p-6 border-b flex items-center justify-between">
           <div className="flex items-center gap-3 text-start">
              <MapPinned className="h-6 w-6 text-blue-600" />
              <div>
                 <h3 className="text-base font-black font-headline text-slate-800">{t('clients.form.locationRadar')}</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRtl ? 'تحديد إحداثيات الموقع بدقة Gps' : 'Set precise GPS coordinates'}</p>
              </div>
           </div>
           {locationUrl && (
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 border-2 font-black text-[10px] h-8 px-4 rounded-xl flex items-center gap-2">
                 <CheckCircle2 className="h-3.5 w-3.5" /> {isRtl ? 'تم تحديد الموقع' : 'Location Set'}
              </Badge>
           )}
        </div>
        <CardContent className="p-8 space-y-10">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-1.5 text-start">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.governorate')} <span className="text-rose-500">*</span></Label>
                   <Select value={selectedGovId} onValueChange={(v) => { setValue('governorateId', v, { shouldValidate: true }); setValue('areaId', ''); }}>
                      <SelectTrigger className={cn("h-10 rounded-xl border-2 font-bold bg-slate-50/30", errors.governorateId && "border-rose-200 bg-rose-50")}><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-2 shadow-2xl z-[200] max-h-[300px] overflow-y-auto">
                         {governorates?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                      </SelectContent>
                   </Select>
                   {errors.governorateId && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.governorateId.message as string}</p>}
                 </div>
                 
                 <div className="space-y-1.5 text-start">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.area')} <span className="text-rose-500">*</span></Label>
                   <Select disabled={!selectedGovId} value={selectedAreaId} onValueChange={(v) => setValue('areaId', v, { shouldValidate: true })}>
                      <SelectTrigger className={cn("h-10 rounded-xl border-2 font-bold bg-slate-50/30", errors.areaId && "border-rose-200 bg-rose-50")}><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-2 shadow-2xl z-[200] max-h-[300px] overflow-y-auto">
                         {areas?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                      </SelectContent>
                   </Select>
                   {errors.areaId && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.areaId.message as string}</p>}
                 </div>

                 <div className="grid grid-cols-3 md:col-span-2 gap-4">
                    <div className="space-y-1.5 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.block')}</Label>
                       <Input {...register('block')} className="h-10 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                    </div>
                    <div className="space-y-1.5 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.street')}</Label>
                       <Input {...register('street')} className="h-10 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                    </div>
                    <div className="space-y-1.5 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.house')}</Label>
                       <Input {...register('houseNumber')} className="h-10 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-4">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-start">{isRtl ? 'الموقع الجغرافي (GPS)' : 'GPS Location'}</Label>
                 <Button 
                   type="button"
                   onClick={() => setIsMapOpen(true)}
                   className="h-32 w-full rounded-[2rem] border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 text-blue-600 font-black flex flex-col gap-3 transition-all group shadow-inner"
                 >
                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                       <LocateFixed className="h-6 w-6" />
                    </div>
                    {isRtl ? 'تحديد الموقع من الخريطة' : 'Locate on Map Radar'}
                 </Button>
                 {locationUrl && (
                    <p className="text-[9px] font-mono text-slate-400 text-center truncate px-4">{locationUrl}</p>
                 )}
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-6">
        <Button 
          type="submit" 
          disabled={loading || generating} 
          className="h-12 rounded-xl px-24 bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-4 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {initialData ? tSafe('common.saveChanges', 'حفظ التعديلات', 'Save Changes') : tSafe('common.confirm', 'تأكيد وحفظ العميل', 'Confirm & Save')}
        </Button>
      </div>

      <LocationPickerDialog 
        isOpen={isMapOpen} 
        onClose={() => setIsMapOpen(false)}
        onSelect={(url) => setValue('locationUrl', url)}
        initialUrl={watch('locationUrl')}
      />
    </form>
  );
}
