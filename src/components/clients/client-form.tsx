
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  UserPlus, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Save,
  Loader2,
  Globe,
  Navigation,
  Map as MapIcon,
  CheckCircle2
} from "lucide-react";
import { Client } from '@/types/client';
import { Employee } from '@/types/hr';
import { Governorate, Area } from '@/types/reference';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

// استيراد الخريطة ديناميكياً لتجنب مشاكل الـ SSR
import dynamic from 'next/dynamic';
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const useMapEvents = dynamic(() => import('react-leaflet').then(mod => mod.useMapEvents), { ssr: false });

const clientSchema = z.object({
  fileNumber: z.string().min(1, "رقم الملف مطلوب"),
  nameAr: z.string().min(3, "الاسم بالعربي مطلوب"),
  nameEn: z.string().optional(),
  mobile: z.string().min(8, "رقم الهاتف غير صحيح"),
  email: z.string().email().optional().or(z.literal('')),
  civilId: z.string().optional(),
  governorateId: z.string().optional(),
  governorateName: z.string().optional(),
  areaId: z.string().optional(),
  areaName: z.string().optional(),
  block: z.string().optional(),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  locationUrl: z.string().url("يجب إدخال رابط صحيح").optional().or(z.literal('')),
  assignedEngineerId: z.string().optional(),
  assignedEngineerName: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

interface Props {
  initialData?: Client;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function ClientForm({ initialData, onSubmit, loading }: Props) {
  const { dir, lang, t } = useLanguage();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  
  const empsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.employees(companyId)), orderBy('fullName')) : null, 
  [db, companyId]);
  
  const { data: governorates } = useCollection<Governorate>(govsQuery);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const form = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || {
      fileNumber: '', nameAr: '', nameEn: '', mobile: '', email: '', civilId: '',
      governorateId: '', governorateName: '', areaId: '', areaName: '',
      block: '', street: '', houseNumber: '', locationUrl: '',
      assignedEngineerId: '', assignedEngineerName: '', source: '', notes: '',
    }
  });

  const selectedGovId = form.watch('governorateId');
  const areasQuery = useMemo(() => 
    companyId && db && selectedGovId ? query(collection(db, paths.areas(companyId, selectedGovId)), orderBy('name')) : null, 
  [db, companyId, selectedGovId]);
  const { data: areas } = useCollection<Area>(areasQuery);

  const handleGovChange = (id: string) => {
    const gov = governorates?.find(g => g.id === id);
    form.setValue('governorateId', id);
    form.setValue('governorateName', gov ? (isRtl ? gov.name : gov.nameEn) : '');
    form.setValue('areaId', '');
    form.setValue('areaName', '');
  };

  const handleAreaChange = (id: string) => {
    const area = areas?.find(a => a.id === id);
    form.setValue('areaId', id);
    form.setValue('areaName', area ? (isRtl ? area.name : area.nameEn) : '');
  };

  // مكون التقاط الإحداثيات من الخريطة
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setSelectedCoords([e.latlng.lat, e.latlng.lng]);
      },
    });
    return selectedCoords ? <Marker position={selectedCoords} /> : null;
  };

  const applyMapSelection = () => {
    if (selectedCoords) {
      const [lat, lng] = selectedCoords;
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      form.setValue('locationUrl', url);
      setIsMapOpen(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20" dir={dir}>
      
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-primary/5 p-8 border-b flex items-center justify-between">
           <div className="text-start">
              <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'الهوية والبيانات الأساسية' : 'Basic Identity'}</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? 'المعلومات الجوهرية لفتح ملف العميل' : 'Core client profile info'}</p>
           </div>
           <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border">
              <UserPlus className="h-6 w-6" />
           </div>
        </div>
        <CardContent className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-start">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الملف' : 'File Number'}</Label>
              <Input {...form.register('fileNumber')} className="h-14 rounded-2xl border-2 font-mono text-lg font-black" placeholder="C-1001" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الاسم بالكامل' : 'Full Name'}</Label>
              <Input {...form.register('nameAr')} className="h-14 rounded-2xl border-2 text-lg font-black" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-50 text-start">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الهاتف' : 'Mobile'}</Label>
                <Input {...form.register('mobile')} className="h-14 rounded-2xl border-2 text-lg font-black" />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'البريد الإلكتروني' : 'Email'}</Label>
                <Input {...form.register('email')} className="h-14 rounded-2xl border-2 text-start" dir="ltr" />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الرقم المدني' : 'Civil ID'}</Label>
                <Input {...form.register('civilId')} maxLength={12} className="h-14 rounded-2xl border-2 font-mono text-lg" />
             </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="bg-blue-50/50 p-8 border-b flex items-center justify-between">
           <div className="text-start">
              <h3 className="text-xl font-black font-headline text-slate-800">{isRtl ? 'الموقع الجغرافي والعنوان' : 'Geographic Location'}</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">{isRtl ? 'تحديد موقع القسيمة أو المشروع المرتبط' : 'Locate plot or project site'}</p>
           </div>
           <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border">
              <MapPin className="h-6 w-6" />
           </div>
        </div>
        <CardContent className="p-10 space-y-10 text-start">
           
           <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="flex-1 space-y-2 w-full">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Navigation className="h-3 w-3 text-primary" /> {isRtl ? 'رابط خرائط جوجل' : 'Google Maps Link'}
                    </Label>
                    <Input 
                      {...form.register('locationUrl')} 
                      className="h-14 rounded-2xl border-2 font-mono text-xs text-blue-600 bg-white" 
                      placeholder="https://maps.google.com/..." 
                    />
                 </div>
                 
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-[10px] font-black text-slate-400 uppercase hidden md:block">{isRtl ? 'أو' : 'OR'}</span>
                    
                    <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
                       <DialogTrigger asChild>
                          <Button type="button" className="h-14 rounded-2xl bg-slate-900 text-white font-black px-8 gap-3 shadow-xl hover:scale-105 transition-all w-full md:w-auto">
                             <MapIcon className="h-5 w-5 text-primary" />
                             {isRtl ? 'تحديد من الخريطة' : 'Pick on Map'}
                          </Button>
                       </DialogTrigger>
                       <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl">
                          <div className="bg-slate-900 p-8 text-white text-start">
                             <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                                <MapIcon className="h-7 w-7 text-primary" />
                                {isRtl ? 'محدد المواقع التفاعلي' : 'Interactive Map Picker'}
                             </DialogTitle>
                             <p className="text-slate-400 font-bold mt-1">{isRtl ? 'اضغط على الموقع في الخريطة لتحديده آلياً.' : 'Click anywhere on the map to set location.'}</p>
                          </div>
                          
                          <div className="h-[500px] w-full bg-slate-100 relative">
                             {/* عرض الخريطة فقط في بيئة المتصفح */}
                             {typeof window !== 'undefined' && (
                               <MapContainer 
                                 center={[29.3759, 47.9774]} 
                                 zoom={11} 
                                 style={{ height: '100%', width: '100%' }}
                               >
                                 <TileLayer
                                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                 />
                                 <LocationMarker />
                               </MapContainer>
                             )}
                          </div>

                          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
                             <Button type="button" variant="outline" onClick={() => setIsMapOpen(false)} className="flex-1 h-14 rounded-xl border-2 font-bold">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
                             <Button 
                               type="button" 
                               onClick={applyMapSelection} 
                               disabled={!selectedCoords}
                               className="flex-[2] h-14 rounded-xl bg-primary text-white font-black gap-2 shadow-lg"
                             >
                                <CheckCircle2 className="h-5 w-5" />
                                {isRtl ? 'اعتماد الموقع المختار' : 'Confirm Location'}
                             </Button>
                          </DialogFooter>
                       </DialogContent>
                    </Dialog>
                 </div>
              </div>
              <p className="text-[9px] text-slate-400 font-bold italic">{isRtl ? '* يمكنك لصق الرابط يدوياً أو استخدام الخريطة لتوليد الرابط آلياً.' : '* Paste link manually or use the interactive picker.'}</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المحافظة' : 'Governorate'}</Label>
                 <Select value={form.watch('governorateId')} onValueChange={handleGovChange}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 font-black"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                       {governorates?.map(g => <SelectItem key={g.id} value={g.id!} className="font-bold">{isRtl ? g.name : g.nameEn}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المنطقة' : 'Area'}</Label>
                 <Select value={form.watch('areaId')} onValueChange={handleAreaChange} disabled={!selectedGovId}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 font-black"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                       {areas?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-slate-50">
              {['block', 'street', 'houseNumber'].map((field) => (
                <div key={field} className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {isRtl ? (field === 'block' ? 'القطعة' : field === 'street' ? 'الشارع' : 'قسيمة/منزل') : field}
                   </Label>
                   <Input {...form.register(field as any)} className="h-12 rounded-xl border-2 font-bold" />
                </div>
              ))}
           </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={loading}
          className="h-20 rounded-[2.5rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
          {isRtl ? 'حفظ ملف العميل' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
