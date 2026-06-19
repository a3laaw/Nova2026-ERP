'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MapPin, MapPinned, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { LocationService } from '@/services/location-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Governorate, Area } from '@/types/reference';
import { translateText } from '@/ai/flows/translate-flow';

export default function GeoPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedGov, setSelectedGov] = useState<Governorate | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [govForm, setGovForm] = useState<Partial<Governorate>>({ name: '', nameEn: '' });
  const [areaForm, setAreaForm] = useState<Partial<Area>>({ name: '', nameEn: '' });

  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const lastEditedField = useRef<'name' | 'nameEn' | null>(null);

  const locationService = useMemo(() => db && companyId ? new LocationService(db, companyId) : null, [db, companyId]);
  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId))) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGov?.id ? query(collection(db, paths.areas(companyId, selectedGov.id))) : null, [db, companyId, selectedGov]);

  const { data: governorates, loading: govsLoading } = useCollection<Governorate>(govsQuery);
  const { data: areas, loading: areasLoading } = useCollection<Area>(areasQuery);

  // ميزة الترجمة ثنائية الاتجاه
  const handleTranslate = async (currentForm: any, setForm: any, field: 'name' | 'nameEn') => {
    if (!autoTranslate || !currentForm?.[field] || currentForm.id || lastEditedField.current !== field) return;
    const targetLang = field === 'name' ? 'en' : 'ar';
    const targetField = field === 'name' ? 'nameEn' : 'name';

    const timer = setTimeout(async () => {
      if (currentForm[field]!.length > 2) {
        setIsTranslating(true);
        const res = await translateText({ text: currentForm[field]!, targetLang });
        setForm((prev: any) => prev ? { ...prev, [targetField]: res.translatedText } : null);
        setIsTranslating(false);
      }
    }, 1000);
    return timer;
  };

  useEffect(() => {
    const timer = handleTranslate(govForm, setGovForm, lastEditedField.current || 'name');
    return () => timer.then(t => clearTimeout(t));
  }, [govForm?.name, govForm?.nameEn, autoTranslate]);

  useEffect(() => {
    const timer = handleTranslate(areaForm, setAreaForm, lastEditedField.current || 'name');
    return () => timer.then(t => clearTimeout(t));
  }, [areaForm?.name, areaForm?.nameEn, autoTranslate]);

  const handleSaveGov = () => {
    if (!locationService || !govForm.name) return;
    const data = { ...govForm, order: 0, isActive: true, name: govForm.name || '', nameEn: govForm.nameEn || '' };
    if (govForm.id) locationService.updateGovernorate(govForm.id, data);
    else locationService.addGovernorate(data as any);
    toast({ title: t('saved') });
    setGovForm({ name: '', nameEn: '' });
  };

  const handleSaveArea = () => {
    if (!locationService || !selectedGov?.id || !areaForm.name) return;
    const data = { ...areaForm, order: 0, isActive: true, name: areaForm.name || '', nameEn: areaForm.nameEn || '' };
    if (areaForm.id) locationService.updateArea(selectedGov.id, areaForm.id, data);
    else locationService.addArea(selectedGov.id, data as any);
    toast({ title: t('saved') });
    setAreaForm({ name: '', nameEn: '' });
  };

  const RenderAutoTranslateToggle = () => (
    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full ring-1 ring-black/5">
      <Zap className={cn("h-3 w-3", autoTranslate ? "text-primary" : "text-slate-400")} />
      <span className="text-[10px] font-black text-slate-600">{isRtl ? 'ترجمة تلقائية' : 'Auto-Translate'}</span>
      <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} className="scale-75" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start"><MapPinned className="h-6 w-6 text-primary" /> {isRtl ? 'البيانات الجغرافية' : 'Geographic Data'}</h2>
        <Dialog><DialogTrigger asChild><Button onClick={() => setGovForm({ name: '', nameEn: '' })} className="rounded-xl"><Plus className="me-2 h-4 w-4" /> {t('newGov')}</Button></DialogTrigger>
          <DialogContent className="rounded-[2.5rem] p-8" dir={dir}>
             <DialogHeader className="flex flex-row items-center justify-between mb-4"><DialogTitle className="text-start font-black text-xl">{govForm.id ? t('edit') : t('newGov')}</DialogTitle>{!govForm.id && <RenderAutoTranslateToggle />}</DialogHeader>
             <div className="grid grid-cols-2 gap-4 py-4 text-start">
               <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={govForm.name || ''} onChange={e => { lastEditedField.current='name'; setGovForm({...govForm, name: e.target.value}); }} /></div>
               <div className="space-y-2 relative"><Label>{t('name')} (En)</Label><Input value={govForm.nameEn || ''} onChange={e => { lastEditedField.current='nameEn'; setGovForm({...govForm, nameEn: e.target.value}); }} className="text-start" dir="ltr" />{isTranslating && <div className="absolute right-3 top-9"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>}</div>
             </div>
             <DialogFooter className="mt-6"><Button onClick={handleSaveGov} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-start">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {govsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : governorates?.map(gov => (
                <div key={gov.id} onClick={() => setSelectedGov(gov)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all", selectedGov?.id === gov.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? gov.name : gov.nameEn}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100"><Button variant="ghost" size="icon" onClick={() => setGovForm(gov)}><Edit3 className="h-4 w-4" /></Button></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-8 text-start", !selectedGov && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between"><div><CardTitle className="text-lg font-black flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> {isRtl ? 'المناطق' : 'Areas'}</CardTitle></div>{selectedGov && (
              <Dialog><DialogTrigger asChild><Button variant="secondary" size="sm" className="rounded-xl h-10 px-4"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'منطقة' : 'Add Area'}</Button></DialogTrigger>
                <DialogContent className="rounded-[2.5rem] p-8" dir={dir}>
                  <DialogHeader className="flex flex-row items-center justify-between mb-4"><DialogTitle className="text-start font-black">{isRtl ? 'إضافة منطقة' : 'Add Area'}</DialogTitle><RenderAutoTranslateToggle /></DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4 text-start">
                    <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={areaForm.name || ''} onChange={e => { lastEditedField.current='name'; setAreaForm({...areaForm, name: e.target.value}); }} /></div>
                    <div className="space-y-2 relative"><Label>{t('name')} (En)</Label><Input value={areaForm.nameEn || ''} onChange={e => { lastEditedField.current='nameEn'; setAreaForm({...areaForm, nameEn: e.target.value}); }} className="text-start" dir="ltr" />{isTranslating && <div className="absolute right-3 top-9"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>}</div>
                  </div>
                  <DialogFooter className="mt-6"><Button onClick={handleSaveArea} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}</CardHeader>
            <CardContent className="p-6">
              {!selectedGov ? <div className="py-20 text-center italic text-muted-foreground">يرجى اختيار محافظة</div> : (
                areasLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {areas?.map(area => (
                      <div key={area.id} className="p-4 rounded-2xl border-2 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between group">
                        <span className="text-sm font-black">{isRtl ? area.name : area.nameEn}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
