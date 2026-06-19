'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Loader2, Trash2, Edit3, 
  Workflow, ArrowRight, Clock,
  ListChecks, ShieldCheck
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
    companyId && db ? query(collection(db, paths.technicalStages(companyId, activityType.id!, mainService.id!, subService.id!)), orderBy('order')) : null
  , [db, companyId, activityType, mainService, subService]);

  const { data: stages, loading } = useCollection<TechnicalStage>(stagesQuery);

  const handleSave = async () => {
    if (!technicalPathService || !form || !form.name) return;
    setLoadingAction('save');
    try {
      if (form.id) { 
        await technicalPathService.updateTechnicalStage(activityType.id!, mainService.id!, subService.id!, form.id, form); 
      } else { 
        await technicalPathService.addTechnicalStage(activityType.id!, mainService.id!, subService.id!, { ...form, code: '' } as any); 
      }
      toast({ title: t('saved') });
      setForm(null);
    } catch (e) { toast({ variant: "destructive", title: t('error') }); }
    finally { setLoadingAction(null); }
  };

  const handleDelete = async (id: string) => {
    if (!technicalPathService || !confirm(t('confirmDelete'))) return;
    await technicalPathService.deleteTechnicalStage(activityType.id!, mainService.id!, subService.id!, id);
    toast({ title: t('deleted') });
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
              <Workflow className="h-6 w-6 text-primary" /> {isRtl ? 'هندسة مراحل العمل' : 'WBS Engineering'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
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
            order: (stages?.length || 0) + 1, isActive: true, 
            isRequired: true, isEditable: true, isNumeric: false, isTimed: false 
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
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 border flex items-center justify-center font-black text-primary text-xl">
                    {stage.order}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-slate-800 text-lg">{isRtl ? stage.name : stage.nameEn}</h3>
                      {stage.isRequired && <Badge className="bg-amber-100 text-amber-700 text-[8px] font-black">إلزامية</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-bold mt-1 line-clamp-1">{stage.description || 'لا يوجد وصف...'}</p>
                    <div className="flex gap-4 mt-2">
                       {stage.isTimed && <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><Clock className="h-3 w-3" /> {stage.timeTargetDays} يوم</span>}
                       {stage.isNumeric && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><ListChecks className="h-3 w-3" /> مستهدف: {stage.numericTarget}</span>}
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
          <DialogContent className="rounded-[2.5rem] max-w-2xl" dir={dir}>
            <DialogHeader><DialogTitle className="text-start font-black text-2xl flex items-center gap-2">
              <ShieldCheck className="text-primary h-6 w-6" /> {form.id ? 'تعديل مرحلة فنية' : 'تعريف مرحلة فنية جديدة'}
            </DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 text-start">
              <div className="space-y-2"><Label>الترتيب</Label><Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} /></div>
              <div className="space-y-2"><Label>اسم المرحلة (Ar)</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Stage Name (En)</Label><Input value={form.nameEn || ''} onChange={e => setForm({...form, nameEn: e.target.value})} className="text-start" dir="ltr" /></div>
              
              <div className="md:col-span-2 space-y-4 p-6 bg-slate-50 rounded-3xl border">
                 <div className="flex items-center justify-between">
                    <div className="space-y-0.5"><Label className="text-base">تحكم زمني</Label><p className="text-xs text-muted-foreground font-bold">تحديد عدد أيام مستهدف للإنجاز</p></div>
                    <Switch checked={form.isTimed || false} onCheckedChange={val => setForm({...form, isTimed: val})} />
                 </div>
                 {form.isTimed && <div className="pt-2 animate-in slide-in-from-top-2"><Label>الأيام المستهدفة</Label><Input type="number" value={form.timeTargetDays || ''} onChange={e => setForm({...form, timeTargetDays: Number(e.target.value)})} /></div>}
                 
                 <div className="flex items-center justify-between border-t pt-4">
                    <div className="space-y-0.5"><Label className="text-base">تحكم عددي</Label><p className="text-xs text-muted-foreground font-bold">تحديد كمية مستهدفة (أمتار، قطع، إلخ)</p></div>
                    <Switch checked={form.isNumeric || false} onCheckedChange={val => setForm({...form, isNumeric: val})} />
                 </div>
                 {form.isNumeric && <div className="pt-2 animate-in slide-in-from-top-2"><Label>الكمية المستهدفة</Label><Input type="number" value={form.numericTarget || ''} onChange={e => setForm({...form, numericTarget: Number(e.target.value)})} /></div>}
              </div>

              <div className="md:col-span-2 space-y-2"><Label>الوصف الفني للمرحلة</Label><Textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="rounded-2xl h-24" /></div>
            </div>
            <DialogFooter><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20">{loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
