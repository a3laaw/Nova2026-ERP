'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Workflow, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, LayoutGrid, Boxes, Layers,
  AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { TechnicalPathService } from '@/services/technical-path-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ActivityType, Service, SubService } from '@/types/reference';
import { TechnicalStagesManager } from './technical-stages-manager';

export default function TechnicalPathsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubService | null>(null);
  const [viewMode, setViewMode] = useState<'main' | 'stages'>('main');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [deletingContext, setDeletingContext] = useState<{ id: string, type: 'act' | 'srv' | 'sub' } | null>(null);
  
  const [isActOpen, setIsActOpen] = useState(false);
  const [isSrvOpen, setIsSrvOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);

  const [activityForm, setActivityForm] = useState<Partial<ActivityType>>({ name: '', nameEn: '' });
  const [serviceForm, setServiceForm] = useState<Partial<Service>>({ name: '', nameEn: '' });
  const [subForm, setSubForm] = useState<Partial<SubService>>({ name: '', nameEn: '' });

  const pathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);

  const activitiesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const servicesQuery = useMemo(() => companyId && db && selectedActivity?.id ? query(collection(db, paths.services(companyId, selectedActivity.id)), orderBy('order')) : null, [db, companyId, selectedActivity]);
  const subServicesQuery = useMemo(() => companyId && db && selectedActivity?.id && selectedService?.id ? query(collection(db, paths.subServices(companyId, selectedActivity.id, selectedService.id)), orderBy('order')) : null, [db, companyId, selectedActivity, selectedService]);

  const { data: activities, loading: activitiesLoading } = useCollection<ActivityType>(activitiesQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(servicesQuery);
  const { data: subServices, loading: subLoading } = useCollection<SubService>(subServicesQuery);

  const handleSaveActivity = async () => {
    if (!pathService || !activityForm.name) return;
    setLoadingAction('save_act');
    try {
      const data = { ...activityForm, order: activities?.length || 0, isActive: true, name: activityForm.name || '', nameEn: activityForm.nameEn || '' };
      if (activityForm.id) await pathService.updateActivityType(activityForm.id, data);
      else await pathService.addActivityType(data as any);
      toast({ title: t('saved') });
      setIsActOpen(false);
    } finally { setLoadingAction(null); }
  };

  const handleSaveService = async () => {
    if (!pathService || !selectedActivity?.id || !serviceForm.name) return;
    setLoadingAction('save_srv');
    try {
      const data = { ...serviceForm, order: services?.length || 0, isActive: true, name: serviceForm.name || '', nameEn: serviceForm.nameEn || '' };
      if (serviceForm.id) await pathService.updateService(selectedActivity.id, serviceForm.id, data);
      else await pathService.addService(selectedActivity.id, data);
      toast({ title: t('saved') });
      setIsSrvOpen(false);
    } finally { setLoadingAction(null); }
  };

  const handleSaveSub = async () => {
    if (!pathService || !selectedActivity?.id || !selectedService?.id || !subForm.name) return;
    setLoadingAction('save_sub');
    try {
      const data = { ...subForm, order: subServices?.length || 0, isActive: true, name: subForm.name || '', nameEn: subForm.nameEn || '' };
      if (subForm.id) await pathService.updateSubService(selectedActivity.id, selectedService.id, subForm.id, data);
      else await pathService.addSubService(selectedActivity.id, selectedService.id, data);
      toast({ title: t('saved') });
      setIsSubOpen(false);
    } finally { setLoadingAction(null); }
  };

  const handleFinalDelete = async () => {
    if (!pathService || !deletingContext) return;
    const { id, type } = deletingContext;
    setLoadingAction(`delete_${id}`);
    try {
      if (type === 'act') {
        await pathService.deleteActivityType(id);
        if (selectedActivity?.id === id) setSelectedActivity(null);
      } else if (type === 'srv') {
        await pathService.deleteService(selectedActivity!.id!, id);
        if (selectedService?.id === id) setSelectedService(null);
      } else {
        await pathService.deleteSubService(selectedActivity!.id!, selectedService!.id!, id);
        if (selectedSub?.id === id) setSelectedSub(null);
      }
      toast({ title: t('deleted') });
    } finally {
      setLoadingAction(null);
      setDeletingContext(null);
    }
  };

  if (viewMode === 'stages' && selectedActivity && selectedService && selectedSub) {
    return <TechnicalStagesManager activityType={selectedActivity} service={selectedService} subService={selectedSub} onBack={() => setViewMode('main')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start"><Workflow className="h-6 w-6 text-primary" /> {isRtl ? 'هندسة المسارات الفنية' : 'Technical Path Engineering'}</h2>
        <Button onClick={() => { setActivityForm({ name: '', nameEn: '' }); setIsActOpen(true); }} className="btn-nova-primary h-12 rounded-xl shadow-lg"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'نشاط جديد' : 'New Activity'}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 text-start"><CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'الأنشطة' : 'Activities'}</CardTitle></CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {activitiesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : activities?.map(act => (
                <div key={act.id} onClick={() => { setSelectedActivity(act); setSelectedService(null); setSelectedSub(null); }} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedActivity?.id === act.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? act.name : act.nameEn}</span>
                  <div className="flex items-center gap-1 z-20">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.stopPropagation(); setActivityForm(act); setIsActOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={loadingAction === `delete_${act.id}`} onClick={(e) => { e.stopPropagation(); setDeletingContext({ id: act.id!, type: 'act' }); }}><Trash2 className="h-4 w-4" /></Button>
                    <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedActivity?.id === act.id && 'text-primary')} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-4", !selectedActivity && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between"><CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400"><Boxes className="h-4 w-4" /> {isRtl ? 'الخدمات' : 'Services'}</CardTitle>{selectedActivity && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setServiceForm({ name: '', nameEn: '' }); setIsSrvOpen(true); }}><Plus className="h-5 w-5" /></Button>}</CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {!selectedActivity ? <div className="p-10 text-center text-xs italic text-muted-foreground">اختر نشاطاً</div> : servicesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : services?.map(srv => (
                <div key={srv.id} onClick={() => { setSelectedService(srv); setSelectedSub(null); }} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedService?.id === srv.id ? 'bg-blue-50/50 border-s-4 border-s-blue-500' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? srv.name : srv.nameEn}</span>
                  <div className="flex items-center gap-1 z-20">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.stopPropagation(); setServiceForm(srv); setIsSrvOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={loadingAction === `delete_${srv.id}`} onClick={(e) => { e.stopPropagation(); setDeletingContext({ id: srv.id!, type: 'srv' }); }}><Trash2 className="h-4 w-4" /></Button>
                    <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedService?.id === srv.id && 'text-blue-500')} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-4", !selectedService && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between"><CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400"><Layers className="h-4 w-4" /> {isRtl ? 'المسارات' : 'Sub-Services'}</CardTitle>{selectedService && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSubForm({ name: '', nameEn: '' }); setIsSubOpen(true); }}><Plus className="h-5 w-5" /></Button>}</CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {!selectedService ? <div className="p-10 text-center text-xs italic text-muted-foreground">اختر خدمة</div> : subLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : subServices?.map(sub => (
                <div key={sub.id} className={cn("p-5 border-b flex items-center justify-between group transition-all", selectedSub?.id === sub.id ? 'bg-emerald-50/50 border-s-4 border-s-emerald-500' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? sub.name : sub.nameEn}</span>
                  <div className="flex items-center gap-1 z-20">
                    <Button onClick={() => { setSelectedSub(sub); setViewMode('stages'); }} variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black border-primary/20 text-primary">إدارة المراحل</Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.stopPropagation(); setSubForm(sub); setIsSubOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={loadingAction === `delete_${sub.id}`} onClick={(e) => { e.stopPropagation(); setDeletingContext({ id: sub.id!, type: 'sub' }); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isActOpen} onOpenChange={setIsActOpen}>
        <DialogContent className="rounded-[2rem] max-w-lg p-8" dir={dir}>
          <DialogHeader><DialogTitle className="text-start font-black text-xl">{activityForm.id ? t('edit') : t('newActivity')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-start">
            <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={activityForm.name || ''} onChange={e => setActivityForm({...activityForm, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={activityForm.nameEn || ''} onChange={e => setActivityForm({...activityForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
          </div>
          <DialogFooter className="mt-8">
            <Button onClick={handleSaveActivity} disabled={loadingAction === 'save_act'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">
              {loadingAction === 'save_act' ? <Loader2 className="animate-spin" /> : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSrvOpen} onOpenChange={setIsSrvOpen}>
        <DialogContent className="rounded-[2rem] max-w-lg p-8" dir={dir}>
          <DialogHeader><DialogTitle className="text-start font-black text-xl">{serviceForm.id ? t('edit') : t('newService')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-start">
            <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={serviceForm.name || ''} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={serviceForm.nameEn || ''} onChange={e => setServiceForm({...serviceForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
          </div>
          <DialogFooter className="mt-8">
            <Button onClick={handleSaveService} disabled={loadingAction === 'save_srv'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">
              {loadingAction === 'save_srv' ? <Loader2 className="animate-spin" /> : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSubOpen} onOpenChange={setIsSubOpen}>
        <DialogContent className="rounded-[2rem] max-w-lg p-8" dir={dir}>
          <DialogHeader><DialogTitle className="text-start font-black text-xl">{subForm.id ? t('edit') : t('newPath')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-start">
            <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={subForm.name || ''} onChange={e => setSubForm({...subForm, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={subForm.nameEn || ''} onChange={e => setSubForm({...subForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
          </div>
          <DialogFooter className="mt-8">
            <Button onClick={handleSaveSub} disabled={loadingAction === 'save_sub'} className="w-full h-12 rounded-xl font-bold bg-primary text-white">
              {loadingAction === 'save_sub' ? <Loader2 className="animate-spin" /> : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingContext} onOpenChange={(open) => !open && setDeletingContext(null)}>
        <AlertDialogContent className="rounded-[2rem] p-8" dir={dir}>
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4"><AlertTriangle className="h-8 w-8" /></div>
            <AlertDialogTitle className="text-start font-black text-2xl">{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start font-bold">
              {isRtl ? 'سيؤدي هذا لحذف كافة العناصر والخدمات التابعة لهذا المسار بشكل نهائي.' : 'This will permanently delete all sub-items and services linked to this path.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="rounded-xl h-12 border-2 font-bold">{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalDelete} className="rounded-xl h-12 font-black bg-rose-600 hover:bg-rose-700 text-white px-8">
              {isRtl ? 'نعم، احذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
