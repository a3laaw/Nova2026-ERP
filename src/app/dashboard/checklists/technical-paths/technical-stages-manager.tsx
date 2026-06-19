'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Loader2, Trash2, Edit3, 
  Workflow, ArrowRight, Clock,
  ListChecks, ShieldCheck, CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
  
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.technicalStages(companyId, activityType.id!, mainService.id!, subService.id!))) : null
  , [db, companyId, activityType, mainService, subService]);

  const { data: stages, loading } = useCollection<TechnicalStage>(stagesQuery);

  // منطق الفلترة الذكي لمنع التعارض المنطقي والربط العكسي
  const availableNextStages = useMemo(() => {
    if (!form || !stages) return [];
    
    return stages.filter(s => {
      // 1. منع الربط مع النفس
      if (s.id === form.id) return false;

      // 2. منع الربط العكسي المباشر:
      // إذا كانت هذه المرحلة (s) تشير بالفعل إلى المرحلة الحالية (form.id) كمرحلة تالية لها
      // فلا يجوز للمرحلة الحالية أن تشير إليها، منعاً للحلقة المفرغة.
      const isAlreadyAPredecessor = s.nextStageIds?.includes(form.id!);
      
      return !isAlreadyAPredecessor;
    });
  }, [form, stages]);

  const handleSave = () => {
    if (!technicalPathService || !form || !form.name) return;
    setLoadingAction('save');
    
    const data = { 
      ...form, 
      isActive: true, 
      isRequired: true, 
      isEditable: true,
      nextStageIds: form.nextStageIds || []
    };

    if (form.id) { 
      technicalPathService.updateTechnicalStage(activityType.id!, mainService.id!, subService.id!, form.id, data); 
    } else { 
      technicalPathService.addTechnicalStage(activityType.id!, mainService.id!, subService.id!, data); 
    }
    toast({ title: t('saved') });
    setForm(null);
    setLoadingAction(null);
  };

  const handleDelete = (id: string) => {
    if (!technicalPathService || !confirm(t('confirmDelete'))) return;
    technicalPathService.deleteTechnicalStage(activityType.id!, mainService.id!, subService.id!, id);
    toast({ title: t('deleted') });
  };

  const toggleNextStage = (stageId: string) => {
    if (!form) return;
    const currentIds = form.nextStageIds || [];
    const newIds = currentIds.includes(stageId)
      ? currentIds.filter(id => id !== stageId)
      : [...currentIds, stageId];
    setForm({ ...form, nextStageIds: newIds });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-10 w-10 p-0 bg-white shadow-sm border hover:bg-slate-50 transition-colors">
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

        <Button 
          onClick={() => setForm({ 
            name: '', nameEn: '', description: '', 
            isNumeric: false, isTimed: false,
            nextStageIds: []
          })}
          className="rounded-xl shadow-lg shadow-primary/20 font-bold"
        >
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة مرحلة' : 'Add Stage'}
        </Button>
      </div>

      {loading ? <div className="py-40 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : (
        <div className="grid grid-cols-1 gap-4">
          {stages?.length === 0 ? (
             <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-muted">
                <p className="font-bold text-muted-foreground italic">لا توجد مراحل معرفة لهذا المسار بعد.</p>
             </div>
          ) : stages?.map((stage) => (
            <Card key={stage.id} className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all text-start">
              <div className="flex items-center p-6 justify-between">
                <div className="text-start flex items-center gap-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-slate-800 text-lg">{isRtl ? stage.name : stage.nameEn}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold mt-1 line-clamp-1">{stage.description || '...'}</p>
                    <div className="flex gap-4 mt-2">
                       {stage.isTimed && <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><Clock className="h-3 w-3" /> {stage.timeTargetDays} يوم</span>}
                       {stage.isNumeric && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><ListChecks className="h-3 w-3" /> مستهدف: {stage.numericTarget}</span>}
                       {stage.nextStageIds && stage.nextStageIds.length > 0 && (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                           <ArrowRight className="h-3 w-3" /> {stage.nextStageIds.length} {isRtl ? 'مراحل تالية' : 'Next Stages'}
                         </span>
                       )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <Button variant="ghost" size="icon" onClick={() => setForm(stage)} className="h-12 w-12 rounded-xl text-blue-600 hover:bg-blue-50"><Edit3 className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(stage.id!)} className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/5"><Trash2 className="h-5 w-5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <Dialog open onOpenChange={() => setForm(null)}>
          <DialogContent className="rounded-[2.5rem] max-w-4xl overflow-hidden p-0 border-0" dir={dir}>
            <div className="grid grid-cols-1 lg:grid-cols-5 h-full max-h-[90vh]">
              {/* Left Side: Form Details */}
              <div className="lg:col-span-3 p-8 space-y-6 overflow-y-auto bg-white">
                <DialogHeader>
                  <DialogTitle className="text-start font-black text-2xl flex items-center gap-2">
                    <ShieldCheck className="text-primary h-6 w-6" /> {form.id ? (isRtl ? 'تعديل مرحلة' : 'Edit Stage') : (isRtl ? 'مرحلة جديدة' : 'New Stage')}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 text-start">
                  <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="..." /></div>
                  <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={form.nameEn || ''} onChange={e => setForm({...form, nameEn: e.target.value})} className="text-start" dir="ltr" placeholder="..." /></div>
                  
                  <div className="md:col-span-2 space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5"><Label className="text-sm font-black">{isRtl ? 'تحكم زمني' : 'Time Control'}</Label><p className="text-[10px] text-muted-foreground font-bold">{isRtl ? 'تحديد مدة مستهدفة للأيام' : 'Set target duration'}</p></div>
                        <Switch checked={form.isTimed || false} onCheckedChange={val => setForm({...form, isTimed: val})} />
                    </div>
                    {form.isTimed && <div className="pt-1 animate-in slide-in-from-top-2"><Label className="text-xs">{isRtl ? 'عدد الأيام' : 'Days'}</Label><Input type="number" value={form.timeTargetDays || ''} onChange={e => setForm({...form, timeTargetDays: Number(e.target.value)})} placeholder="10" /></div>}
                    
                    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                        <div className="space-y-0.5"><Label className="text-sm font-black">{isRtl ? 'تحكم عددي' : 'Numeric Control'}</Label><p className="text-[10px] text-muted-foreground font-bold">{isRtl ? 'تحديد كمية مستهدفة (أمتار، قطع)' : 'Set target quantity'}</p></div>
                        <Switch checked={form.isNumeric || false} onCheckedChange={val => setForm({...form, isNumeric: val})} />
                    </div>
                    {form.isNumeric && <div className="pt-1 animate-in slide-in-from-top-2"><Label className="text-xs">{isRtl ? 'الكمية المستهدفة' : 'Quantity'}</Label><Input type="number" value={form.numericTarget || ''} onChange={e => setForm({...form, numericTarget: Number(e.target.value)})} placeholder="100" /></div>}
                  </div>

                  <div className="md:col-span-2 space-y-2"><Label>{isRtl ? 'الوصف الفني' : 'Description'}</Label><Textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="rounded-2xl h-20" placeholder="..." /></div>
                </div>

                <DialogFooter className="pt-4">
                  <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">
                    {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}
                  </Button>
                </DialogFooter>
              </div>

              {/* Right Side: Next Stages Multi-Select with Protection Logic */}
              <div className="lg:col-span-2 bg-slate-50 border-s border-slate-200 p-8 flex flex-col">
                <div className="mb-6">
                  <h4 className="font-black text-lg flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    {isRtl ? 'المراحل التالية' : 'Next Stages'}
                  </h4>
                  <p className="text-xs text-muted-foreground font-bold mt-1">
                    {isRtl ? 'حدد التسلسل المنطقي للعمل' : 'Define the logical sequence'}
                  </p>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-3">
                    {availableNextStages.length === 0 ? (
                      <div className="py-10 text-center space-y-4">
                        <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle className="text-muted-foreground h-6 w-6" />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold leading-relaxed px-4">
                          {isRtl 
                            ? 'لا توجد مراحل متاحة للربط. (المراحل التي تسبق هذه المرحلة أو تشير لنفسها تم استبعادها تلقائياً لضمان سلامة التدفق).' 
                            : 'No stages available. (Predecessors and self-references are hidden to ensure workflow integrity).'}
                        </p>
                      </div>
                    ) : (
                      availableNextStages.map((s) => (
                        <div 
                          key={s.id} 
                          onClick={() => toggleNextStage(s.id!)}
                          className={cn(
                            "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 group",
                            form.nextStageIds?.includes(s.id!) 
                              ? "bg-primary/10 border-primary shadow-sm" 
                              : "bg-white border-slate-200 hover:border-primary/40"
                          )}
                        >
                          <Checkbox 
                            id={`stage-${s.id}`} 
                            checked={form.nextStageIds?.includes(s.id!)} 
                            className="mt-1 pointer-events-none"
                          />
                          <div className="text-start">
                            <Label htmlFor={`stage-${s.id}`} className="font-black text-sm block cursor-pointer">
                              {isRtl ? s.name : s.nameEn}
                            </Label>
                            {form.nextStageIds?.includes(s.id!) && (
                              <span className="text-[10px] font-black text-primary animate-in fade-in">
                                {isRtl ? 'مرحلة تالية' : 'Next Stage'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>{isRtl ? 'المحدد' : 'Selected'}</span>
                    <span className="text-primary font-black">{form.nextStageIds?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
