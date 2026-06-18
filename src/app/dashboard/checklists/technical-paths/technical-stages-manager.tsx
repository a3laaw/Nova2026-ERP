'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, Plus, Loader2, Trash2, Edit3, 
  CheckCircle2, XCircle, Layers, ArrowRight,
  Clock, Hash, ShieldCheck, Eye, Ban, DollarSign,
  ChevronUp, ChevronDown, ListChecks, Workflow
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
    nextStageIds: [], blockedByStageIds: [], defaultAssigneeDepartmentIds: [],
    defaultAssigneeJobIds: [], billableTrigger: false, milestoneKey: '',
    clientVisible: true, order: 0, isActive: true
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
      const data = { ...form } as any;
      if (form.id) {
        await service.updateTechnicalStage(transactionType.id!, subService.id!, form.id, data);
      } else {
        await service.addTechnicalStage(transactionType.id!, subService.id!, data);
      }
      toast({ title: t('saved'), description: t('entryAdded') });
      // Reset form handled by Dialog onOpenChange if preferred, or manual here
    } catch (e) {
      toast({ variant: "destructive", title: t('error'), description: t('saveFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!service || !confirm(t('confirmDelete'))) return;
    try {
      await service.deleteTechnicalStage(transactionType.id!, subService.id!, id);
      toast({ title: t('deleted') });
    } catch (e) {}
  };

  const moveOrder = async (stage: TechnicalStage, direction: 'up' | 'down') => {
    if (!service) return;
    const newOrder = direction === 'up' ? stage.order - 1 : stage.order + 1;
    await service.updateTechnicalStage(transactionType.id!, subService.id!, stage.id!, { order: newOrder });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-start">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-2xl h-12 w-12 p-0 bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", dir === 'rtl' ? '' : 'rotate-180')} />
          </Button>
          <div>
            <h1 className="text-3xl font-black font-headline flex items-center gap-3">
              <Workflow className="h-8 w-8 text-primary" />
              {isRtl ? 'هندسة مراحل العمل' : 'WBS Engineering'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary font-black">{isRtl ? transactionType.name : transactionType.nameEn}</Badge>
              <ArrowRight className={cn("h-3 w-3 text-muted-foreground", dir === 'rtl' ? '' : 'rotate-180')} />
              <Badge variant="outline" className="font-bold">{isRtl ? subService.name : subService.nameEn}</Badge>
            </div>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ code: '', name: '', nameEn: '', description: '', stageType: 'Internal', controlType: 'TimeBased', trackingType: 'Manual', expectedDurationDays: 0, maxOccurrences: 1, isEditable: true, isRequired: true, allowParallel: false, nextStageIds: [], blockedByStageIds: [], defaultAssigneeDepartmentIds: [], defaultAssigneeJobIds: [], billableTrigger: false, milestoneKey: '', clientVisible: true, order: (stages?.length || 0) + 1, isActive: true })} className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              <Plus className="me-2 h-6 w-6" />
              {isRtl ? 'إضافة مرحلة فنية' : 'Add Technical Stage'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[3rem] border-0 shadow-2xl max-w-5xl max-h-[90vh] overflow-y-auto" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-start font-headline font-black text-2xl">{isRtl ? 'تعريف مرحلة فنية جديدة' : 'New Technical Stage'}</DialogTitle>
              <DialogDescription className="text-start">{isRtl ? 'حدد خصائص المرحلة والقيود التشغيلية المرتبطة بها.' : 'Define stage characteristics and operational constraints.'}</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-8 text-start">
              {/* Basic Info */}
              <div className="space-y-4 lg:col-span-2">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isRtl ? 'كود المرحلة' : 'Stage Code'}</Label>
                      <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="STEP-1" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRtl ? 'الترتيب' : 'Order'}</Label>
                      <Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} placeholder="1" className="h-14 rounded-2xl border-2" />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('name')} (Ar)</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="إعداد المسودة" className="h-14 rounded-2xl border-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('name')} (En)</Label>
                      <Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} placeholder="Drafting" className="h-14 rounded-2xl border-2 text-start" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label>{isRtl ? 'الوصف التفصيلي' : 'Description'}</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="rounded-3xl border-2 min-h-[100px]" />
                 </div>
              </div>

              {/* Logic Configuration */}
              <div className="space-y-6 bg-slate-50 p-8 rounded-[2.5rem] border-2 border-dashed">
                  <h4 className="font-black text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {isRtl ? 'إعدادات التحكم' : 'Control Config'}
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{isRtl ? 'نوع المرحلة' : 'Stage Type'}</Label>
                      <Select value={form.stageType} onValueChange={val => setForm({...form, stageType: val as any})}>
                        <SelectTrigger className="h-12 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Internal">{isRtl ? 'داخلية' : 'Internal'}</SelectItem>
                          <SelectItem value="ClientReview">{isRtl ? 'مراجعة عميل' : 'Client Review'}</SelectItem>
                          <SelectItem value="Permit">{isRtl ? 'ترخيص' : 'Permit'}</SelectItem>
                          <SelectItem value="Execution">{isRtl ? 'تنفيذ ميداني' : 'Execution'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{isRtl ? 'نوع التحكم' : 'Control Type'}</Label>
                      <Select value={form.controlType} onValueChange={val => setForm({...form, controlType: val as any})}>
                        <SelectTrigger className="h-12 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TimeBased">{isRtl ? 'زمني (أيام)' : 'Time Based'}</SelectItem>
                          <SelectItem value="Numeric">{isRtl ? 'عددي' : 'Numeric'}</SelectItem>
                          <SelectItem value="Hybrid">{isRtl ? 'هجين' : 'Hybrid'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{isRtl ? 'المدة المتوقعة (يوم)' : 'Expected Days'}</Label>
                      <Input type="number" value={form.expectedDurationDays || ''} onChange={e => setForm({...form, expectedDurationDays: Number(e.target.value)})} className="h-12 rounded-xl bg-white" />
                    </div>
                  </div>
              </div>

              {/* Advanced Flags */}
              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-6 rounded-[2.5rem]">
                 {[
                   { label: isRtl ? 'إلزامية' : 'Required', key: 'isRequired' },
                   { label: isRtl ? 'قابلة للتعديل' : 'Editable', key: 'isEditable' },
                   { label: isRtl ? 'تنفيذ متوازي' : 'Parallel', key: 'allowParallel' },
                   { label: isRtl ? 'مرئية للعميل' : 'Client Vis.', key: 'clientVisible' },
                   { label: isRtl ? 'محفز مالي' : 'Billable', key: 'billableTrigger' },
                   { label: isRtl ? 'نشطة' : 'Active', key: 'isActive' },
                 ].map((flag) => (
                    <div key={flag.key} className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                      <Label className="text-xs font-black">{flag.label}</Label>
                      <Switch checked={(form as any)[flag.key]} onCheckedChange={val => setForm({...form, [flag.key]: val})} />
                    </div>
                 ))}
                 <div className="col-span-2 space-y-2">
                    <Label>{isRtl ? 'مفتاح Milestone (اختياري)' : 'Milestone Key'}</Label>
                    <Input value={form.milestoneKey} onChange={e => setForm({...form, milestoneKey: e.target.value})} placeholder="M1" className="h-14 rounded-2xl border-2 bg-white" />
                 </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 bg-white pt-6 border-t mt-4">
              <Button onClick={handleSave} disabled={loadingAction === 'save' || !form.name} className="w-full h-16 rounded-[2rem] font-black text-xl bg-primary shadow-2xl shadow-primary/30">
                {loadingAction === 'save' ? <Loader2 className="animate-spin" /> : (isRtl ? 'حفظ المرحلة في القالب' : 'Save Stage to Template')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="py-40 text-center"><Loader2 className="animate-spin mx-auto h-16 w-16 text-primary/20" /></div> : (
        stages?.length === 0 ? (
          <Card className="border-4 border-dashed rounded-[3rem] py-40 text-center bg-white">
            <Layers className="h-20 w-20 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-xl font-black text-muted-foreground italic">{isRtl ? 'لا توجد مراحل معرفة لهذا المسار' : 'No stages defined for this path'}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {stages?.map((stage, idx) => (
              <Card key={stage.id} className="group border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 hover:ring-primary/30 transition-all">
                <div className="flex items-stretch">
                  <div className="w-20 bg-slate-50 flex flex-col items-center justify-center border-e gap-2 group-hover:bg-primary/5 transition-colors">
                    <Button variant="ghost" size="icon" onClick={() => moveOrder(stage, 'up')} disabled={idx === 0} className="h-8 w-8 rounded-full"><ChevronUp className="h-4 w-4" /></Button>
                    <span className="text-2xl font-black text-primary/40">#{stage.order}</span>
                    <Button variant="ghost" size="icon" onClick={() => moveOrder(stage, 'down')} disabled={idx === stages.length - 1} className="h-8 w-8 rounded-full"><ChevronDown className="h-4 w-4" /></Button>
                  </div>
                  
                  <div className="flex-1 p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="text-start space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                         <h3 className="text-xl font-black text-slate-800">{isRtl ? stage.name : stage.nameEn}</h3>
                         <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">{stage.code}</Badge>
                         {stage.isRequired && <Badge className="bg-rose-50 text-rose-600 border-rose-100 text-[10px] font-black uppercase tracking-widest">{isRtl ? 'إلزامية' : 'Required'}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">{stage.description || '...'}</p>
                      
                      <div className="flex flex-wrap gap-3 mt-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 gap-1.5 py-1 px-3 rounded-xl border-0">
                          <Clock className="h-3 w-3" /> {stage.expectedDurationDays} {isRtl ? 'يوم' : 'Days'}
                        </Badge>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 gap-1.5 py-1 px-3 rounded-xl border-0">
                          <ListChecks className="h-3 w-3" /> {stage.stageType}
                        </Badge>
                        {stage.billableTrigger && (
                          <Badge className="bg-emerald-500 text-white gap-1.5 py-1 px-3 rounded-xl border-0 shadow-lg shadow-emerald-500/20">
                            <DollarSign className="h-3 w-3" /> {isRtl ? 'محفز فوترة' : 'Billable'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setForm(stage)} className="h-12 w-12 text-blue-600 bg-blue-50 rounded-2xl hover:scale-110 transition-transform"><Edit3 className="h-5 w-5" /></Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[3rem] border-0 shadow-2xl max-w-5xl max-h-[90vh] overflow-y-auto" dir={dir}>
                             {/* Reusing Form in Dialog */}
                             <DialogHeader><DialogTitle className="text-start font-black text-2xl">{isRtl ? 'تعديل المرحلة الفنية' : 'Edit Technical Stage'}</DialogTitle></DialogHeader>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-8 text-start">
                                <div className="space-y-4 lg:col-span-2">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>{isRtl ? 'كود المرحلة' : 'Stage Code'}</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="space-y-2"><Label>{isRtl ? 'الترتيب' : 'Order'}</Label><Input type="number" value={form.order || ''} onChange={e => setForm({...form, order: Number(e.target.value)})} className="h-14 rounded-2xl border-2" /></div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>{t('name')} (Ar)</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-2" /></div>
                                    <div className="space-y-2"><Label>{t('name')} (En)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="h-14 rounded-2xl border-2 text-start" /></div>
                                  </div>
                                  <div className="space-y-2"><Label>{isRtl ? 'الوصف التفصيلي' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="rounded-3xl border-2 min-h-[100px]" /></div>
                                </div>
                                <div className="space-y-6 bg-slate-50 p-8 rounded-[2.5rem] border-2 border-dashed">
                                  <div className="space-y-4">
                                    <div className="space-y-2"><Label>{isRtl ? 'نوع المرحلة' : 'Stage Type'}</Label><Select value={form.stageType} onValueChange={val => setForm({...form, stageType: val as any})}><SelectTrigger className="h-12 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Internal">Internal</SelectItem><SelectItem value="ClientReview">Client Review</SelectItem><SelectItem value="Permit">Permit</SelectItem><SelectItem value="Execution">Execution</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><Label>{isRtl ? 'نوع التحكم' : 'Control Type'}</Label><Select value={form.controlType} onValueChange={val => setForm({...form, controlType: val as any})}><SelectTrigger className="h-12 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TimeBased">Time Based</SelectItem><SelectItem value="Numeric">Numeric</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><Label>{isRtl ? 'المدة المتوقعة (يوم)' : 'Expected Days'}</Label><Input type="number" value={form.expectedDurationDays || ''} onChange={e => setForm({...form, expectedDurationDays: Number(e.target.value)})} className="h-12 rounded-xl bg-white" /></div>
                                  </div>
                                </div>
                                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-6 rounded-[2.5rem]">
                                  {['isRequired', 'isEditable', 'allowParallel', 'clientVisible', 'billableTrigger', 'isActive'].map(key => (
                                    <div key={key} className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                                      <Label className="text-xs font-black">{key}</Label><Switch checked={(form as any)[key]} onCheckedChange={val => setForm({...form, [key]: val})} />
                                    </div>
                                  ))}
                                  <div className="col-span-2 space-y-2"><Label>Milestone Key</Label><Input value={form.milestoneKey} onChange={e => setForm({...form, milestoneKey: e.target.value})} className="h-14 rounded-2xl border-2 bg-white" /></div>
                                </div>
                             </div>
                             <DialogFooter className="sticky bottom-0 bg-white pt-6 border-t mt-4"><Button onClick={handleSave} disabled={loadingAction === 'save'} className="w-full h-16 rounded-[2rem] font-black text-xl bg-primary">{loadingAction === 'save' ? <Loader2 className="animate-spin" /> : t('save')}</Button></DialogFooter>
                          </DialogContent>
                       </Dialog>
                       <Button variant="ghost" size="icon" onClick={() => handleDelete(stage.id!)} className="h-12 w-12 text-destructive bg-destructive/5 rounded-2xl hover:scale-110 transition-transform"><Trash2 className="h-5 w-5" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
