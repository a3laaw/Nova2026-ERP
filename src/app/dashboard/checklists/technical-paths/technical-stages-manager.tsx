'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, Plus, Loader2, Trash2, Edit3, 
  Workflow, ArrowRight, Clock, Layers, DollarSign,
  ChevronUp, ChevronDown, ListChecks
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { TechnicalPathService } from '@/services/technical-path-service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TechnicalStage, SubService, TransactionType } from '@/types/reference';

interface Props {
  transactionType: TransactionType;
  subService: SubService;
  onBack: () => void;
}

export function TechnicalStagesManager({ transactionType, subService, onBack }: Props) {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TechnicalStage>>({
    code: '', name: '', nameEn: '', description: '', stageType: 'Internal', 
    controlType: 'TimeBased', trackingType: 'Manual', expectedDurationDays: 0,
    maxOccurrences: 1, isEditable: true, isRequired: true, allowParallel: false,
    billableTrigger: false, milestoneKey: '', clientVisible: true, order: 0, isActive: true
  });

  const service = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.technicalStages(companyId, transactionType.id!, subService.id!)), orderBy('order')) : null
  , [db, companyId, transactionType, subService]);

  const { data: stages, loading } = useCollection<TechnicalStage>(stagesQuery);

  const handleSave = async () => {
    if (!service || !form.name || !form.code) return;
    setLoadingAction('save');
    try {
      if (form.id) { await service.updateTechnicalStage(transactionType.id!, subService.id!, form.id, form); }
      else { await service.addTechnicalStage(transactionType.id!, subService.id!, form as any); }
      toast({ title: t('saved') });
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const moveOrder = async (stage: TechnicalStage, direction: 'up' | 'down') => {
    if (!service) return;
    const newOrder = direction === 'up' ? stage.order - 1 : stage.order + 1;
    await service.updateTechnicalStage(transactionType.id!, subService.id!, stage.id!, { order: newOrder });
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
              <Badge variant="secondary" className="bg-primary/5 text-primary text-[10px]">{isRtl ? transactionType.name : transactionType.nameEn}</Badge>
              <ArrowRight className={cn("h-3 w-3 text-muted-foreground opacity-30", !isRtl && 'rotate-180')} />
              <Badge variant="outline" className="text-[10px]">{isRtl ? subService.name : subService.nameEn}</Badge>
            </div>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ code: '', name: '', nameEn: '', description: '', stageType: 'Internal', controlType: 'TimeBased', trackingType: 'Manual', expectedDurationDays: 0, billableTrigger: false, milestoneKey: '', clientVisible: true, order: (stages?.length || 0) + 1, isActive: true })} className="rounded-xl">
              <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة مرحلة فنية' : 'Add Technical Stage'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-4xl max-h-[90vh] overflow-y-auto" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'تعريف مرحلة فنية' : 'New Technical Stage'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 text-start">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Order</Label><Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} /></div>
                </div>
                <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} /></div>
                <div className="space-y-2"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="rounded-2xl" /></div>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed space-y-4">
                  <div className="space-y-2"><Label>{isRtl ? 'نوع المرحلة' : 'Stage Type'}</Label><Select value={form.stageType} onValueChange={val => setForm({...form, stageType: val as any})}><SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Internal">Internal</SelectItem><SelectItem value="ClientReview">Client Review</SelectItem><SelectItem value="Permit">Permit</SelectItem><SelectItem value="Execution">Execution</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>{isRtl ? 'المدة المتوقعة (أيام)' : 'Days'}</Label><Input type="number" value={form.expectedDurationDays || ''} onChange={e => setForm({...form, expectedDurationDays: Number(e.target.value)})} className="bg-white" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    {['isRequired', 'clientVisible', 'billableTrigger'].map(key => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white rounded-xl border text-[9px] font-bold"><span>{key}</span><Switch checked={(form as any)[key]} onCheckedChange={val => setForm({...form, [key]: val})} /></div>
                    ))}
                    <div className="space-y-1"><Label className="text-[9px]">Milestone Key</Label><Input value={form.milestoneKey} onChange={e => setForm({...form, milestoneKey: e.target.value})} placeholder="M1" className="h-8 bg-white" /></div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4"><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl font-bold">{loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="py-40 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
        <div className="grid grid-cols-1 gap-4">
          {stages?.map((stage, idx) => (
            <Card key={stage.id} className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden group">
              <div className="flex items-stretch">
                <div className="w-16 bg-slate-50 border-e flex flex-col items-center justify-center gap-1">
                   <Button variant="ghost" size="icon" onClick={() => moveOrder(stage, 'up')} disabled={idx === 0} className="h-6 w-6"><ChevronUp className="h-4 w-4" /></Button>
                   <span className="text-xl font-black text-primary/40">#{stage.order}</span>
                   <Button variant="ghost" size="icon" onClick={() => moveOrder(stage, 'down')} disabled={idx === stages.length - 1} className="h-6 w-6"><ChevronDown className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 p-6 flex items-center justify-between">
                  <div className="text-start">
                    <div className="flex items-center gap-3">
                       <h3 className="font-black text-slate-800">{isRtl ? stage.name : stage.nameEn}</h3>
                       <Badge variant="outline" className="text-[8px] font-mono">{stage.code}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                       <Badge variant="secondary" className="text-[8px] bg-slate-100 text-slate-600 gap-1"><Clock className="h-2 w-2" /> {stage.expectedDurationDays} D</Badge>
                       <Badge variant="secondary" className="text-[8px] bg-slate-100 text-slate-600 gap-1"><ListChecks className="h-2 w-2" /> {stage.stageType}</Badge>
                       {stage.billableTrigger && <Badge className="text-[8px] bg-emerald-500 text-white gap-1"><DollarSign className="h-2 w-2" /> Billable</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                     <Button variant="ghost" size="icon" onClick={() => setForm(stage)} className="h-10 w-10 text-blue-600"><Edit3 className="h-5 w-5" /></Button>
                     <Button variant="ghost" size="icon" onClick={() => service?.deleteTechnicalStage(transactionType.id!, subService.id!, stage.id!)} className="h-10 w-10 text-destructive"><Trash2 className="h-5 w-5" /></Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
