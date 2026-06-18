'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Search, CheckCircle2, XCircle, MapPinned
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { LocationService } from '@/services/location-service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const [govForm, setGovForm] = useState<Partial<Governorate>>({
    name: '', nameEn: '', isActive: true, order: 0
  });
  const [areaForm, setAreaForm] = useState<Partial<Area>>({
    name: '', nameEn: '', isActive: true, order: 0
  });

  const locationService = useMemo(() => db && companyId ? new LocationService(db, companyId) : null, [db, companyId]);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null
  , [db, companyId]);

  const areasQuery = useMemo(() => 
    companyId && db && selectedGov?.id ? query(collection(db, paths.areas(companyId, selectedGov.id)), orderBy('order')) : null
  , [db, companyId, selectedGov]);

  const { data: governorates, loading: govsLoading } = useCollection<Governorate>(govsQuery);
  const { data: areas, loading: areasLoading } = useCollection<Area>(areasQuery);

  const filteredGovs = governorates?.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSaveGov = async () => {
    if (!locationService || !govForm.name) return;
    setLoadingAction('gov');
    try {
      if (govForm.id) {
        await locationService.updateGovernorate(govForm.id, govForm);
      } else {
        await locationService.addGovernorate(govForm as any);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setGovForm({ name: '', nameEn: '', isActive: true, order: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveArea = async () => {
    if (!locationService || !selectedGov?.id || !areaForm.name) return;
    setLoadingAction('area');
    try {
      if (areaForm.id) {
        await locationService.updateArea(selectedGov.id, areaForm.id, areaForm);
      } else {
        await locationService.addArea(selectedGov.id, areaForm as any);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      setAreaForm({ name: '', nameEn: '', isActive: true, order: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteGov = async (id: string) => {
    if (!locationService || !confirm(t('confirmDelete'))) return;
    try {
      await locationService.deleteGovernorate(id);
      if (selectedGov?.id === id) setSelectedGov(null);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!locationService || !selectedGov?.id || !confirm(t('confirmDelete'))) return;
    try {
      await locationService.deleteArea(selectedGov.id, areaId);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3">
            <MapPinned className="h-10 w-10 text-primary" />
            {isRtl ? 'البيانات الجغرافية' : 'Geographic Data'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة المحافظات والمناطق لتنظيم العمل الميداني' : 'Manage governorates and areas for field operations'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setGovForm({ name: '', nameEn: '', isActive: true, order: (governorates?.length || 0) + 1 })} className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {t('newGov')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{govForm.id ? (isRtl ? 'تعديل محافظة' : 'Edit Governorate') : t('newGov')}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2">
                <Label>{t('name')} (Ar)</Label>
                <Input value={govForm.name} onChange={e => setGovForm({...govForm, name: e.target.value})} placeholder="العاصمة" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="space-y-2">
                <Label>{t('name')} (En)</Label>
                <Input value={govForm.nameEn} onChange={e => setGovForm({...govForm, nameEn: e.target.value})} placeholder="Al-Asimah" className="h-14 rounded-2xl border-2 text-start" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                <Input type="number" value={govForm.order} onChange={e => setGovForm({...govForm, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
              </div>
              <div className="flex items-center gap-4 pt-4">
                <Label>{t('active')}</Label>
                <Switch checked={govForm.isActive} onCheckedChange={val => setGovForm({...govForm, isActive: val})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveGov} disabled={loadingAction === 'gov' || !govForm.name} className="w-full h-14 rounded-2xl font-black bg-primary">
                {loadingAction === 'gov' ? <Loader2 className="animate-spin" /> : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Governorates Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-6">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('search')} 
                  className="ps-10 rounded-xl h-12 bg-white text-start" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[700px] overflow-y-auto">
              {govsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto h-10 w-10 text-primary/30" /></div> : (
                filteredGovs.length === 0 ? <div className="p-20 text-center text-muted-foreground italic font-bold">{t('search')}</div> : (
                  filteredGovs.map(gov => (
                    <div 
                      key={gov.id} 
                      onClick={() => setSelectedGov(gov)}
                      className={cn(
                        "p-6 border-b flex items-center justify-between cursor-pointer transition-all group text-start",
                        selectedGov?.id === gov.id ? 'bg-primary/5 border-s-8 border-s-primary' : 'hover:bg-muted/30'
                      )}
                    >
                      <div className="flex flex-col space-y-1">
                        <span className="text-base font-black text-slate-800">{isRtl ? gov.name : gov.nameEn}</span>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="font-mono text-[10px] bg-white">#{gov.order}</Badge>
                           {gov.isActive ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setGovForm(gov); }} className="h-9 w-9 text-blue-600 bg-blue-50 rounded-xl"><Edit3 className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                               <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'تعديل محافظة' : 'Edit Governorate'}</DialogTitle></DialogHeader>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                                  <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={govForm.name} onChange={e => setGovForm({...govForm, name: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                  <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={govForm.nameEn} onChange={e => setGovForm({...govForm, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 text-start" /></div>
                                  <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={govForm.order} onChange={e => setGovForm({...govForm, order: Number(e.target.value)})} className="h-14 rounded-2xl border-2" /></div>
                                  <div className="flex items-center gap-4 pt-4"><Label>{t('active')}</Label><Switch checked={govForm.isActive} onCheckedChange={val => setGovForm({...govForm, isActive: val})} /></div>
                               </div>
                               <DialogFooter><Button onClick={handleSaveGov} disabled={loadingAction === 'gov'} className="w-full h-14 rounded-2xl font-black bg-primary">{loadingAction === 'gov' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteGov(gov.id!); }} className="h-9 w-9 text-destructive bg-destructive/5 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <ChevronRight className={cn("h-5 w-5 transition-transform", selectedGov?.id === gov.id ? 'text-primary scale-125' : 'text-muted-foreground', isRtl && selectedGov?.id !== gov.id && 'rotate-180')} />
                      </div>
                    </div>
                  ))
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Areas Column */}
        <div className={cn("lg:col-span-7 transition-opacity", !selectedGov && 'opacity-30 pointer-events-none')}>
          <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                  <MapPin className="h-6 w-6 text-primary" />
                  {isRtl ? 'المناطق التابعة' : 'Associated Areas'}
                  {selectedGov && <Badge variant="secondary" className="ms-3 bg-primary/10 text-primary font-black">{isRtl ? selectedGov.name : selectedGov.nameEn}</Badge>}
                </CardTitle>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button disabled={!selectedGov} onClick={() => setAreaForm({ name: '', nameEn: '', isActive: true, order: (areas?.length || 0) + 1 })} className="bg-secondary text-primary font-black rounded-xl h-12">
                    <Plus className="me-2 h-5 w-5" />
                    {isRtl ? 'إضافة منطقة' : 'Add Area'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                  <DialogHeader>
                    <DialogTitle className="text-start font-headline font-black text-2xl">{areaForm.id ? (isRtl ? 'تعديل منطقة' : 'Edit Area') : (isRtl ? 'إضافة منطقة جديدة' : 'Add New Area')}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                    <div className="space-y-2">
                      <Label>{t('name')} (Ar)</Label>
                      <Input value={areaForm.name} onChange={e => setAreaForm({...areaForm, name: e.target.value})} placeholder="الروضة" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('name')} (En)</Label>
                      <Input value={areaForm.nameEn} onChange={e => setAreaForm({...areaForm, nameEn: e.target.value})} placeholder="Rawda" className="h-14 rounded-2xl border-2 text-start" />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                      <Input type="number" value={areaForm.order} onChange={e => setAreaForm({...areaForm, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="flex items-center gap-4 pt-4">
                      <Label>{t('active')}</Label>
                      <Switch checked={areaForm.isActive} onCheckedChange={val => setAreaForm({...areaForm, isActive: val})} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveArea} disabled={loadingAction === 'area' || !areaForm.name} className="w-full h-14 rounded-2xl font-black bg-primary">
                      {loadingAction === 'area' ? <Loader2 className="animate-spin" /> : t('save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-8">
              {!selectedGov ? (
                <div className="py-40 text-center space-y-4">
                  <MapPin className="h-16 w-16 mx-auto text-muted-foreground/20" />
                  <p className="text-muted-foreground font-bold italic">{isRtl ? 'يرجى اختيار محافظة لعرض مناطقها' : 'Please select a governorate to view areas'}</p>
                </div>
              ) : (
                areasLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
                  areas?.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground font-bold italic">{isRtl ? 'لا توجد مناطق معرّفة لهذه المحافظة' : 'No areas defined for this governorate'}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {areas?.map(area => (
                        <div key={area.id} className="p-5 rounded-3xl border-2 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-primary/20 transition-all group flex items-center justify-between text-start">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm border font-black text-xs text-primary">{area.order}</div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800">{isRtl ? area.name : area.nameEn}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {area.isActive ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setAreaForm(area)} className="h-8 w-8 text-blue-600 hover:bg-blue-50"><Edit3 className="h-4 w-4" /></Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-0 shadow-2xl" dir={dir}>
                                  <DialogHeader><DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'تعديل منطقة' : 'Edit Area'}</DialogTitle></DialogHeader>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
                                    <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={areaForm.name} onChange={e => setAreaForm({...areaForm, name: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={areaForm.nameEn} onChange={e => setAreaForm({...areaForm, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 text-start" /></div>
                                    <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={areaForm.order} onChange={e => setAreaForm({...areaForm, order: Number(e.target.value)})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="flex items-center gap-4 pt-4"><Label>{t('active')}</Label><Switch checked={areaForm.isActive} onCheckedChange={val => setAreaForm({...areaForm, isActive: val})} /></div>
                                  </div>
                                  <DialogFooter><Button onClick={handleSaveArea} disabled={loadingAction === 'area'} className="w-full h-14 rounded-2xl font-black bg-primary">{loadingAction === 'area' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                                </DialogContent>
                             </Dialog>
                             <Button variant="ghost" size="icon" onClick={() => handleDeleteArea(area.id!)} className="h-8 w-8 text-destructive hover:bg-destructive/5"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
