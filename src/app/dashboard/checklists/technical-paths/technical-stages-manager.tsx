'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Loader2, Trash2, Edit3, 
  Workflow, ArrowRight, Clock,
  ListChecks, ShieldCheck,
  AlertCircle,
  GripVertical,
  Languages,
  Zap
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
import { translateText } from '@/ai/flows/translate-flow';

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
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);

  const technicalPathService = useMemo(() => db && companyId ? new TechnicalPathService(db, companyId) : null, [db, companyId]);
  
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.technicalStages(companyId, activityType.id!, mainService.id!, subService.id!))) : null
  , [db, companyId, activityType, mainService, subService]);

  const { data: stages, loading } = useCollection<TechnicalStage>(stagesQuery);

  // منطق الترجمة التلقائية مع Debounce
  useEffect(() => {
    if (!autoTranslate || !form?.name || form.id) return; // لا نترجم عند التعديل أو إذا كانت الخاصية معطلة

    const delayDebounceFn = setTimeout(async () => {
      if (form.name && form.name.length > 2) {
        setIsTranslating(true);
        try {
          const result = await translateText({ text: form.name, targetLang: 'en' });
          setForm(prev => prev ? { ...prev, nameEn: result.translatedText } : null);
        } catch (error) {
          console.error("Translation error:", error);
        } finally {
          setIsTranslating(false);
        }
      }
    }, 800); // ننتظر 800ms بعد توقف المستخدم عن الكتابة

    return () => clearTimeout(delayDebounceFn);
  }, [form?.name, autoTranslate]);

  const getAncestors = (targetId: string, allStages: TechnicalStage[]) => {
    const ancestors = new Set<string>();
    const stack = [targetId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const parents = allStages.filter(s => s.nextStageIds?.includes(currentId));
      parents.forEach(p => {
        if (p.id && !ancestors.has(p.id)) {
          ancestors.add(p.id);
          stack.push(p.id);
        }
      });
    }
    return ancestors;
  };

  const availableNextStages = useMemo(() => {
    if (!form || !stages) return [];
    if (!form.id) return stages;
    const ancestors = getAncestors(form.id, stages);
    return stages.filter(s => s.id !== form.id && !ancestors.has(s.id!));
  }, [form, stages]);

  const handleSave = () => {
    if (!technicalPathService || !form || !form.name) return;
    setLoadingAction('save');
    const data = { 
      ...form, 
      isActive: true, 
      isRequired: true, 
      isEditable: true, 
      nextStageIds: form.nextStageIds || [],
      name: form.name || '',
      nameEn: form.nameEn || '',
      description: form.description || ''
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
          onClick={() => setForm({ name: '', nameEn: '', description: '', isNumeric: false, isTimed: false, nextStageIds: [] })}
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
            <Card key={stage.id} className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all text-start">
              <div className="flex items-center p-5 justify-between">
                <div className="text-start flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">{isRtl ? stage.name : stage.nameEn}</h3>
                    <div className="flex gap-3 mt-1">
                       {stage.isTimed && <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><Clock className="h-3 w-3" /> {stage.timeTargetDays} {isRtl ? 'يوم' : 'Days'}</span>}
                       {stage.isNumeric && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><ListChecks className="h-3 w-3" /> {isRtl ? 'مستهدف:' : 'Target:'} {stage.numericTarget}</span>}
                       {stage.nextStageIds && stage.nextStageIds.length > 0 && (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-primary/60">
                           <ArrowRight className="h-3 w-3" /> {stage.nextStageIds.length} {isRtl ? 'روابط' : 'Links'}
                         </span>
                       )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <Button variant="ghost" size="icon" onClick={() => setForm(stage)} className="h-10 w-10 rounded-xl text-blue-600 hover:bg-blue-50"><Edit3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(stage.id!)} className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/5"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <Dialog open onOpenChange={() => setForm(null)}>
          <DialogContent className="rounded-[2rem] max-w-4xl overflow-hidden p-0 border-0 shadow-2xl" dir={dir}>
            <div className="grid grid-cols-1 lg:grid-cols-5 h-full max-h-[85vh]">
              {/* Left Side: Form Details */}
              <div className="lg:col-span-3 p-8 space-y-6 overflow-y-auto bg-white">
                <DialogHeader className="flex flex-row items-center justify-between">
                  <DialogTitle className="text-start font-black text-xl flex items-center gap-2 text-slate-800">
                    <ShieldCheck className="text-primary h-6 w-6" /> 
                    {form.id ? (isRtl ? 'تعديل المرحلة الفنية' : 'Edit Technical Stage') : (isRtl ? 'تعريف مرحلة عمل' : 'New Work Stage')}
                  </DialogTitle>
                  {!form.id && (
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full ring-1 ring-black/5">
                       <Zap className={cn("h-3 w-3 transition-colors", autoTranslate ? "text-primary" : "text-slate-400")} />
                       <span className="text-[10px] font-black text-slate-600">{isRtl ? 'ترجمة تلقائية' : 'Auto-Translate'}</span>
                       <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} className="scale-75" />
                    </div>
                  )}
                </DialogHeader>
                
                <div className="space-y-5 py-2 text-start">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">{t('name')} (Ar)</Label>
                      <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="h-11 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white transition-all" placeholder="مثال: تصميم معماري" />
                    </div>
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-bold text-slate-500">{t('name')} (En)</Label>
                      <Input value={form.nameEn || ''} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-11 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-start" dir="ltr" placeholder="e.g. Architectural Design" />
                      {isTranslating && <div className="absolute right-3 top-9"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{isRtl ? 'تتبع زمني' : 'Time Tracking'}</Label>
                            <Switch checked={form.isTimed || false} onCheckedChange={val => setForm({...form, isTimed: val})} />
                        </div>
                        {form.isTimed && <Input type="number" value={form.timeTargetDays || ''} onChange={e => setForm({...form, timeTargetDays: Number(e.target.value)})} className="h-9 rounded-lg bg-white" placeholder={isRtl ? 'الأيام المستهدفة' : 'Target days'} />}
                    </div>
                    
                    <div className="space-y-3 border-s border-slate-200 ps-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{isRtl ? 'تتبع عددي' : 'Numeric Tracking'}</Label>
                            <Switch checked={form.isNumeric || false} onCheckedChange={val => setForm({...form, isNumeric: val})} />
                        </div>
                        {form.isNumeric && <Input type="number" value={form.numericTarget || ''} onChange={e => setForm({...form, numericTarget: Number(e.target.value)})} className="h-9 rounded-lg bg-white" placeholder={isRtl ? 'الكمية المستهدفة' : 'Target quantity'} />}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500">{isRtl ? 'الوصف الفني' : 'Technical Description'}</Label>
                    <Textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="rounded-xl min-h-[80px] bg-slate-50/50 border-slate-200 focus:bg-white resize-none" placeholder="..." />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-12 rounded-xl font-black text-base bg-primary hover:opacity-90 shadow-xl shadow-primary/20 transition-all">
                    {loadingAction === 'save' ? <Loader2 className="animate-spin h-5 w-5" /> : t('save')}
                  </Button>
                </DialogFooter>
              </div>

              {/* Right Side: Next Stages Multi-Select */}
              <div className="lg:col-span-2 bg-slate-50/80 border-s border-slate-100 p-8 flex flex-col">
                <div className="mb-6">
                  <h4 className="font-black text-base flex items-center gap-2 text-slate-700">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    {isRtl ? 'المسار المنطقي' : 'Logic Path'}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-bold mt-1 leading-relaxed">
                    {isRtl ? 'حدد المراحل التي تعتمد مباشرة على اكتمال هذه المرحلة.' : 'Select stages that depend on this completion.'}
                  </p>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-3">
                    {availableNextStages.length === 0 ? (
                      <div className="py-10 text-center bg-white/50 rounded-2xl border border-dashed border-slate-200">
                        <AlertCircle className="text-slate-300 h-8 w-8 mx-auto mb-2" />
                        <p className="text-[9px] text-slate-400 font-bold px-4 leading-relaxed">
                          {isRtl 
                            ? 'لا توجد مراحل متاحة للربط. (يتم حظر الأسلاف لمنع الحلقات المفرغة).' 
                            : 'No stages available. Ancestors hidden for logic safety.'}
                        </p>
                      </div>
                    ) : (
                      availableNextStages.map((s) => (
                        <div 
                          key={s.id} 
                          onClick={() => toggleNextStage(s.id!)}
                          className={cn(
                            "p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 group",
                            form.nextStageIds?.includes(s.id!) 
                              ? "bg-primary/5 border-primary/30 shadow-sm" 
                              : "bg-white border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <Checkbox 
                            id={`stage-${s.id}`} 
                            checked={form.nextStageIds?.includes(s.id!)} 
                            className="h-4 w-4 pointer-events-none data-[state=checked]:bg-primary"
                          />
                          <Label htmlFor={`stage-${s.id}`} className="font-black text-[11px] block cursor-pointer text-slate-600">
                            {isRtl ? s.name : s.nameEn}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المراحل المربوطة' : 'Linked Stages'}</span>
                  <Badge className="bg-primary text-white font-black rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {form.nextStageIds?.length || 0}
                  </Badge>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
