'use client';

import { useState, useMemo, useEffect } from 'react';
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
  CheckCircle2,
  Search,
  RefreshCw,
  Compass,
  LocateFixed,
  Link as LinkIcon
} from "lucide-react";
import { Client } from '@/types/client';
import { Governorate, Area } from '@/types/reference';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ClientService } from '@/services/client-service';
import { toast } from '@/hooks/use-toast';

// استيراد الخريطة ديناميكياً لتجنب مشاكل الـ SSR
import dynamic from 'next/dynamic';
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const useMapEvents = dynamic(() => import('react-leaflet').then(mod => mod.useMapEvents), { ssr: false });
const MapUpdater = dynamic(() => import('react-leaflet').then(mod => {
  return function Updater({ center }: { center: [number, number] }) {
    const map = mod.useMap();
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
  };
}), { ssr: false });

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
  const [mapCenter, setMapCenter] = useState<[number, number]>([29.3759, 47.9774]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [generatingNum, setGeneratingNum] = useState(false);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  
  const { data: governorates } = useCollection<Governorate>(govsQuery);

  const form = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || {
      fileNumber: '', nameAr: '', nameEn: '', mobile: '', email: '', civilId: '',
      governorateId: '', governorateName: '', areaId: '', areaName: '',
      block: '', street: '', houseNumber: '', locationUrl: '',
      assignedEngineerId: '', assignedEngineerName: '', source: '', notes: '',
    }
  });

  const locationUrl = form.watch('locationUrl');

  useEffect(() => {
    async function autoGen() {
      if (!initialData && db && companyId && !form.getValues('fileNumber')) {
        setGeneratingNum(true);
        const service = new ClientService(db, companyId);
        const nextNum = await service.getNextFileNumber();
        form.setValue('fileNumber', nextNum);
        setGeneratingNum(false);
      }
    }
    autoGen();
  }, [db, companyId, initialData, form]);

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

  const handleMapSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", Kuwait")}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newCoords: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setMapCenter(newCoords);
        setSelectedCoords(newCoords);
      } else {
        toast({ variant: "destructive", title: isRtl ? "لم يتم العثور على الموقع" : "Location not found" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
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
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم الملف (تلقائي)' : 'File Number (Auto)'}</Label>
              <div className="relative">
                 <Input 
                   {...form.register('fileNumber')} 
                   readOnly 
                   className="h-14 rounded-2xl border-2 font-mono text-lg font-black bg-slate-50 cursor-not-allowed text-primary" 
                   placeholder="C-0001/2026" 
                 />
                 {generatingNum && <RefreshCw className="absolute end-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary/30" />}
              </div>
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

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
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
           
           {/* Smart Location Input Area */}
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                 <div className={cn(
                   "relative p-6 rounded-[2.5rem] transition-all border-2 flex items-center gap-6 group overflow-hidden shadow-inner",
                   locationUrl ? "bg-blue-50/50 border-blue-200" : "bg-slate-50 border-slate-100"
                 )}>
                    <div className={cn(
                      "h-16 w-16 rounded-3xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                      locationUrl ? "bg-blue-600 text-white shadow-xl shadow-blue-200" : "bg-white text-slate-300 shadow-sm border"
                    )}>
                       {locationUrl ? <LocateFixed className="h-8 w-8 animate-pulse" /> : <Compass className="h-8 w-8" />}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                          <LinkIcon className="h-3 w-3" /> {isRtl ? 'رابط الموقع المستهدف' : 'Target Location URL'}
                       </Label>
                       <Input 
                         {...form.register('locationUrl')} 
                         className="h-10 border-0 bg-transparent p-0 font-mono text-xs text-blue-700 font-bold focus-visible:ring-0 focus-visible:ring-offset-0 truncate" 
                         placeholder={isRtl ? "الصق الرابط هنا أو حدد من الخريطة..." : "Paste URL or use picker..."} 
                       />
                       {locationUrl && (
                         <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase tracking-tighter">
                            <CheckCircle2 className="h-3 w-3" /> {isRtl ? 'تم التقاط الإحداثيات بنجاح' : 'Coordinates Locked'}
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-4">
                 <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
                    <DialogTrigger asChild>
                       <Button type="button" className="w-full h-20 rounded-[2rem] bg-slate-900 text-white font-black text-xl shadow-2xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4">
                          <MapIcon className="h-8 w-8 text-primary" />
                          {isRtl ? 'تحديد من الخريطة' : 'Map Picker'}
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl">
                       <div className="bg-slate-900 p-8 text-white text-start">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                             <div>
                                <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                                   <MapIcon className="h-7 w-7 text-primary" />
                                   {isRtl ? 'محدد المواقع التفاعلي' : 'Interactive Map Picker'}
                                </DialogTitle>
                                <p className="text-slate-400 font-bold mt-1">{isRtl ? 'ابحث عن العنوان أو اضغط على الخريطة.' : 'Search address or click on map.'}</p>
                             </div>
                             
                             <div className="relative w-full md:w-80">
                                <Input 
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleMapSearch()}
                                  placeholder={isRtl ? "ابحث عن منطقة، قطعة..." : "Search area, block..."}
                                  className="h-12 rounded-xl bg-white/10 border-white/20 text-white ps-10 font-bold"
                                />
                                <button 
                                  onClick={handleMapSearch}
                                  disabled={searching}
                                  className="absolute start-3 top-1/2 -translate-y-1/2 text-primary"
                                >
                                   {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </button>
                             </div>
                          </div>
                       </div>
                       
                       <div className="h-[500px] w-full bg-slate-100 relative">
                          {typeof window !== 'undefined' && (
                            <MapContainer 
                              center={mapCenter} 
                              zoom={12} 
                              style={{ height: '100%', width: '100%' }}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <MapUpdater center={mapCenter} />
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
          disabled={loading || generatingNum}
          className="h-20 rounded-[2.5rem] px-16 bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-orange-700"
        >
          {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
          {isRtl ? 'حفظ ملف العميل' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
