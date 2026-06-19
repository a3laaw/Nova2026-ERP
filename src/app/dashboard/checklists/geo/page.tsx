'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, MapPinned, Plus, Loader2, Trash2, Edit3, 
  ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { LocationService } from '@/services/location-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Governorate, Area } from '@/types/reference';

export default function GeoPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedGov, setSelectedGov] = useState<Governorate | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [govForm, setGovForm] = useState<Partial<Governorate>>({ name: '', nameEn: '', isActive: true, order: 0 });
  const [areaForm, setAreaForm] = useState<Partial<Area>>({ name: '', nameEn: '', isActive: true, order: 0 });

  const locationService = useMemo(() => db && companyId ? new LocationService(db, companyId) : null, [db, companyId]);

  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGov?.id ? query(collection(db, paths.areas(companyId, selectedGov.id)), orderBy('order')) : null, [db, companyId, selectedGov]);

  const { data: governorates, loading: govsLoading } = useCollection<Governorate>(govsQuery);
  const { data: areas, loading: areasLoading } = useCollection<Area>(areasQuery);

  const handleSaveGov = async () => {
    if (!locationService || !govForm.name) return;
    setLoadingAction('gov');
    try {
      if (govForm.id) { await locationService.updateGovernorate(govForm.id, govForm); }
      else { await locationService.addGovernorate(govForm as any); }
      toast({ title: t('saved') });
      setGovForm({ name: '', nameEn: '', isActive: true, order: 0 });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleSaveArea = async () => {
    if (!locationService || !selectedGov?.id || !areaForm.name) return;
    setLoadingAction('area');
    try {
      if (areaForm.id) { await locationService.updateArea(selectedGov.id, areaForm.id, areaForm); }
      else { await locationService.addArea(selectedGov.id, areaForm as any); }
      toast({ title: t('saved') });
      setAreaForm({ name: '', nameEn: '', isActive: true, order: 0 });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3">
          <MapPinned className="h-6 w-6 text-primary" />
          {isRtl ? 'البيانات الجغرافية' : 'Geographic Data'}
        </h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setGovForm({ name: '', nameEn: '', isActive: true, order: (governorates?.length || 0) + 1 })} className="rounded-xl">
              <Plus className="me-2 h-4 w-4" /> {t('newGov')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl" dir={dir}>
             <DialogHeader><DialogTitle className="text-start font-black">{isRtl ? 'محافظة جديدة' : 'New Gov'}</DialogTitle></DialogHeader>
             <div className="grid grid-cols-1 gap-4 py-4 text-start">
               <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={govForm.name || ''} onChange={e => setGovForm({...govForm, name: e.target.value})} /></div>
               <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={govForm.nameEn || ''} onChange={e => setGovForm({...govForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
               <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={govForm.order || ''} onChange={e => setGovForm({...govForm, order: Number(e.target.value)})} /></div>
             </div>
             <DialogFooter><Button onClick={handleSaveGov} disabled={loadingAction === 'gov'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'gov' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-start">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {govsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                governorates?.map(gov => (
                  <div key={gov.id} onClick={() => setSelectedGov(gov)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all", selectedGov?.id === gov.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                    <span className="text-sm font-black">{isRtl ? gov.name : gov.nameEn}</span>
                    <ChevronRight className={cn("h-4 w-4", isRtl && 'rotate-180', selectedGov?.id === gov.id && 'text-primary scale-110')} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-8 text-start", !selectedGov && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white text-start">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-lg font-black flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> {isRtl ? 'المناطق' : 'Areas'}</CardTitle>
                <CardDescription>{selectedGov ? (isRtl ? `محافظة: ${selectedGov.name}` : `Gov: ${selectedGov.nameEn}`) : (isRtl ? 'اختر محافظة' : 'Select a gov')}</CardDescription>
              </div>
              {selectedGov && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="rounded-xl h-10 px-4"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة منطقة' : 'Add Area'}</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-black">{isRtl ? 'منطقة جديدة' : 'New Area'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 gap-4 py-4 text-start">
                      <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={areaForm.name || ''} onChange={e => setAreaForm({...areaForm, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={areaForm.nameEn || ''} onChange={e => setAreaForm({...areaForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveArea} disabled={loadingAction === 'area'} className="w-full h-12 rounded-xl">{loadingAction === 'area' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!selectedGov ? <div className="py-20 text-center italic text-muted-foreground">{isRtl ? 'يرجى اختيار محافظة' : 'Please select a governorate'}</div> : (
                areasLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {areas?.map(area => (
                      <div key={area.id} className="p-4 rounded-2xl border-2 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex items-center justify-between group text-start">
                        <span className="text-sm font-black">{isRtl ? area.name : area.nameEn}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" onClick={() => setAreaForm(area)} className="h-8 w-8 text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => locationService?.deleteArea(selectedGov.id!, area.id!)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
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