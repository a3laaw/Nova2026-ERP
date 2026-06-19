'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Loader2, Trash2, Edit3, 
  Workflow, ArrowRight, Clock, Layers,
  ChevronUp, ChevronDown, ListChecks
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { TechnicalStage, SubService, ActivityType, Service } from '@/types/reference';

interface Props {
  activityType: ActivityType;
  service: Service;
  subService: SubService;
  onBack: () => void;
}

export function TechnicalStagesManager({ activityType, service: mainService, subService, onBack }: Props) {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TechnicalStage>>({
    code: '', name: '', nameEn: '', description: '', 
    expectedDurationDays: 0, isRequired: true, isEditable: true,
    isActive: true, order: 0, nextStageIds: []
  });

  const technicalPathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);
  
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.technicalStages(companyId, activityType.id!, mainService.id!, subService.id!)), orderBy('order')) : null
  , [db, companyId, activityType, mainService, subService]);

  const { data: stages, loading } = useCollection<TechnicalStage>(stagesQuery);

  const handleSave = async () => {
    if (!technicalPathService || !form.name || !form.code) return;
    setLoadingAction('save');
    try {
      if (form.id) { 
        await technicalPathService.updateTechnicalStage(activityType.id!, mainService.id!, subService.id!, form.id, form); 
      } else { 
        await technicalPathService.addTechnicalStage(activityType.id!, mainService.id!, subService.id!, form as any); 
      }
      toast({ title: t('saved') });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-10 w-10 p-0 bg-white shadow-sm border">
             <ArrowRight className={cn("h-4 w-4", !isRtl && 'rotate-180')} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" /> {isRtl ? 'هندسة مراحل العمل' : 'WBS Engineering'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{activityType.name}</Badge>
              <ArrowRight className={cn("h-3 w-3 opacity-30", !isRtl && 'rotate-180')} />
              <Badge variant="outline" className="text-[10px]">{mainService.name}</Badge>
              <ArrowRight className={cn("h-3 w-3 opacity-30", !isRtl && 'rotate-180')} />
              <Badge variant="secondary" className="bg-primary/5 text-primary text-[10px]">{subService.name}</Badge>
            </div>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ code: '', name: '', isActive: true, order: (stages?.length || 0) + 1 })} className="rounded-xl">
              <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة مرحلة' : 'Add Stage'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-2xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black">تعريف مرحلة فنية</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
              <div className="space-y-2"><Label>الترتيب</Label><Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} /></div>
              <div className="space-y-2 md:col-span-2"><Label>اسم المرحلة</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="space-y-2 md:col-span-2"><Label>الوصف</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl font-bold">{t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="py-40 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
        <div className="grid grid-cols-1 gap-4">
          {stages?.map((stage, idx) => (
            <Card key={stage.id} className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden group">
              <div className="flex items-center p-6 justify-between">
                <div className="text-start">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-black">#{stage.order}</Badge>
                    <h3 className="font-black text-slate-800">{stage.name}</h3>
                    <Badge variant="outline" className="text-[8px] font-mono">{stage.code}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <Button variant="ghost" size="icon" onClick={() => setForm(stage)} className="h-10 w-10 text-blue-600"><Edit3 className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => technicalPathService?.deleteTechnicalStage(activityType.id!, mainService.id!, subService.id!, stage.id!)} className="h-10 w-10 text-destructive"><Trash2 className="h-5 w-5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
