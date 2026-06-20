'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [isGovOpen, setIsGovOpen] = useState(false);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  
  const [govForm, setGovForm] = useState<Partial<Governorate>>({ name: '', nameEn: '' });
  const [areaForm, setAreaForm] = useState<Partial<Area>>({ name: '', nameEn: '' });

  const locationService = useMemo(() => db && companyId ? new LocationService(db, companyId) : null, [db, companyId]);
  const govsQuery = useMemo(() => companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, [db, companyId]);
  const areasQuery = useMemo(() => companyId && db && selectedGov?.id ? query(collection(db, paths.areas(companyId, selectedGov.id)), orderBy('order')) : null, [db, companyId, selectedGov]);

  const { data: governorates, loading: govsLoading } = useCollection<Governorate>(govsQuery);
  const { data: areas, loading: areasLoading } = useCollection<Area>(areasQuery);

  const handleSaveGov = () => {
    if (!locationService || !govForm.name) return;
    const data = { ...govForm, order: governorates?.length || 0, isActive: true, name: govForm.name || '', nameEn: govForm.nameEn || '' };
    if (govForm.id) locationService.updateGovernorate(govForm.id, data);
    else locationService.addGovernorate(data as any);
    toast({ title: t('saved') });
    setGovForm({ name: '', nameEn: '' });
    setIsGovOpen(false);
  };

  const handleDeleteGov = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!locationService || !confirm(t('confirmDelete'))) return;
    // غير محظور لسرعة الاستجابة
    locationService.deleteGovernorate(id);
    if (selectedGov?.id === id) setSelectedGov(null);
    toast({ title: t('deleted') });
  };

  const handleSaveArea = () => {
    if (!locationService || !selectedGov?.id || !areaForm.name) return;
    const data = { ...areaForm, order: areas?.length || 0, isActive: true, name: areaForm.name || '', nameEn: areaForm.nameEn || '' };
    if (areaForm.id) locationService.updateArea(selectedGov.id, areaForm.id, data);
    else locationService.addArea(selectedGov.id, data as any);
    toast({ title: t('saved') });
    setAreaForm({ name: '', nameEn: '' });
    setIsAreaOpen(false);
  };

  const handleDeleteArea = (e: React.MouseEvent, areaId: string) => {
    e.stopPropagation();
    if (!locationService || !selectedGov?.id || !confirm(t('confirmDelete'))) return;
    locationService.deleteArea(selectedGov.id, areaId);
    toast({ title: t('deleted') });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start"><MapPinned className="h-6 w-6 text-primary" /> {isRtl ? 'البيانات الجغرافية' : 'Geographic Data'}</h2>
        <Dialog open={isGovOpen} onOpenChange={setIsGovOpen}>
          <DialogTrigger asChild>
            <button onClick={() => setGovForm({ name: '', nameEn: '' })} className="btn-nova-primary h-12 px-6 rounded-2xl flex items-center gap-2">
              <Plus className="h-5 w-5" /> {t('newGov')}
            </button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] p-8" dir={dir}>
             <DialogHeader><DialogTitle className="text-start font-black text-xl">{govForm.id ? t('edit') : t('newGov')}</DialogTitle></DialogHeader>
             <div className="grid grid-cols-2 gap-4 py-4 text-start">
               <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={govForm.name || ''} onChange={e => setGovForm({...govForm, name: e.target.value})} /></div>
               <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={govForm.nameEn || ''} onChange={e => setGovForm({...govForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
             </div>
             <DialogFooter className="mt-6"><Button onClick={handleSaveGov} className="w-full h-12 rounded-xl font-bold bg-primary text-white">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-start">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {govsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : governorates?.map(gov => (
                <div key={gov.id} onClick={() => setSelectedGov(gov)} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedGov?.id === gov.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? gov.name : gov.nameEn}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setGovForm(gov); setIsGovOpen(true); }} className="h-8 w-8 text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => handleDeleteGov(e, gov.id!)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-8 text-start", !selectedGov && 'opacity-40')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg font-black flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> {isRtl ? 'المناطق' : 'Areas'}</CardTitle></div>
              {selectedGov && (
                <Dialog open={isAreaOpen} onOpenChange={setIsAreaOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="rounded-xl h-10 px-4" onClick={() => setAreaForm({ name: '', nameEn: '' })}>
                      <Plus className="me-2 h-4 w-4" /> {isRtl ? 'منطقة' : 'Add Area'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] p-8" dir={dir}>
                    <DialogHeader><DialogTitle className="text-start font-black">{isRtl ? 'إضافة منطقة' : 'Add Area'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4 text-start">
                      <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={areaForm.name || ''} onChange={e => setAreaForm({...areaForm, name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={areaForm.nameEn || ''} onChange={e => setAreaForm({...areaForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
                    </div>
                    <DialogFooter className="mt-6"><Button onClick={handleSaveArea} className="w-full h-12 rounded-xl font-bold bg-primary text-white">{t('save')}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!selectedGov ? <div className="py-20 text-center italic text-muted-foreground">يرجى اختيار محافظة</div> : (
                areasLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {areas?.map(area => (
                      <div key={area.id} className="p-4 rounded-2xl border-2 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between group">
                        <span className="text-sm font-black">{isRtl ? area.name : area.nameEn}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.stopPropagation(); setAreaForm(area); setIsAreaOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDeleteArea(e, area.id!)}><Trash2 className="h-4 w-4" /></Button>
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
