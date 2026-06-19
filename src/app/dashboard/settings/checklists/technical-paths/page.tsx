'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Workflow, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, LayoutGrid, Boxes, Layers
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { TechnicalPathService } from '@/services/technical-path-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  
  const [activityForm, setActivityForm] = useState<Partial<ActivityType> | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<Service> | null>(null);
  const [subForm, setSubForm] = useState<Partial<SubService> | null>(null);

  const pathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);

  const activitiesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId))) : null, [db, companyId]);
  const servicesQuery = useMemo(() => companyId && db && selectedActivity?.id ? query(collection(db, paths.services(companyId, selectedActivity.id))) : null, [db, companyId, selectedActivity]);
  const subServicesQuery = useMemo(() => companyId && db && selectedActivity?.id && selectedService?.id ? query(collection(db, paths.subServices(companyId, selectedActivity.id, selectedService.id))) : null, [db, companyId, selectedActivity, selectedService]);

  const { data: activities, loading: activitiesLoading } = useCollection<ActivityType>(activitiesQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(servicesQuery);
  const { data: subServices, loading: subLoading } = useCollection<SubService>(subServicesQuery);

  const handleSaveActivity = () => {
    if (!pathService || !activityForm?.name) return;
    const data = { ...activityForm, order: 0, isActive: true, name: activityForm.name || '', nameEn: activityForm.nameEn || '' };
    if (activityForm.id) pathService.updateActivityType(activityForm.id, data);
    else pathService.addActivityType(data as any);
    toast({ title: t('saved') });
    setActivityForm(null);
  };

  const handleSaveService = () => {
    if (!pathService || !selectedActivity?.id || !serviceForm?.name) return;
    const data = { ...serviceForm, order: 0, isActive: true, name: serviceForm.name || '', nameEn: serviceForm.nameEn || '' };
    if (serviceForm.id) pathService.updateService(selectedActivity.id, serviceForm.id, data);
    else pathService.addService(selectedActivity.id, data);
    toast({ title: t('saved') });
    setServiceForm(null);
  };

  const handleSaveSub = () => {
    if (!pathService || !selectedActivity?.id || !selectedService?.id || !subForm?.name) return;
    const data = { ...subForm, order: 0, isActive: true, name: subForm.name || '', nameEn: subForm.nameEn || '' };
    if (subForm.id) pathService.updateSubService(selectedActivity.id, selectedService.id, subForm.id, data);
    else pathService.addSubService(selectedActivity.id, selectedService.id, data);
    toast({ title: t('saved') });
    setSubForm(null);
  };

  if (viewMode === 'stages' && selectedActivity && selectedService && selectedSub) {
    return <TechnicalStagesManager activityType={selectedActivity} service={selectedService} subService={selectedSub} onBack={() => setViewMode('main')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3 text-start"><Workflow className="h-6 w-6 text-primary" /> {isRtl ? 'هندسة المسارات الفنية' : 'Technical Path Engineering'}</h2>
        <Button onClick={() => setActivityForm({ name: '', nameEn: '' })} className="rounded-xl shadow-lg"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'نشاط جديد' : 'New Activity'}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 text-start"><CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'الأنشطة' : 'Activities'}</CardTitle></CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {activitiesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : activities?.map(act => (
                <div key={act.id} onClick={() => { setSelectedActivity(act); setSelectedService(null); setSelectedSub(null); }} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedActivity?.id === act.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? act.name : act.nameEn}</span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.stopPropagation(); setActivityForm(act); }}><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); if(confirm(t('confirmDelete'))) pathService?.deleteActivityType(act.id!); }}><Trash2 className="h-4 w-4" /></Button>
                    <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedActivity?.id === act.id && 'text-primary')} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-4", !selectedActivity && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between"><CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400"><Boxes className="h-4 w-4" /> {isRtl ? 'الخدمات' : 'Services'}</CardTitle>{selectedActivity && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setServiceForm({ name: '', nameEn: '' })}><Plus className="h-5 w-5" /></Button>}</CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {!selectedActivity ? <div className="p-10 text-center text-xs italic text-muted-foreground">اختر نشاطاً</div> : servicesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : services?.map(srv => (
                <div key={srv.id} onClick={() => { setSelectedService(srv); setSelectedSub(null); }} className={cn("p-5 border-b flex items-center justify-between cursor-pointer transition-all group", selectedService?.id === srv.id ? 'bg-blue-50/50 border-s-4 border-s-blue-500' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? srv.name : srv.nameEn}</span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={(e) => { e.stopPropagation(); setServiceForm(srv); }}><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); if(confirm(t('confirmDelete'))) pathService?.deleteService(selectedActivity.id!, srv.id!); }}><Trash2 className="h-4 w-4" /></Button>
                    <ChevronRight className={cn("h-4 w-4 ms-2", isRtl && 'rotate-180', selectedService?.id === srv.id && 'text-blue-500')} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={cn("lg:col-span-4", !selectedService && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between"><CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400"><Layers className="h-4 w-4" /> {isRtl ? 'المسارات' : 'Sub-Services'}</CardTitle>{selectedService && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSubForm({ name: '', nameEn: '' })}><Plus className="h-5 w-5" /></Button>}</CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {!selectedService ? <div className="p-10 text-center text-xs italic text-muted-foreground">اختر خدمة</div> : subLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : subServices?.map(sub => (
                <div key={sub.id} className={cn("p-5 border-b flex items-center justify-between group transition-all", selectedSub?.id === sub.id ? 'bg-emerald-50/50 border-s-4 border-s-emerald-500' : 'hover:bg-muted/30')}>
                  <span className="text-sm font-black">{isRtl ? sub.name : sub.nameEn}</span>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => { setSelectedSub(sub); setViewMode('stages'); }} variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black border-primary/20 text-primary">إدارة المراحل</Button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setSubForm(sub)}><Edit3 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if(confirm(t('confirmDelete'))) pathService?.deleteSubService(selectedActivity!.id!, selectedService.id!, sub.id!); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {activityForm && (
        <Dialog open onOpenChange={() => setActivityForm(null)}>
          <DialogContent className="rounded-[2rem] max-w-lg p-8" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-xl">{activityForm.id ? t('edit') : t('newActivity')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-start">
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={activityForm.name || ''} onChange={e => setActivityForm({...activityForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={activityForm.nameEn || ''} onChange={e => setActivityForm({...activityForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
            </div>
            <DialogFooter className="mt-8"><Button onClick={handleSaveActivity} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {serviceForm && (
        <Dialog open onOpenChange={() => setServiceForm(null)}>
          <DialogContent className="rounded-[2rem] max-w-lg p-8" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-xl">{serviceForm.id ? t('edit') : t('newService')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-start">
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={serviceForm.name || ''} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={serviceForm.nameEn || ''} onChange={e => setServiceForm({...serviceForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
            </div>
            <DialogFooter className="mt-8"><Button onClick={handleSaveService} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {subForm && (
        <Dialog open onOpenChange={() => setSubForm(null)}>
          <DialogContent className="rounded-[2rem] max-w-lg p-8" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-xl">{subForm.id ? t('edit') : t('newPath')}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-start">
              <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={subForm.name || ''} onChange={e => setSubForm({...subForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={subForm.nameEn || ''} onChange={e => setSubForm({...subForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
            </div>
            <DialogFooter className="mt-8"><Button onClick={handleSaveSub} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
