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
import { Switch } from "@/components/ui/switch";
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
  const [activityForm, setActivityForm] = useState<Partial<ActivityType>>({ code: '', name: '', isActive: true, order: 0 });
  const [serviceForm, setServiceForm] = useState<Partial<Service>>({ code: '', name: '', isActive: true, order: 0 });
  const [subForm, setSubForm] = useState<Partial<SubService>>({ code: '', name: '', isActive: true, order: 0 });

  const pathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);

  // Queries
  const activitiesQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const servicesQuery = useMemo(() => companyId && db && selectedActivity?.id ? query(collection(db, paths.services(companyId, selectedActivity.id)), orderBy('order')) : null, [db, companyId, selectedActivity]);
  const subServicesQuery = useMemo(() => companyId && db && selectedActivity?.id && selectedService?.id ? query(collection(db, paths.subServices(companyId, selectedActivity.id, selectedService.id)), orderBy('order')) : null, [db, companyId, selectedActivity, selectedService]);

  const { data: activities, loading: activitiesLoading } = useCollection<ActivityType>(activitiesQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(servicesQuery);
  const { data: subServices, loading: subLoading } = useCollection<SubService>(subServicesQuery);

  const handleSaveActivity = async () => {
    if (!pathService || !activityForm.name) return;
    setLoadingAction('act');
    try {
      if (activityForm.id) await pathService.updateActivityType(activityForm.id, activityForm);
      else await pathService.addActivityType(activityForm as any);
      toast({ title: t('saved') });
      setActivityForm({ code: '', name: '', isActive: true, order: 0 });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleSaveService = async () => {
    if (!pathService || !selectedActivity?.id || !serviceForm.name) return;
    setLoadingAction('srv');
    try {
      if (serviceForm.id) await pathService.updateService(selectedActivity.id, serviceForm.id, serviceForm);
      else await pathService.addService(selectedActivity.id, serviceForm);
      toast({ title: t('saved') });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleSaveSub = async () => {
    if (!pathService || !selectedActivity?.id || !selectedService?.id || !subForm.name) return;
    setLoadingAction('sub');
    try {
      if (subForm.id) await pathService.updateSubService(selectedActivity.id, selectedService.id, subForm.id, subForm);
      else await pathService.addSubService(selectedActivity.id, selectedService.id, subForm);
      toast({ title: t('saved') });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
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
        <Dialog>
          <DialogTrigger asChild>
            <Button className="rounded-xl"><Plus className="me-2 h-4 w-4" /> {isRtl ? 'نشاط أعمال جديد' : 'New Activity'}</Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black">تعريف نشاط أعمال</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4 text-start">
              <div className="space-y-2"><Label>Code</Label><Input value={activityForm.code} onChange={e => setActivityForm({...activityForm, code: e.target.value})} /></div>
              <div className="space-y-2"><Label>الاسم</Label><Input value={activityForm.name} onChange={e => setActivityForm({...activityForm, name: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveActivity} disabled={loadingAction === 'act'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'act' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Activity Types */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4"><CardTitle className="text-sm font-black flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'الأنشطة' : 'Activities'}</CardTitle></CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {activitiesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary/30" /></div> : activities?.map(act => (
                <div key={act.id} onClick={() => { setSelectedActivity(act); setSelectedService(null); setSelectedSub(null); }} className={cn("p-4 border-b flex items-center justify-between cursor-pointer transition-all", selectedActivity?.id === act.id ? 'bg-primary/5 border-s-4 border-s-primary' : 'hover:bg-muted/30')}>
                  <span className="text-xs font-black">{act.name}</span>
                  <ChevronRight className={cn("h-3 w-3", isRtl && 'rotate-180', selectedActivity?.id === act.id && 'text-primary')} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Services */}
        <div className={cn("lg:col-span-3 transition-opacity", !selectedActivity && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black flex items-center gap-2"><Boxes className="h-4 w-4" /> {isRtl ? 'الخدمات' : 'Services'}</CardTitle>
              {selectedActivity && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setServiceForm({ name: '', code: '', isActive: true, order: (services?.length || 0) + 1 })}><Plus className="h-4 w-4" /></Button>}
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {!selectedActivity ? <div className="p-10 text-center text-[10px] italic">اختر نشاطاً</div> : servicesLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : services?.map(srv => (
                <div key={srv.id} onClick={() => { setSelectedService(srv); setSelectedSub(null); }} className={cn("p-4 border-b flex items-center justify-between cursor-pointer transition-all", selectedService?.id === srv.id ? 'bg-blue-50/50 border-s-4 border-s-blue-500' : 'hover:bg-muted/30')}>
                  <span className="text-xs font-black">{srv.name}</span>
                  <ChevronRight className={cn("h-3 w-3", isRtl && 'rotate-180', selectedService?.id === srv.id && 'text-blue-500')} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Sub-Services */}
        <div className={cn("lg:col-span-6 transition-opacity", !selectedService && 'opacity-30')}>
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
              <div className="text-start">
                <CardTitle className="text-sm font-black flex items-center gap-2"><Layers className="h-4 w-4" /> {isRtl ? 'المسارات التفصيلية' : 'Sub-Services'}</CardTitle>
                <CardDescription className="text-[10px]">{selectedService?.name || '...'}</CardDescription>
              </div>
              {selectedService && <Button variant="secondary" size="sm" className="h-8 rounded-lg" onClick={() => setSubForm({ name: '', code: '', isActive: true, order: (subServices?.length || 0) + 1 })}><Plus className="h-3 w-3 me-1" /> إضافة مسار</Button>}
            </CardHeader>
            <CardContent className="p-4">
              {!selectedService ? <div className="p-20 text-center text-xs text-muted-foreground">يرجى اختيار خدمة للعرض</div> : subLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : (
                <div className="space-y-3">
                  {subServices?.map(sub => (
                    <div key={sub.id} className="p-4 rounded-2xl border-2 bg-white flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="text-start">
                        <p className="text-sm font-black">{sub.name}</p>
                        <Badge variant="outline" className="text-[8px] font-mono mt-1">{sub.code}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => { setSelectedSub(sub); setViewMode('stages'); }} variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black">إدارة المراحل</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100" onClick={() => setSubForm(sub)}><Edit3 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dynamic Forms for Service & Sub-Service */}
      {(serviceForm.name !== undefined || subForm.name !== undefined) && (
        <Dialog open onOpenChange={() => { setServiceForm({ name: undefined }); setSubForm({ name: undefined }); }}>
          <DialogContent className="rounded-3xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black">{serviceForm.name !== undefined ? 'خدمة جديدة' : 'مسار تفصيلي جديد'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4 text-start">
              <div className="space-y-2"><Label>الاسم</Label><Input value={serviceForm.name !== undefined ? serviceForm.name : subForm.name} onChange={e => serviceForm.name !== undefined ? setServiceForm({...serviceForm, name: e.target.value}) : setSubForm({...subForm, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>الكود</Label><Input value={serviceForm.code !== undefined ? serviceForm.code : subForm.code} onChange={e => serviceForm.name !== undefined ? setServiceForm({...serviceForm, code: e.target.value}) : setSubForm({...subForm, code: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={serviceForm.name !== undefined ? handleSaveService : handleSaveSub} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
