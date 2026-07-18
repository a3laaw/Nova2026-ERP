'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MapPin, MapPinned, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Search, AlertTriangle
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
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isGovOpen, setIsGovOpen] = useState(false);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  
  const [govForm, setGovForm] = useState<Partial<Governorate>>({ name: '', nameEn: '' });
  const [areaForm, setAreaForm] = useState<Partial<Area>>({ name: '', nameEn: '' });

  const locationService = useMemo(() => 
    db && companyId ? new LocationService(db, companyId) : null, 
  [db, companyId]);

  const govsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.governorates(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const areasQuery = useMemo(() => 
    companyId && db && selectedGov?.id ? query(collection(db, paths.areas(companyId, selectedGov.id)), orderBy('order')) : null, 
  [db, companyId, selectedGov]);

  const { data: governorates, loading: govsLoading } = useCollection<Governorate>(govsQuery);
  const { data: areas, loading: areasLoading } = useCollection<Area>(areasQuery);

  const handleSaveGov = async () => {
    if (!locationService || !govForm.name) return;
    setLoadingAction('save_gov');
    try {
      const data = { ...govForm, order: governorates?.length || 0, isActive: true, name: govForm.name || '', nameEn: govForm.nameEn || '' };
      if (govForm.id) await locationService.updateGovernorate(govForm.id, data);
      else await locationService.addGovernorate(data as any);
      toast({ title: t('saved') });
      setIsGovOpen(false);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveArea = async () => {
    if (!locationService || !selectedGov?.id || !areaForm.name) return;
    setLoadingAction('save_area');
    try {
      const data = { ...areaForm, order: areas?.length || 0, isActive: true, name: areaForm.name || '', nameEn: areaForm.nameEn || '' };
      if (areaForm.id) await locationService.updateArea(selectedGov.id, areaForm.id, data);
      else await locationService.addArea(selectedGov.id, data as any);
      toast({ title: t('saved') });
      setIsAreaOpen(false);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteGov = async (id: string) => {
    if (!locationService) return;
    setLoadingAction(`delete_gov_${id}`);
    try {
      await locationService.deleteGovernorate(id);
      if (selectedGov?.id === id) setSelectedGov(null);
      toast({ title: t('deleted') });
    } finally {
      setLoadingAction(null);
      setDeletingId(null);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!locationService || !selectedGov?.id) return;
    setLoadingAction(`delete_area_${areaId}`);
    try {
      await locationService.deleteArea(selectedGov.id, areaId);
      toast({ title: t('deleted') });
    } finally {
      setLoadingAction(null);
      setDeletingId(null);
    }
  };

  const filteredGovs = governorates?.filter(g => 
    g.name.includes(searchTerm) || g.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start">
          <MapPinned className="h-6 w-6 text-primary" /> 
          {isRtl ? 'البيانات الجغرافية' : 'Geographic Data'}
        </h2>
        
        <Dialog open={isGovOpen} onOpenChange={setIsGovOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setGovForm({ name: '', nameEn: '' })} variant="default" className="h-11 shadow-lg flex items-center gap-2">
              <Plus className="h-4 w-4 me-2" /> {t('newGov')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl p-8 border-0 shadow-3xl" dir={dir}>
             <DialogHeader className="text-start"><DialogTitle className="font-black text-2xl">{govForm.id ? t('edit') : t('newGov')}</DialogTitle></DialogHeader>
             <div className="grid grid-cols-2 gap-4 py-6 text-start">
               <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (Ar)</Label><Input value={govForm.name || ''} onChange={e => setGovForm({...govForm, name: e.target.value})} className="h-11 border-2" /></div>
               <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (En)</Label><Input value={govForm.nameEn || ''} onChange={e => setGovForm({...govForm, nameEn: e.target.value})} className="h-11 border-2 text-start" dir="ltr" /></div>
             </div>
             <DialogFooter>
               <Button onClick={handleSaveGov} disabled={loadingAction === 'save_gov'} className="w-full h-12 rounded-xl">
                 {loadingAction === 'save_gov' ? <Loader2 className="animate-spin" /> : t('save')}
               </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-start">
          <Card className="border-0 shadow-lg rounded-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('search')} className="ps-10 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {govsLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                filteredGovs.map(gov => (
                  <div 
                    key={gov.id} 
                    onClick={() => setSelectedGov(gov)} 
                    className={cn(
                      "p-5 border-b flex items-center justify-between cursor-pointer transition-all group", 
                      selectedGov?.id === gov.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30'
                    )}
                  >
                    <span className="text-sm font-black">{isRtl ? gov.name : gov.nameEn}</span>
                    <div className="flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGovForm(gov); setIsGovOpen(true); }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        disabled={loadingAction === `delete_gov_${gov.id}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(gov.id!); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedGov?.id === gov.id && 'text-primary')} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-8 text-start", !selectedGov && 'opacity-60')}>
          <Card className="border-0 shadow-lg rounded-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg font-black flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> {isRtl ? 'المناطق' : 'Areas'}</CardTitle></div>
              
              <Dialog open={isAreaOpen} onOpenChange={setIsAreaOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={!selectedGov} 
                    variant="outline"
                    className="h-11 transition-all gap-2"
                    onClick={() => setAreaForm({ name: '', nameEn: '' })}
                  >
                    <Plus className="h-4 w-4" /> {isRtl ? 'إضافة منطقة' : 'Add Area'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl p-8 border-0 shadow-3xl max-w-xl" dir={dir}>
                  <DialogHeader className="text-start">
                    <DialogTitle className="font-black text-2xl flex items-center gap-3">
                       <MapPin className="h-6 w-6 text-primary" />
                       {isRtl ? 'إضافة منطقة سكنية' : 'Add New Area'}
                    </DialogTitle>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{isRtl ? `المحافظة: ${selectedGov?.name}` : `Gov: ${selectedGov?.nameEn}`}</p>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-6 text-start">
                    <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (Ar)</Label><Input value={areaForm.name || ''} onChange={e => setAreaForm({...areaForm, name: e.target.value})} className="h-11 border-2" /></div>
                    <div className="space-y-2"><Label className="text-xs font-black uppercase text-slate-400">{t('name')} (En)</Label><Input value={areaForm.nameEn || ''} onChange={e => setAreaForm({...areaForm, nameEn: e.target.value})} className="h-11 border-2 text-start" dir="ltr" /></div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveArea} disabled={loadingAction === 'save_area'} className="w-full h-12 rounded-xl">
                      {loadingAction === 'save_area' ? <Loader2 className="animate-spin" /> : t('save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-6">
              {!selectedGov ? (
                <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-4 opacity-40">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center"><ChevronRight className={cn("h-8 w-8", !isRtl && "rotate-180")} /></div>
                  <p className="font-black">{isRtl ? 'يرجى اختيار محافظة من القائمة.' : 'Please select a governorate.'}</p>
                </div>
              ) : (
                areasLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {areas?.map(area => (
                      <div key={area.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-primary/20 transition-all flex items-center justify-between group shadow-sm">
                        <span className="text-sm font-black text-slate-800">{isRtl ? area.name : area.nameEn}</span>
                        <div className="flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAreaForm(area); setIsAreaOpen(true); }}
                           >
                            <Edit3 className="h-4 w-4" />
                           </Button>
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-rose-50"
                            disabled={loadingAction === `delete_area_${area.id}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(area.id!); }}
                           >
                            <Trash2 className="h-4 w-4" />
                           </Button>
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

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-xl p-8" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4">
               <AlertTriangle className="h-8 w-8" />
            </div>
            <AlertDialogTitle className="text-start font-black text-2xl">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold">
              {isRtl ? 'هل أنت متأكد؟ سيتم حذف السجل نهائياً.' : 'This will permanently delete the record.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="rounded-xl h-11 border-2">{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deletingId) {
                  const isGov = governorates?.some(g => g.id === deletingId);
                  if (isGov) handleDeleteGov(deletingId);
                  else handleDeleteArea(deletingId);
                }
              }}
              className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white px-8"
            >
              {isRtl ? 'نعم، احذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}