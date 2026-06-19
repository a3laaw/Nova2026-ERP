'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Workflow, Plus, Loader2, Trash2, Edit3, 
  ChevronRight, Search, LayoutGrid, Layers, Boxes, ArrowLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { TechnicalPathService } from '@/services/technical-path-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [activityForm, setActivityForm] = useState<Partial<ActivityType> | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<Service> | null>(null);
  const [subForm, setSubForm] = useState<Partial<SubService> | null>(null);

  const pathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);

  // Queries
  const activitiesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const servicesQuery = useMemo(() => companyId && db && selectedActivity?.id ? query(collection(db, paths.services(companyId, selectedActivity.id)), orderBy('order')) : null, [db, companyId, selectedActivity]);
  const subServicesQuery = useMemo(() => companyId && db && selectedActivity?.id && selectedService?.id ? query(collection(db, paths.subServices(companyId, selectedActivity.id, selectedService.id)), orderBy('order')) : null, [db, companyId, selectedActivity, selectedService]);

  const { data: activities, loading: activitiesLoading } = useCollection<ActivityType>(activitiesQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(servicesQuery);
  const { data: subServices, loading: subLoading } = useCollection<SubService>(subServicesQuery);

  const handleSaveActivity = async () => {
    if (!pathService || !activityForm || !activityForm.name) return;
    setLoadingAction('act');
    try {
      if (activityForm.id) await pathService.updateActivityType(activityForm.id, activityForm);
      else await pathService.addActivityType(activityForm as any);
      toast({ title: t('saved') });
      setActivityForm(null);
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleSaveService = async () => {
    if (!pathService || !selectedActivity?.id || !serviceForm || !serviceForm.name) return;
    setLoadingAction('srv');
    try {
      if (serviceForm.id) await pathService.updateService(selectedActivity.id, serviceForm.id, serviceForm);
      else await pathService.addService(selectedActivity.id, serviceForm);
      toast({ title: t('saved') });
      setServiceForm(null);
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleSaveSub = async () => {
    if (!pathService || !selectedActivity?.id || !selectedService?.id || !subForm || !subForm.name) return;
    setLoadingAction('sub');
    try {
      if (subForm.id) await pathService.updateSubService(selectedActivity.id, selectedService.id, subForm.id, subForm);
      else await pathService.addSubService(selectedActivity.id, selectedService.id, subForm);
      toast({ title: t('saved') });
      setSubForm(null);
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!pathService || !confirm(t('confirmDelete'))) return;
    await pathService.deleteActivityType(id);
    if (selectedActivity?.id === id) {
      setSelectedActivity(null);
      setSelectedService(null);
      setSelectedSub(null);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!pathService || !selectedActivity?.id || !confirm(t('confirmDelete'))) return;
    await pathService.deleteService(selectedActivity.id, id);
    if (selectedService?.id === id) {
      setSelectedService(null);
      setSelectedSub(null);
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!pathService || !selectedActivity?.id || !selectedService?.id || !confirm(t('confirmDelete'))) return;
    await pathService.deleteSubService(selectedActivity.id, selectedService.id, id);
    if (selectedSub?.id === id) setSelectedSub(null);
  };

  if (viewMode === 'stages' && selectedActivity && selectedService && selectedSub) {
    return (
      <TechnicalStagesManager 
        activityType={selectedActivity}
        service={selectedService}
        subService={selectedSub} 
        onBack={() => setViewMode('main')} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-headline flex items-center gap-3">
          <Workflow className="h-6 w-6 text-primary" />
          {isRtl ? 'هندسة المسارات الفنية' : 'Technical Path Engineering'}
        </h2>
        <Button 
          onClick={() => setActivityForm({ code: '', name: '', isActive: true, order: (activities?.length || 0) + 1 })}
          className="rounded-xl shadow-lg shadow-primary/20"
        >
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'نشاط أعمال جديد' : 'New Activity'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Activity Types */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-4"><CardTitle className="text-sm font-black flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> {isRtl ? 'الأنشطة' : 'Activities'}</CardTitle></CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {activitiesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : activities?.map(act => (
                <div key={act.id} onClick={() => { setSelectedActivity(act); setSelectedService(null); setSelectedSub(null); }} className={cn("p-4 border-b flex items-center justify-between cursor-pointer transition-all group", selectedActivity?.id === act.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                  <span className="text-xs font-black">{act.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={(e) => { e.stopPropagation(); setActivityForm(act); }}><Edit3 className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteActivity(act.id!); }}><Trash2 className="h-3 w-3" /></Button>
                    <ChevronRight className={cn("h-3 w-3 ms-1", isRtl && 'rotate-180', selectedActivity?.id === act.id && 'text-primary')} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Services */}
        <div className={cn("lg:col-span-3 transition-opacity", !selectedActivity && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black flex items-center gap-2"><Boxes className="h-4 w-4 text-blue-500" /> {isRtl ? 'الخدمات' : 'Services'}</CardTitle>
              {selectedActivity && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setServiceForm({ name: '', code: '', isActive: true, order: (services?.length || 0) + 1 })}><Plus className="h-4 w-4" /></Button>}
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {!selectedActivity ? <div className="p-10 text-center text-[10px] italic">اختر نشاطاً</div> : servicesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : services?.map(srv => (
                <div key={srv.id} onClick={() => { setSelectedService(srv); setSelectedSub(null); }} className={cn("p-4 border-b flex items-center justify-between cursor-pointer transition-all group", selectedService?.id === srv.id ? 'bg-blue-50/50 border-s-4 border-s-blue-500' : 'hover:bg-muted/30')}>
                  <span className="text-xs font-black">{srv.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={(e) => { e.stopPropagation(); setServiceForm(srv); }}><Edit3 className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteService(srv.id!); }}><Trash2 className="h-3 w-3" /></Button>
                    <ChevronRight className={cn("h-3 w-3 ms-1", isRtl && 'rotate-180', selectedService?.id === srv.id && 'text-blue-500')} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Sub-Services */}
        <div className={cn("lg:col-span-6 transition-opacity", !selectedService && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-sm font-black flex items-center gap-2"><Layers className="h-4 w-4 text-emerald-500" /> {isRtl ? 'المسارات التفصيلية' : 'Sub-Services'}</CardTitle>
                <CardDescription className="text-[10px]">{selectedService?.name || '...'}</CardDescription>
              </div>
              {selectedService && <Button variant="secondary" size="sm" className="h-8 rounded-lg" onClick={() => setSubForm({ name: '', code: '', isActive: true, order: (subServices?.length || 0) + 1 })}><Plus className="h-3 w-3 me-1" /> إضافة مسار</Button>}
            </CardHeader>
            <CardContent className="p-4">
              {!selectedService ? <div className="p-20 text-center text-xs text-muted-foreground">يرجى اختيار خدمة للعرض</div> : subLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : (
                <div className="space-y-3">
                  {subServices?.map(sub => (
                    <div key={sub.id} className="p-4 rounded-2xl border-2 bg-white flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
                      <div className="text-start">
                        <p className="text-sm font-black text-slate-800">{sub.name}</p>
                        <Badge variant="outline" className="text-[8px] font-mono mt-1 opacity-70">{sub.code}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => { setSelectedSub(sub); setViewMode('stages'); }} variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black border-primary/20 text-primary hover:bg-primary/5">إدارة المراحل</Button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setSubForm(sub)}><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSub(sub.id!)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog for Activity */}
      {activityForm && (
        <Dialog open onOpenChange={() => setActivityForm(null)}>
          <DialogContent className="rounded-3xl max-w-lg" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-xl">{activityForm.id ? 'تعديل نشاط' : 'تعريف نشاط أعمال'}</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-6 text-start">
              <div className="space-y-2"><Label>Code (مثال: CONSULTING)</Label><Input value={activityForm.code} onChange={e => setActivityForm({...activityForm, code: e.target.value})} /></div>
              <div className="space-y-2"><Label>الاسم (بالعربي)</Label><Input value={activityForm.name} onChange={e => setActivityForm({...activityForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Name (English)</Label><Input value={activityForm.nameEn} onChange={e => setActivityForm({...activityForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveActivity} disabled={loadingAction === 'act'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'act' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog for Service */}
      {serviceForm && (
        <Dialog open onOpenChange={() => setServiceForm(null)}>
          <DialogContent className="rounded-3xl max-w-lg" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-xl">{serviceForm.id ? 'تعديل خدمة' : 'خدمة جديدة'}</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-6 text-start">
              <div className="space-y-2"><Label>Code (مثال: DESIGN)</Label><Input value={serviceForm.code} onChange={e => setServiceForm({...serviceForm, code: e.target.value})} /></div>
              <div className="space-y-2"><Label>الاسم (بالعربي)</Label><Input value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Name (English)</Label><Input value={serviceForm.nameEn} onChange={e => setServiceForm({...serviceForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveService} disabled={loadingAction === 'srv'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'srv' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog for SubService */}
      {subForm && (
        <Dialog open onOpenChange={() => setSubForm(null)}>
          <DialogContent className="rounded-3xl max-w-lg" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-xl">{subForm.id ? 'تعديل مسار' : 'مسار تفصيلي جديد'}</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-6 text-start">
              <div className="space-y-2"><Label>Code (مثال: MUN-PERMIT)</Label><Input value={subForm.code} onChange={e => setSubForm({...subForm, code: e.target.value})} /></div>
              <div className="space-y-2"><Label>الاسم (بالعربي)</Label><Input value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Name (English)</Label><Input value={subForm.nameEn} onChange={e => setSubForm({...subForm, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveSub} disabled={loadingAction === 'sub'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'sub' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
