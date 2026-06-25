'use client';

import { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Loader2, Trash2, Edit3, 
  Workflow, ArrowRight, Clock,
  ListChecks, ShieldCheck,
  GripVertical, ChevronUp, ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { TechnicalPathService } from '@/services/technical-path-service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [form, setForm] = useState<Partial<TechnicalStage> | null>(null);

  const technicalPathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);
  const stagesQuery = useMemo(() => companyId && db ? query(collection(db, paths.technicalStages(companyId, activityType.id!, mainService.id!, subService.id!))) : null, [db, companyId, activityType, mainService, subService]);
  const { data: stages, loading } = useCollection<TechnicalStage>(stagesQuery);

  const sortedStages = useMemo(() => {
    return [...(stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [stages]);

  const handleSave = async () => {
    if (!technicalPathService || !form || !form.name) return;
    setLoadingAction('save');
    
    const nextOrder = form.id !== undefined ? form.order : sortedStages.length;
    const generatedCode = form.code || (form.nameEn || form.name || 'STAGE').toUpperCase().replace(/\s+/g, '_');

    const data = { 
      ...form, 
      code: generatedCode,
      isActive: true, 
      isRequired: form.isRequired !== undefined ? form.isRequired : true, 
      isEditable: form.isEditable !== undefined ? form.isEditable : true, 
      order: nextOrder,
      nextStageIds: form.nextStageIds || [], 
      name: form.name || '', 
      nameEn: form.nameEn || '', 
      description: form.description || '',
      // تخزين مسار التتبع لسهولة الربط في القاموس
      fullPathName: isRtl 
        ? `${activityType.name} > ${mainService.name}` 
        : `${activityType.nameEn} > ${mainService.nameEn}`
    };

    try {
      if (form.id) {
        await technicalPathService.updateTechnicalStage(activityType.id!, mainService.id!, subService.id!, form.id, data);
      } else {
        await technicalPathService.addTechnicalStage(activityType.id!, mainService.id!, subService.id!, data);
      }
      toast({ title: t('saved') });
      setForm(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!technicalPathService || !stages) return;
    const newStages = [...sortedStages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    setLoadingAction('reorder');
    try {
      await technicalPathService.reorderStages(activityType.id!, mainService.id!, subService.id!, newStages);
      toast({ title: isRtl ? "تم تحديث ترتيب المسار" : "Order Updated" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const getAncestors = (targetId: string, allStages: TechnicalStage[]) => {
    const ancestors = new Set<string>();
    const stack = [targetId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const parents = allStages.filter(s => s.nextStageIds?.includes(currentId));
      parents.forEach(p => { if (p.id && !ancestors.has(p.id)) { ancestors.add(p.id); stack.push(p.id); } });
    }
    return ancestors;
  };

  const availableNextStages = useMemo(() => {
    if (!form || !stages) return [];
    if (!form.id) return stages;
    const ancestors = getAncestors(form.id, stages);
    return stages.filter(s => s.id !== form.id && !ancestors.has(s.id!));
  }, [form, stages]);

  const toggleNextStage = (stageId: string) => {
    if (!form) return;
    const currentIds = form.nextStageIds || [];
    const newIds = currentIds.includes(stageId) ? currentIds.filter(id => id !== stageId) : [...currentIds, stageId];
    setForm({ ...form, nextStageIds: newIds });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-start">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-10 w-10 p-0 bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-4 w-4", !isRtl && 'rotate-180')} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" /> {isRtl ? 'هندسة مراحل العمل' : 'Work Stages Engineering'}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-bold border-primary/20">{isRtl ? activityType.name : activityType.nameEn}</Badge>
              <ArrowRight className={cn("h-3 w-3 opacity-30", !isRtl && 'rotate-180')} />
              <Badge variant="outline" className="text-[10px] font-bold border-blue-200">{isRtl ? mainService.name : mainService.nameEn}</Badge>
              <ArrowRight className={cn("h-3 w-3 opacity-30", !isRtl && 'rotate-180')} />
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[10px] font-black">{isRtl ? subService.name : subService.nameEn}</Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => setForm({ name: '', nameEn: '', description: '', code: '', isNumeric: false, isTimed: false, nextStageIds: [] })} variant="default" className="h-11 shadow-lg shadow-primary/20">
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة مرحلة' : 'Add Stage'}
        </Button>
      </div>

      {loading || loadingAction === 'reorder' ? <div className="py-40 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
        <div className="grid grid-cols-1 gap-4">
          {sortedStages.length === 0 ? <div className="py-20 text-center bg-white rounded-xl border-2 border-dashed border-muted"><p className="font-bold text-muted-foreground italic">لا توجد مراحل معرّفة.</p></div> : 
            sortedStages.map((stage, idx) => (
              <Card key={stage.id} className="border-0 shadow-lg rounded-xl bg-white overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all text-start">
                <div className="flex items-center p-5 justify-between">
                  <div className="text-start flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6 rounded-md text-slate-300 hover:text-primary disabled:opacity-20"
                         disabled={idx === 0}
                         onClick={() => handleMove(idx, 'up')}
                       >
                          <ChevronUp className="h-4 w-4" />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6 rounded-md text-slate-300 hover:text-primary disabled:opacity-20"
                         disabled={idx === sortedStages.length - 1}
                         onClick={() => handleMove(idx, 'down')}
                       >
                          <ChevronDown className="h-4 w-4" />
                       </Button>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-base">{isRtl ? stage.name : stage.nameEn}</h3>
                      <div className="flex gap-3 mt-1">
                         <span className="text-[10px] font-black text-primary bg-primary/5 px-2 rounded">#{idx + 1}</span>
                         {stage.isTimed && <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Clock className="h-3 w-3" /> {stage.timeTargetDays} {isRtl ? 'يوم' : 'Days'}</span>}
                         {stage.isNumeric && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><ListChecks className="h-3 w-3" /> {isRtl ? 'مستهدف:' : 'Target:'} {stage.numericTarget}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button variant="ghost" size="icon" onClick={() => setForm(stage)} className="h-10 w-10 rounded-xl text-blue-600 hover:bg-blue-50"><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if(confirm(t('confirmDelete'))) technicalPathService?.deleteTechnicalStage(activityType.id!, mainService.id!, subService.id!, stage.id!); }} className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/5"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </Card>
            ))
          }
        </div>
      )}

      {form && (
        <Dialog open onOpenChange={() => setForm(null)}>
          <DialogContent className="rounded-xl p-0 overflow-hidden max-w-4xl border-0 shadow-3xl bg-white" dir={dir}>
            <div className="grid grid-cols-1 lg:grid-cols-5 h-full max-h-[85vh]">
              <div className="lg:col-span-3 p-8 space-y-6 overflow-y-auto bg-white border-e">
                <DialogHeader className="text-start">
                  <DialogTitle className="text-2xl font-black font-headline flex items-center gap-2 text-slate-800">
                    <ShieldCheck className="text-primary h-7 w-7" /> {form.id ? t('editStage') : t('addStage')}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-5 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{t('name')} (Ar)</Label>
                      <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="h-11 border-2 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">{t('name')} (En)</Label>
                      <Input value={form.nameEn || ''} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-11 border-2 font-bold text-start" dir="ltr" />
                    </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-xl border-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <Label className="font-black text-sm">{isRtl ? 'تتبع زمني' : 'Time Tracking'}</Label>
                        <Switch checked={form.isTimed || false} onCheckedChange={val => setForm({...form, isTimed: val})} />
                    </div>
                    {form.isTimed && <Input type="number" value={form.timeTargetDays || ''} onChange={e => setForm({...form, timeTargetDays: Number(e.target.value)})} className="h-11 bg-white border-2" placeholder={isRtl ? 'عدد الأيام المستهدفة' : 'Days'} />}
                    
                    <div className="flex items-center justify-between border-t pt-6">
                        <Label className="font-black text-sm">{isRtl ? 'تتبع عددي' : 'Numeric Tracking'}</Label>
                        <Switch checked={form.isNumeric || false} onCheckedChange={val => setForm({...form, isNumeric: val})} />
                    </div>
                    {form.isNumeric && <Input type="number" value={form.numericTarget || ''} onChange={e => setForm({...form, numericTarget: Number(e.target.value)})} className="h-11 bg-white border-2" placeholder={isRtl ? 'الكمية المستهدفة' : 'Target Qty'} />}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'الوصف' : 'Description'}</Label>
                    <Textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="rounded-xl border-2 min-h-[100px]" />
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t">
                  <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl">
                    {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}
                  </Button>
                </DialogFooter>
              </div>

              <div className="lg:col-span-2 bg-slate-50/50 p-8 flex flex-col">
                <div className="mb-6 text-start">
                  <h4 className="font-black text-lg flex items-center gap-2 text-slate-700"><ArrowRight className="h-5 w-5 text-primary" /> {t('nextStages')}</h4>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-3">
                    {availableNextStages.length === 0 ? <div className="py-10 text-center bg-white/50 rounded-xl border-2 border-dashed"><p className="text-[10px] text-slate-400 font-bold px-4">لا توجد مراحل متاحة للربط.</p></div> : 
                      availableNextStages.map((s) => (
                        <div key={s.id} onClick={() => toggleNextStage(s.id!)} className={cn("p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3", form.nextStageIds?.includes(s.id!) ? "bg-white border-primary shadow-md" : "bg-white border-slate-100")}>
                          <Checkbox id={`stage-${s.id}`} checked={form.nextStageIds?.includes(s.id!)} className="h-5 w-5 pointer-events-none" /><Label className="font-black text-xs block cursor-pointer text-slate-700">{isRtl ? s.name : s.nameEn}</Label>
                        </div>
                      ))
                    }
                  </div>
                </ScrollArea>
                <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                  <span>{isRtl ? 'المراحل المربوطة' : 'Linked'}</span>
                  <Badge variant="secondary" className="bg-primary text-white">{form.nextStageIds?.length || 0}</Badge>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}