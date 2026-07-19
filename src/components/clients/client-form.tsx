
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
  RefreshCw, Mail, Fingerprint, MapPinned,
  Search, Globe, Briefcase, ShieldCheck
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

export function ClientForm({ initialData, onSubmit, loading }: { initialData?: any, onSubmit: (data: any) => void, loading?: boolean }) {
  const { dir, lang, t } = useLanguage();
  const { globalUser } = useAuthContext();
  const { isAdmin } = usePermissions();
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
      locationUrl: '',
      assignedEngineerId: globalUser?.employeeId || '',
      assignedEngineerName: globalUser?.username || ''
    }
  });

  const [generating, setGenerating] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  const selectedGovId = form.watch('governorateId');
  const selectedAreaId = form.watch('areaId');
  const assignedEngineerId = form.watch('assignedEngineerId');

  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGovId ? query(collection(db, paths.areas(companyId, selectedGovId)), orderBy('order')) : null, [db, companyId, selectedGovId]);
  const empsQuery = useMemo(() => companyId && db ? query(collection(db, paths.employees(companyId)), where('isActive', '==', true)) : null, [db, companyId]);

  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: areas } = useCollection<Area>(areasQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  // حصر قائمة الموظفين في "المهندسين" فقط لغرض التعيين
  const engineers = useMemo(() => {
    return (employees || []).filter(e => e.departmentName?.includes('معماري') || e.departmentName?.includes('Arch'));
  }, [employees]);

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

  useEffect(() => {
    if (assignedEngineerId && engineers) {
      const eng = engineers.find(e => e.id === assignedEngineerId);
      if (eng) form.setValue('assignedEngineerName', eng.fullName);
    }
  }, [assignedEngineerId, engineers, form]);

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

          {/* التعيين السيادي: يظهر للمدير فقط أو عند تسجيل موظف لعميل */}
          <div className="pt-6 border-t border-slate-50">
             <div className="bg-orange-50/50 p-6 rounded-3xl border-2 border-orange-100 flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center gap-4 shrink-0">
                   <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-[#e87c24] shadow-sm border border-orange-100">
                      <Briefcase className="h-6 w-6" />
                   </div>
                   <div className="text-start">
                      <h4 className="font-black text-sm text-slate-800">{isRtl ? 'المهندس المختص' : 'Assigned Engineer'}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{isRtl ? 'تحديد المسؤولية المعلوماتية للعميل' : 'Client Access Scope Assignment'}</p>
                   </div>
                </div>
                
                <div className="flex-1 w-full">
                   <Select 
                     disabled={!isAdmin} 
                     value={assignedEngineerId} 
                     onValueChange={(v) => form.setValue('assignedEngineerId', v)}
                   >
                      <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-bold">
                         <SelectValue placeholder={isRtl ? "اختر المهندس المسؤول..." : "Assign responsible engineer..."} />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-0 shadow-2xl">
                         {engineers.map(eng => (
                           <SelectItem key={eng.id} value={eng.id!} className="font-bold py-3">
                              {eng.fullName}
                           </SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>

                {!isAdmin && (
                  <Badge className="bg-[#1e1b4b] text-white border-0 font-black text-[9px] px-4 py-2 rounded-xl uppercase shrink-0 gap-2">
                     <ShieldCheck className="h-3 w-3 text-primary" />
                     {isRtl ? 'ربط تلقائي بالمسؤول' : 'Auto-Assigned'}
                  </Badge>
                )}
             </div>
          </div>
        </CardContent>
      </Card>

      {/* القسم الثاني: الموقع الجغرافي المطور */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <div className="bg-blue-50/30 p-6 border-b flex items-center justify-between">
           <h3 className="text-base font-black font-headline text-slate-800">{isRtl ? 'رادار الموقع والعنوان الذكي' : 'Smart Location Radar'}</h3>
           <MapPinned className="h-5 w-5 text-blue-600" />
        </div>
        <CardContent className="p-8 space-y-10">
           <div className="p-10 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-blue-100 relative">
              <Label className="absolute top-4 right-10 text-[10px] font-black uppercase text-blue-400 tracking-[0.1em]">
                {isRtl ? 'رابط الموقع (GOOGLE MAPS)' : 'Google Maps Link'}
              </Label>
              <div className={cn("flex items-center gap-4 pt-4", isRtl ? "flex-row-reverse" : "flex-row")}>
                 <Button 
                   type="button"
                   onClick={() => setIsMapOpen(true)}
                   className="h-14 px-8 rounded-2xl bg-[#1e1b4b] text-white font-black text-sm gap-3 hover:bg-slate-800 transition-all shadow-2xl shadow-indigo-900/20 shrink-0"
                 >
                    <Search className="h-5 w-5 text-[#e87c24]" />
                    {isRtl ? 'فتح الخريطة والبحث' : 'Open Map & Search'}
                 </Button>
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

           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4">
              <div className="space-y-2 text-start">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المحافظة</Label>
                <Select value={selectedGovId} onValueChange={(v) => { form.setValue('governorateId', v); form.setValue('areaId', ''); }}>
                   <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      {governorates?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-start">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المنطقة</Label>
                <Select disabled={!selectedGovId} value={selectedAreaId} onValueChange={(v) => form.setValue('areaId', v)}>
                   <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/30"><SelectValue placeholder="..." /></SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      {areas?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 md:col-span-2 gap-4">
                 <div className="space-y-2 text-start">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">القطعة</Label>
                    <Input {...form.register('block')} className="h-12 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                 </div>
                 <div className="space-y-2 text-start">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الشارع</Label>
                    <Input {...form.register('street')} className="h-12 rounded-xl border-2 font-bold text-center bg-slate-50/30" />
                 </div>
                 <div className="space-y-2 text-start">
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
          className="h-20 rounded-[2.5rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
          {initialData ? (isRtl ? 'تحديث السجل المرجعي' : 'Update Global Record') : (isRtl ? 'حفظ ملف العميل' : 'Confirm Registration')}
        </Button>
      </div>

      <LocationPickerDialog 
        isOpen={isMapOpen} 
        onClose={() => setIsMapOpen(false)}
        onSelect={handleLocationSelect}
        initialUrl={form.watch('locationUrl')}
      />
    </form>
  );
}
