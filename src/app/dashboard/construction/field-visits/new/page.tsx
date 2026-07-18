'use client';

import { useState, useMemo } from 'react';
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
  Plus, CheckCircle2, Navigation, Trash2
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
    boqItemId: '',
    technicalStageId: '',
    visitDate: new Date().toISOString().split('T')[0],
    progressPercentage: 0,
    workersCount: 1,
    completedWork: '',
    issues: '',
    gpsLocation: null as any
  });
  
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const transQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactions(companyId)), orderBy('transactionNumber')) : null, [db, companyId]);
  const { data: transactions } = useCollection<any>(transQuery);

  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  const handleProjectChange = async (projectId: string) => {
    if (!db || !companyId) return;
    setFormData({ ...formData, projectId, boqItemId: '', technicalStageId: '' });
    
    // جلب المقايسة المرتبطة
    const boqsSnap = await getDocs(query(collection(db, paths.boqs(companyId)), where('transactionId', '==', projectId)));
    if (!boqsSnap.empty) {
      const boqId = boqsSnap.docs[0].id;
      const itemsSnap = await getDocs(collection(db, paths.boqItems(companyId, boqId)));
      setBoqItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    
    // جلب مراحل التنفيذ
    const stagesSnap = await getDocs(collection(db, paths.transactionStages(companyId, projectId)));
    setStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData({ ...formData, gpsLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } });
        toast({ title: isRtl ? "تم تحديد الموقع بنجاح" : "Location Locked" });
      },
      () => toast({ variant: "destructive", title: isRtl ? "فشل تحديد الموقع" : "GPS Failed" })
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
      } catch (err) {
        console.error("Upload error", err);
      }
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
      const selectedProj = transactions?.find(p => p.id === formData.projectId);
      const selectedBOQ = boqItems.find(i => i.id === formData.boqItemId);

      await service.createFieldVisit(formData.projectId, {
        ...formData,
        engineerName: user.displayName || 'Engineer',
        engineerId: user.uid,
        photoUrls,
        boqItemName: selectedBOQ?.referenceTitle || ''
      }, user.uid);

      toast({ title: isRtl ? "تم رفع تقرير الزيارة بنجاح" : "Site Report Submitted" });
      router.push('/dashboard/construction/field-visits');
    } catch (error) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in slide-in-from-bottom-6 duration-700" dir={dir}>
      <div className="flex items-center gap-4 border-b pb-6">
        <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقرير إنجاز ميداني' : 'Field Progress Report'}</h1>
           <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Sovereign Construction Log</p>
        </div>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <form onSubmit={handleSubmit}>
          <CardHeader className="bg-[#1e1b4b] p-8 text-white">
             <CardTitle className="text-xl font-black flex items-center gap-3">
                <HardHat className="h-6 w-6 text-primary" />
                {isRtl ? 'توثيق البيانات الميدانية' : 'Field Data Documentation'}
             </CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-10 text-start">
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المشروع المستهدف' : 'Target Project'}</Label>
                   <Select value={formData.projectId} onValueChange={handleProjectChange}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {transactions?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold">{p.subServiceName} - {p.transactionNumber}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ الزيارة' : 'Visit Date'}</Label>
                   <SmartDateInput value={formData.visitDate} onChange={v => setFormData({...formData, visitDate: v})} />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'بند العمل (BOQ Item)' : 'BOQ Work Item'}</Label>
                   <Select disabled={!formData.projectId} value={formData.boqItemId} onValueChange={v => setFormData({...formData, boqItemId: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {boqItems.map(i => <SelectItem key={i.id} value={i.id} className="font-bold">{i.referenceTitle}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'مرحلة التنفيذ' : 'Execution Stage'}</Label>
                   <Select disabled={!formData.projectId} value={formData.technicalStageId} onValueChange={v => setFormData({...formData, technicalStageId: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {stages.map(s => <SelectItem key={s.id} value={s.technicalStageId} className="font-bold">{s.name}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/20 grid grid-cols-1 md:grid-cols-3 gap-8 items-end relative overflow-hidden">
                <div className="space-y-2 text-start relative z-10">
                   <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                      <Target className="h-3 w-3" /> {isRtl ? 'نسبة الإنجاز %' : 'Progress %'}
                   </Label>
                   <Input type="number" value={formData.progressPercentage} onChange={e => setFormData({...formData, progressPercentage: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-2xl text-center bg-white" />
                </div>
                <div className="space-y-2 text-start relative z-10">
                   <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                      <Users className="h-3 w-3" /> {isRtl ? 'عدد العمالة' : 'Labor Count'}
                   </Label>
                   <Input type="number" value={formData.workersCount} onChange={e => setFormData({...formData, workersCount: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-2xl text-center bg-white" />
                </div>
                <div className="text-center relative z-10">
                   <Button 
                    type="button" 
                    onClick={handleGetGPS}
                    variant={formData.gpsLocation ? "secondary" : "outline"}
                    className={cn(
                      "h-14 w-full rounded-2xl font-black gap-2 transition-all",
                      formData.gpsLocation ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "border-2 border-blue-100 text-blue-600"
                    )}
                   >
                      <Navigation className="h-5 w-5" />
                      {formData.gpsLocation ? (isRtl ? "الموقع مثبت" : "GPS Locked") : (isRtl ? "تثبيت الإحداثيات" : "Lock GPS")}
                   </Button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الأعمال المنجزة فعلياً' : 'Completed Work'}</Label>
                   <Textarea value={formData.completedWork} onChange={e => setFormData({...formData, completedWork: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-4 text-xs font-bold" placeholder="..." />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'عوائق أو مشاكل واجهتكم' : 'Issues / Obstacles'}</Label>
                   <Textarea value={formData.issues} onChange={e => setFormData({...formData, issues: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-4 text-xs font-bold text-rose-600" placeholder="..." />
                </div>
             </div>

             <div className="space-y-4 pt-6 border-t">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                   <Camera className="h-4 w-4 text-primary" /> {isRtl ? 'توثيق الصور الميدانية' : 'Site Documentation Photos'}
                </Label>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                   {photoUrls.map((url, idx) => (
                     <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-lg ring-1 ring-black/5">
                        <img src={url} alt="Site" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setPhotoUrls(photoUrls.filter((_, i) => i !== idx))} className="absolute top-2 right-2 h-6 w-6 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-lg"><Trash2 className="h-3 w-3" /></button>
                     </div>
                   ))}
                   <label className="aspect-square rounded-2xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                      {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Plus className="h-6 w-6 text-slate-300" />}
                      <span className="text-[8px] font-black text-slate-400 mt-2 uppercase">{isRtl ? 'رفع صور' : 'Upload'}</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                   </label>
                </div>
             </div>

             <Button 
               type="submit" 
               disabled={loading || !formData.projectId}
               className="w-full h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700 mt-4"
             >
                {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Save className="h-8 w-8" />}
                {isRtl ? 'إرسال التقرير الميداني' : 'Submit Field Report'}
             </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
