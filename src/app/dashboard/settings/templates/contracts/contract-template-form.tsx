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
  BadgeCheck, Zap, AlertTriangle, DollarSign, ShieldCheck
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
import { Badge } from '@/components/ui/badge';

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

  // جلب المراجع الفنية للربط
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);
  
  // جلب مراحل العمل الميدانية لربط الدفعات بها
  const stagesQuery = useMemo(() => 
    companyId && db && formData.subServiceId ? 
    query(collection(db, paths.technicalStages(companyId, formData.activityTypeId!, formData.serviceId!, formData.subServiceId!)), orderBy('order')) : 
    null, 
  [db, companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const totalPercentage = useMemo(() => {
    return formData.defaultMilestones?.reduce((acc, m) => acc + (m.percentage || 0), 0) || 0;
  }, [formData.defaultMilestones]);

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
    if (!db || !companyId || !user) return;
    
    if (!formData.name || !formData.activityTypeId || !formData.serviceId) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "يرجى تعبئة البيانات الأساسية." : "Basic fields required." });
      return;
    }

    if (!isMathValid) {
      toast({ 
        variant: "destructive", 
        title: t('error'), 
        description: isRtl ? `مجموع نسب الدفعات ${totalPercentage}%، يجب أن يكون 100%.` : `Total must be 100%, currently ${totalPercentage}%` 
      });
      return;
    }

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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      {/* Header Controls */}
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'إعداد قالب العقد الرسمي' : 'Setup Contract Template'}</h1>
            <p className="text-xs font-bold text-muted-foreground">{isRtl ? 'هيكلة الدفعات المخططة والبنود القانونية.' : 'Structure planned milestones and legal clauses.'}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={onClose} className="rounded-xl font-bold h-12 px-6 border-2">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
           <Button onClick={handleSave} disabled={loading} className="bg-primary text-white font-black rounded-xl h-12 px-10 shadow-xl gap-2 hover:scale-[1.02] transition-all">
             {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
             {t('save')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         
         <div className="lg:col-span-8 space-y-8">
            {/* 1. Basic Identity */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardContent className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                        <Input 
                          value={formData.name || ''} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          className="h-12 rounded-xl border-2 font-bold bg-slate-50/30 focus:bg-white" 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود العقد المرجعي' : 'Contract Reference Code'}</Label>
                        <Input 
                          value={formData.code || ''} 
                          onChange={e => setFormData({...formData, code: e.target.value})} 
                          className="h-12 rounded-xl border-2 font-mono bg-slate-50/30" 
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('orgRef')}</Label>
                        <Select value={formData.activityTypeId || ''} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                              {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                           </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('techRef')}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId || ''} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                              {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                           </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('newPath')}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId || ''} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                              {subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* 2. Milestones & Financial Structure */}
            <div className="space-y-6">
               <div className="flex justify-between items-center px-6">
                  <h3 className="text-2xl font-black font-headline text-slate-800 flex items-center gap-3">
                     <Calculator className="h-8 w-8 text-primary" />
                     {isRtl ? 'هيكلة دفعات التعاقد' : 'Contract Milestones Structure'}
                  </h3>
                  <Badge variant="outline" className="bg-white font-black px-4 py-1.5 border-2 text-[10px] uppercase">Financial Logic</Badge>
               </div>
               
               {/* Emerald Total Amount Box */}
               <div className="p-10 bg-emerald-50/40 rounded-[3rem] border-2 border-emerald-100/50 text-start relative overflow-hidden group shadow-sm transition-all hover:bg-emerald-50">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                    <DollarSign className="h-32 w-32 text-emerald-600" />
                  </div>
                  <div className="max-w-md mx-auto space-y-3 relative z-10 text-center">
                     <Label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest flex items-center justify-center gap-2">
                        {isRtl ? 'إجمالي قيمة العقد التقديرية (KWD)' : 'Total Estimated Contract Value (KWD)'}
                     </Label>
                     <Input 
                        type="number" 
                        value={formData.baseAmount || 0} 
                        onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                        className="h-16 rounded-[2rem] border-2 border-emerald-200 font-black text-3xl text-emerald-700 bg-white shadow-2xl text-center focus:ring-emerald-100"
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                     />
                  </div>
               </div>

               {/* Milestones List */}
               <div className="space-y-4">
                  {formData.defaultMilestones?.map((m, idx) => (
                    <Card key={idx} className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all">
                       <CardContent className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                          <div className="md:col-span-1 flex justify-center">
                             <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">#{idx + 1}</div>
                          </div>
                          
                          <div className="md:col-span-4 space-y-2 text-start">
                             <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'مسمى الدفعة المستحقة' : 'Milestone Name'}</Label>
                             <Input 
                               value={m.name || ''} 
                               onChange={e => updateMilestone(idx, 'name', e.target.value)} 
                               className="h-11 border-2 font-bold rounded-xl" 
                               placeholder={isRtl ? "مثلاً: دفعة عند الانتهاء من الأساسات" : "e.g. Foundation Completion"}
                             />
                          </div>

                          <div className="md:col-span-2 space-y-2 text-start">
                             <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الحصة (%)' : 'Share (%)'}</Label>
                             <div className="relative">
                                <Input 
                                  type="number" 
                                  value={m.percentage || 0} 
                                  onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))} 
                                  className="h-11 border-2 font-black text-emerald-600 rounded-xl text-center bg-emerald-50/5" 
                                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400">%</span>
                             </div>
                          </div>

                          <div className="md:col-span-4 space-y-2 text-start">
                             <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الربط بالمرحلة الفنية' : 'Link Technical Stage'}</Label>
                             <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                <SelectTrigger className="h-11 font-bold border-2 rounded-xl bg-slate-50/30">
                                   <SelectValue placeholder={isRtl ? "ربط ميداني..." : "Link Stage..."} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                   <SelectItem value="MANUAL" className="font-black text-xs text-primary">{isRtl ? 'تفعيل يدوي (إداري)' : 'Manual Trigger'}</SelectItem>
                                   {stages?.map(s => (
                                     <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                          </div>

                          <div className="md:col-span-1 flex justify-end">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               onClick={() => removeMilestone(idx)} 
                               className="h-11 w-11 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50"
                             >
                                <Trash2 className="h-5 w-5" />
                             </Button>
                          </div>
                       </CardContent>
                    </Card>
                  ))}

                  <Button 
                    variant="outline" 
                    onClick={addMilestone} 
                    className="w-full h-16 rounded-[2.5rem] border-2 border-dashed border-primary/20 text-primary font-black gap-3 hover:bg-primary/5 transition-all shadow-sm"
                  >
                     <Plus className="h-6 w-6" /> {t('addMilestone')}
                  </Button>
               </div>

               {/* Validation Box (Pink/Emerald) */}
               <div className={cn(
                 "p-10 rounded-[3rem] border-4 border-dashed flex flex-col md:flex-row items-center justify-between transition-all shadow-xl",
                 isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
               )}>
                  <div className="text-center bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-inherit min-w-[220px]">
                     <div className="flex flex-col items-center gap-1">
                        <span className="text-4xl font-black font-headline">{totalPercentage}%</span>
                        <div className="flex items-center gap-2">
                           <Calculator className="h-3 w-3 opacity-30" />
                           <span className="text-[8px] font-black uppercase tracking-widest">{isMathValid ? 'ACCURATE' : 'INVALID TOTAL'}</span>
                        </div>
                     </div>
                     {!isMathValid && <AlertTriangle className="h-6 w-6 mx-auto mt-3 animate-pulse text-rose-500" />}
                  </div>
                  <div className="text-start md:text-end mt-6 md:mt-0 space-y-2">
                     <p className="font-black text-2xl font-headline leading-tight">{isRtl ? 'خلاصة توزيع حصص العقد' : 'Contract Share Summary'}</p>
                     <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.15em]">
                        {isMathValid 
                          ? (isRtl ? 'توزيع مالي متوازن وصحيح' : 'Financial distribution is balanced') 
                          : (isRtl ? `متبقي ${100 - totalPercentage}% من إجمالي العقد` : `Needs ${100 - totalPercentage}% more to balance`)}
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* 3. Side Legal Column */}
         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden text-start">
               <CardHeader className="bg-slate-900 text-white p-6">
                  <CardTitle className="text-sm font-black flex items-center gap-3">
                     <Gavel className="h-5 w-5 text-primary" /> 
                     {isRtl ? 'الدستور القانوني للعقد' : 'Legal Constitution'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Zap className="h-3 w-3 text-primary" /> {isRtl ? 'مقدمة العقد' : 'Intro Text'}
                     </Label>
                     <Textarea 
                       value={formData.introText || ''} 
                       onChange={e => setFormData({...formData, introText: e.target.value})} 
                       className="min-h-[100px] rounded-2xl bg-slate-50/50 p-4 border-2 text-xs font-bold"
                       placeholder="..."
                     />
                  </div>
                  
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-primary" /> {isRtl ? 'البنود والالتزامات' : 'Main Clauses'}
                     </Label>
                     <Textarea 
                       value={formData.legalText || ''} 
                       onChange={e => setFormData({...formData, legalText: e.target.value})} 
                       className="min-h-[350px] rounded-2xl bg-slate-50/50 p-6 border-2 text-xs font-bold leading-relaxed shadow-inner"
                       placeholder="..."
                     />
                  </div>

                  <div className="p-5 rounded-[2rem] bg-blue-50/50 border-2 border-white shadow-inner space-y-3">
                     <div className="flex items-center gap-2 text-blue-600"><Info className="h-4 w-4" /><span className="text-[10px] font-black uppercase">ERP Logic</span></div>
                     <p className="text-[9px] text-blue-700 font-bold leading-relaxed italic">
                        {isRtl ? 'سيقوم النظام آلياً باستبدال المتغيرات (مثل اسم العميل، التاريخ، المبلغ) عند إصدار العقد الفعلي.' : 'The system will auto-replace variables (Client Name, Date, Amount) when instantiating the actual contract.'}
                     </p>
                  </div>
               </CardContent>
            </Card>
         </div>

      </div>
    </div>
  );
}
