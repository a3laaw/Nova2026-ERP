'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Save, X, Plus, Trash2, Loader2, ArrowRight,
  Gavel, Calculator, Info, Landmark, Clock, FileText,
  BadgeCheck, Zap, AlertTriangle, DollarSign
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { ContractTemplate, ContractMilestone } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface Props {
  template: ContractTemplate | null;
  onClose: () => void;
}

export function ContractTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ContractTemplate>>(
    template || {
      name: '',
      code: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      introText: '',
      legalText: '',
      closingText: '',
      clauses: [''],
      defaultMilestones: [{ name: isRtl ? 'الدفعة المقدمة' : 'Advance Payment', percentage: 10, timing: 'at', contractualEvent: 'SIGNING' }],
      isDefault: false,
      isActive: true,
      version: 1
    }
  );

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);
  const stagesQuery = useMemo(() => companyId && db && formData.subServiceId ? query(collection(db, paths.technicalStages(companyId, formData.activityTypeId!, formData.serviceId!, formData.subServiceId!)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const totalPercentage = useMemo(() => formData.defaultMilestones?.reduce((acc, m) => acc + (m.percentage || 0), 0) || 0, [formData.defaultMilestones]);
  const isMathValid = totalPercentage === 100;

  const addMilestone = () => {
    setFormData({
      ...formData,
      defaultMilestones: [...(formData.defaultMilestones || []), { name: '', percentage: 0, timing: 'after', contractualEvent: 'MANUAL' }]
    });
  };

  const removeMilestone = (idx: number) => {
    setFormData({ ...formData, defaultMilestones: (formData.defaultMilestones || []).filter((_, i) => i !== idx) });
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newMilestones = [...(formData.defaultMilestones || [])];
    newMilestones[idx] = { ...newMilestones[idx], [field]: value };
    setFormData({ ...formData, defaultMilestones: newMilestones });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !isMathValid) return;
    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      if (template?.id) await service.updateTemplate('contract', template.id, formData, user.uid);
      else await service.addTemplate('contract', formData, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border"><ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} /></Button>
          <div className="text-start"><h1 className="text-2xl font-black font-headline">{isRtl ? 'إعداد قالب العقد القانوني' : 'Setup Contract Template'}</h1></div>
        </div>
        <Button onClick={handleSave} disabled={loading || !isMathValid} className="bg-primary text-white font-black rounded-xl h-12 px-8 shadow-xl gap-2">{loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}{t('save')}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardContent className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label><Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" /></div>
                     <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'كود العقد' : 'Contract Code'}</Label><Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
                     <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{t('orgRef')}</Label><Select value={formData.activityTypeId || ''} onValueChange={v => setFormData({...formData, activityTypeId: v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger><SelectContent className="rounded-xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent></Select></div>
                     <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{t('techRef')}</Label><Select disabled={!formData.activityTypeId} value={formData.serviceId || ''} onValueChange={v => setFormData({...formData, serviceId: v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent></Select></div>
                     <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{t('newPath')}</Label><Select disabled={!formData.serviceId} value={formData.subServiceId || ''} onValueChange={v => setFormData({...formData, subServiceId: v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!}>{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent></Select></div>
                  </div>
               </CardContent>
            </Card>

            <div className="space-y-6">
               <h3 className="text-2xl font-black font-headline text-slate-800 flex items-center gap-3"><Calculator className="h-8 w-8 text-primary" /> {isRtl ? 'هيكلة دفعات التعاقد' : 'Contract Milestones Structure'}</h3>
               
               <div className="p-10 bg-emerald-50/40 rounded-[3rem] border-2 border-emerald-100/50 text-start relative overflow-hidden group shadow-sm">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="h-32 w-32" /></div>
                  <div className="max-w-md mx-auto space-y-3 relative z-10 text-center">
                     <Label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest flex items-center justify-center gap-2">{isRtl ? 'إجمالي قيمة العقد التقديرية (KWD)' : 'Total Estimated Contract Value (KWD)'}</Label>
                     <Input type="number" value={formData.baseAmount || 0} onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} className="h-16 rounded-[2rem] border-2 border-emerald-200 font-black text-3xl text-emerald-700 bg-white shadow-2xl text-center" />
                  </div>
               </div>

               <div className="space-y-4">
                  {formData.defaultMilestones?.map((m, idx) => (
                    <Card key={idx} className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
                       <CardContent className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                          <div className="md:col-span-3 space-y-2 text-start">
                             <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'مسمى الدفعة' : 'Milestone Name'}</Label>
                             <Input value={m.name || ''} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 border-2 font-bold" />
                          </div>
                          <div className="md:col-span-3 space-y-2 text-start">
                             <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'النسبة (%)' : 'Share (%)'}</Label>
                             <Input type="number" value={m.percentage || 0} onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))} className="h-10 text-center font-black text-emerald-600" />
                          </div>
                          <div className="md:col-span-4 space-y-2 text-start">
                             <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'الربط الميداني' : 'Field Link'}</Label>
                             <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                <SelectTrigger className="h-10 font-bold border-2"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent className="rounded-xl">{stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                             </Select>
                          </div>
                          <div className="md:col-span-2 flex justify-end"><Button variant="ghost" size="icon" onClick={() => removeMilestone(idx)} className="h-10 w-10 text-rose-300 hover:text-rose-600"><Trash2 className="h-5 w-5" /></Button></div>
                       </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" onClick={addMilestone} className="w-full h-16 rounded-[2rem] border-2 border-dashed border-primary/20 text-primary font-black gap-2 hover:bg-primary/5 transition-all"><Plus className="h-5 w-5" /> {t('addMilestone')}</Button>
               </div>

               <div className={cn("p-10 rounded-[3rem] border-4 border-dashed flex items-center justify-between transition-all", isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800")}>
                  <div className="text-center bg-white p-6 rounded-[2rem] shadow-xl min-w-[150px]"><span className="text-4xl font-black font-headline">{totalPercentage}%</span></div>
                  <div className="text-end space-y-1"><p className="font-black text-2xl font-headline">{t('totalQuoteShare')}</p><p className="text-[10px] font-bold opacity-60 uppercase">{isMathValid ? 'BALANCED' : 'MISMATCH (Must be 100%)'}</p></div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden text-start">
               <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-sm font-black flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'البنود القانونية' : 'Legal Clauses'}</CardTitle></CardHeader>
               <CardContent className="p-6"><Textarea value={formData.legalText || ''} onChange={e => setFormData({...formData, legalText: e.target.value})} className="min-h-[300px] rounded-2xl bg-slate-50/50 p-4 border-2 text-xs font-bold leading-relaxed" /></CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
