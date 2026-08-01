'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  HardHat, Save, Loader2, ArrowRight,
  MapPin, Camera, Users, Target,
  Plus, CheckCircle2, Navigation, Trash2,
  Truck, Hammer, Sparkles
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisitService } from '@/services/field-visit-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LaborDetail, EquipmentUsed } from '@/types/documents';

export default function NewFieldVisitPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    projectId: '',
    clientId: '',
    clientName: '',
    boqItemId: '',
    technicalStageId: '',
    visitDate: new Date().toISOString().split('T')[0],
    progressPercentage: 0,
    completedWork: '',
    issues: '',
    gpsLocation: null as any
  });
  
  const [laborDetails, setLaborDetails] = useState<LaborDetail[]>([{ trade: '', count: 1 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<EquipmentUsed[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const transQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactions(companyId)), orderBy('transactionNumber')) : null, [db, companyId]);
  const { data: transactions } = useCollection<any>(transQuery);

  const inventoryQuery = useMemo(() => companyId && db ? query(collection(db, paths.inventoryItems(companyId)), where('isActive', '==', true)) : null, [db, companyId]);
  const { data: inventory } = useCollection<any>(inventoryQuery);
  const equipmentItems = useMemo(() => (inventory || []).filter((i:any) => i.category === 'EQUIPMENT'), [inventory]);

  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  const handleProjectChange = async (projectId: string) => {
    if (!db || !companyId) return;
    
    const selectedTrans = transactions?.find(t => t.id === projectId);
    
    setFormData({ 
      ...formData, 
      projectId, 
      clientId: selectedTrans?.clientId || '',
      clientName: selectedTrans?.clientName || '',
      boqItemId: '', 
      technicalStageId: '' 
    });
    
    const boqsSnap = await getDocs(query(collection(db, paths.boqs(companyId)), where('transactionId', '==', projectId)));
    if (!boqsSnap.empty) {
      const boqId = boqsSnap.docs[0].id;
      const itemsSnap = await getDocs(collection(db, paths.boqItems(companyId, boqId)));
      setBoqItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    
    const stagesSnap = await getDocs(collection(db, paths.transactionStages(companyId, projectId)));
    setStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData({ ...formData, gpsLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } });
        toast({ title: isRtl ? "تم تحديد الموقع" : "GPS Locked" });
      },
      () => toast({ variant: "destructive", title: "GPS Error" })
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !companyId) return;
    setUploading(true);
    const storage = getStorage();
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storageRef = ref(storage, `fieldVisits/${companyId}/${Date.now()}_${file.name}`);
      try {
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        newUrls.push(url);
      } catch (err) {}
    }
    setPhotoUrls([...photoUrls, ...newUrls]);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !companyId || !user || !formData.projectId) return;

    setLoading(true);
    try {
      const service = new FieldVisitService(db, companyId);
      const selectedBOQ = boqItems.find(i => i.id === formData.boqItemId);
      const totalWorkers = laborDetails.reduce((acc, l) => acc + l.count, 0);

      await service.createFieldVisit(formData.projectId, {
        ...formData,
        engineerName: globalUser?.fullName || user.displayName || 'Engineer',
        engineerId: user.uid,
        workersCount: totalWorkers,
        laborDetails,
        equipmentUsed,
        photoUrls,
        boqItemName: selectedBOQ?.referenceTitle || ''
      }, user.uid);

      toast({ title: isRtl ? "تم إرسال التقرير بنجاح" : "Report Submitted" });
      router.push('/dashboard/construction/field-visits');
    } catch (error) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in slide-in-from-bottom-6 duration-700 bg-[#fdfaf3]" dir={dir}>
      <div className="flex items-center gap-4 border-b-2 border-primary/20 pb-6 px-4 pt-4">
        <Button variant="ghost" onClick={() => router.back()} className="h-10 w-10 p-0 rounded-xl bg-white border-2 text-slate-400">
          <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
           <h1 className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'تقرير إنجاز ميداني متكامل' : 'Sovereign Field Log'}</h1>
           <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Field Progress & Resource Allocation</p>
        </div>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 mx-4">
        <form onSubmit={handleSubmit}>
          <CardHeader className="bg-primary/5 p-8 border-b text-slate-900 text-start">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg"><HardHat className="h-6 w-6" /></div>
                <CardTitle className="text-xl font-black flex items-center gap-3">
                   {isRtl ? 'توثيق البيانات والموارد' : 'Field Data & Resources'}
                </CardTitle>
             </div>
          </CardHeader>
          <CardContent className="p-8 space-y-10 text-start">
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                   <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المشروع' : 'Project'}</Label>
                   <Select value={formData.projectId} onValueChange={handleProjectChange}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-2 shadow-2xl">
                         {transactions?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold py-3">{p.subServiceName} - {p.transactionNumber}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ الزيارة' : 'Visit Date'}</Label>
                   <SmartDateInput value={formData.visitDate} onChange={v => setFormData({...formData, visitDate: v})} />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-slate-100">
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <Label className="text-[12px] font-black uppercase text-primary flex items-center gap-2"><Users className="h-4 w-4" /> {isRtl ? 'العمالة والمهن' : 'Labor Trades'}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1 }])} className="h-8 rounded-lg font-black text-[10px] gap-2 border-2"><Plus className="h-3.5 w-3.5" /> {isRtl ? 'إضافة' : 'Add'}</Button>
                   </div>
                   <div className="space-y-3">
                      {laborDetails.map((l, i) => (
                        <div key={i} className="flex gap-2 items-center animate-in slide-in-from-top-1">
                           <Input placeholder={isRtl ? "التخصص" : "Trade"} value={l.trade} onChange={e => { const nl = [...laborDetails]; nl[i].trade = e.target.value; setLaborDetails(nl); }} className="h-10 rounded-xl border-2 text-xs font-bold" />
                           <Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-10 w-24 rounded-xl border-2 text-center font-black text-slate-700" />
                           {laborDetails.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} className="h-10 w-10 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <Label className="text-[12px] font-black uppercase text-secondary flex items-center gap-2"><Truck className="h-4 w-4" /> {isRtl ? 'المعدات والآليات' : 'Equipment'}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', name: '', hoursUsed: 1 }])} className="h-8 rounded-lg font-black text-[10px] gap-2 border-2"><Plus className="h-3.5 w-3.5" /> {isRtl ? 'إضافة' : 'Add'}</Button>
                   </div>
                   <div className="space-y-3">
                      {equipmentUsed.map((e, i) => (
                        <div key={i} className="flex gap-2 items-center animate-in slide-in-from-top-1">
                           <Select value={e.equipmentId} onValueChange={v => { const item = equipmentItems.find(x => x.id === v); const ne = [...equipmentUsed]; ne[i].equipmentId = v; ne[i].name = item?.name || ''; setEquipmentUsed(ne); }}>
                              <SelectTrigger className="h-10 rounded-xl border-2 text-xs font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                              <SelectContent className="rounded-xl">{equipmentItems.map((item:any) => <SelectItem key={item.id} value={item.id!} className="font-bold text-xs">{item.name}</SelectItem>)}</SelectContent>
                           </Select>
                           <Input type="number" value={e.hoursUsed} onChange={val => { const ne = [...equipmentUsed]; ne[i].hoursUsed = Number(val.target.value); setEquipmentUsed(ne); }} className="h-10 w-24 rounded-xl border-2 text-center font-black text-slate-700" />
                           <Button type="button" variant="ghost" size="icon" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} className="h-10 w-10 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-primary/20 grid grid-cols-1 md:grid-cols-2 gap-10 items-end">
                <div className="space-y-2 text-start">
                   <Label className="text-[11px] font-black uppercase text-primary flex items-center gap-2 tracking-widest"><Target className="h-4 w-4" /> {isRtl ? 'نسبة الإنجاز %' : 'Progress %'}</Label>
                   <Input type="number" value={formData.progressPercentage} onChange={e => setFormData({...formData, progressPercentage: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-3xl text-center bg-white shadow-inner text-primary" />
                </div>
                <Button type="button" onClick={handleGetGPS} variant={formData.gpsLocation ? "secondary" : "outline"} className={cn("h-14 rounded-2xl font-black gap-3 transition-all text-xs border-2 shadow-sm", formData.gpsLocation ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-secondary border-secondary/20")}>
                   <Navigation className="h-5 w-5" /> {formData.gpsLocation ? (isRtl ? "الموقع مثبت" : "GPS Locked") : (isRtl ? "تثبيت الإحداثيات" : "Lock GPS")}
                </Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-2">
                   <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الأعمال المنجزة اليوم' : 'Work Done Today'}</Label>
                   <Textarea value={formData.completedWork} onChange={e => setFormData({...formData, completedWork: e.target.value})} className="min-h-[120px] rounded-[1.5rem] border-2 p-5 text-sm font-bold bg-slate-50/50" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الملاحظات والعوائق' : 'Issues & Notes'}</Label>
                   <Textarea value={formData.issues} onChange={e => setFormData({...formData, issues: e.target.value})} className="min-h-[120px] rounded-[1.5rem] border-2 p-5 text-sm font-bold text-destructive bg-rose-50/20" />
                </div>
             </div>

             <div className="space-y-4 pt-8 border-t">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> {isRtl ? 'الأرشفة البصرية (الصور)' : 'Visual Archive'}</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                   {photoUrls.map((url, idx) => (
                     <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-xl ring-1 ring-black/5 animate-in zoom-in-95"><img src={url} alt="Site" className="h-full w-full object-cover" /><button type="button" onClick={() => setPhotoUrls(photoUrls.filter((_, i) => i !== idx))} className="absolute top-2 right-2 h-8 w-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-lg"><Trash2 className="h-4 w-4" /></button></div>
                   ))}
                   <label className="aspect-square rounded-[2rem] border-4 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-primary/40 transition-all group">
                      {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Plus className="h-8 w-8 text-slate-300 group-hover:text-primary transition-colors" />}
                      <span className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest group-hover:text-primary">Upload</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                   </label>
                </div>
             </div>

             <Button type="submit" disabled={loading || !formData.projectId} className="w-full h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 mt-6 border-b-8 border-orange-700">
                {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Save className="h-8 w-8" />}
                {isRtl ? 'اعتماد وإرسال التقرير' : 'Commit Site Log'}
             </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
