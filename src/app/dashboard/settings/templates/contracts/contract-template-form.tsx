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
  Gavel, Calculator, Info, Sparkles,
  Landmark, Clock, FileText,
  BadgeCheck, Settings2, Zap, AlertTriangle, DollarSign
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
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
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ContractTemplate>>(
    template || {
      name: '',
      code: '',
      description: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      introText: '',
      legalText: '',
      closingText: '',
      clauses: [''],
      defaultMilestones: [],
      isDefault: false,
      isActive: true,
      version: 1
    }
  );

  // Reference Data Fetching
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('name')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('name')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('name')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);
  
  const stagesQuery = useMemo(() => 
    companyId && db && formData.activityTypeId && formData.serviceId && formData.subServiceId
      ? query(collection(db, paths.technicalStages(companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId)), orderBy('order'))
      : null, 
  [db, companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const totalPercentage = useMemo(() => {
    return formData.defaultMilestones?.reduce((acc, m) => acc + (m.percentage || 0), 0) || 0;
  }, [formData.defaultMilestones]);

  const totalMilestoneAmount = useMemo(() => {
    return formData.defaultMilestones?.reduce((acc, m) => {
      const amount = ((formData.baseAmount || 0) * (m.percentage || 0)) / 100;
      return acc + amount;
    }, 0) || 0;
  }, [formData.defaultMilestones, formData.baseAmount]);

  const isMathValid = totalPercentage === 100;

  const addMilestone = () => {
    setFormData({
      ...formData,
      defaultMilestones: [...(formData.defaultMilestones || []), { name: '', percentage: 0, timing: 'after', contractualEvent: 'MANUAL' }]
    });
  };

  const removeMilestone = (idx: number) => {
    setFormData({
      ...formData,
      defaultMilestones: (formData.defaultMilestones || []).filter((_, i) => i !== idx)
    });
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newMilestones = [...(formData.defaultMilestones || [])];
    newMilestones[idx] = { ...newMilestones[idx], [field]: value };
    setFormData({ ...formData, defaultMilestones: newMilestones });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!formData.name || !formData.activityTypeId || !formData.serviceId) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "بيانات ناقصة" : "Missing Fields" });
      return;
    }

    if (totalPercentage !== 100) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "تنبيه مالي" : "Financial Alert", 
        description: isRtl ? "يجب أن يكون مجموع نسب الدفعات 100%." : "Total percentage must be 100%."
      });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId);
      
      const activity = activities?.find(a => a.id === formData.activityTypeId);
      const srv = services?.find(s => s.id === formData.serviceId);
      const sub = subServices?.find(ss => ss.id === formData.subServiceId);

      const finalData = {
        ...formData,
        activityTypeName: (isRtl ? activity?.name : activity?.nameEn) || '',
        serviceName: (isRtl ? srv?.name : srv?.nameEn) || '',
        subServiceName: (isRtl ? sub?.name : sub?.nameEn) || '',
        code: formData.code || formData.name?.toUpperCase().replace(/\s+/g, '_'),
        introText: formData.introText || '',
        legalText: formData.legalText || '',
        closingText: formData.closingText || ''
      };

      if (template?.id) {
        await service.updateTemplate('contract', template.id, finalData, user.uid);
      } else {
        await service.addTemplate('contract', finalData, user.uid);
      }

      toast({ title: t('saved') });
      onClose();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline">
               {template ? (isRtl ? 'تعديل قالب العقد' : 'Edit Contract Template') : (isRtl ? 'إنشاء قالب عقد جديد' : 'New Contract Template')}
            </h1>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-primary text-white font-black rounded-xl h-12 px-8 shadow-xl shadow-primary/20 gap-2"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 p-8 border-b text-start">
                  <CardTitle className="text-lg font-black flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> {isRtl ? 'الارتباط والتعريف' : 'Identity & Link'}</CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الرقم المرجعي' : 'Ref Code'}</Label>
                        <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" placeholder="CONT_STD_01" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('orgRef')}</Label>
                        <Select value={formData.activityTypeId || ''} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('techRef')}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId || ''} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('newPath')}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId || ''} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-900 text-white p-8 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-black flex items-center gap-2 text-primary"><Calculator className="h-5 w-5" /> {isRtl ? 'هيكلة الدفعات المخططة' : 'Payment Milestones Structure'}</CardTitle>
                  <Button variant="outline" size="sm" onClick={addMilestone} className="rounded-xl h-10 px-4 bg-white/10 border-white/20 text-white font-bold hover:bg-white/20">
                     <Plus className="me-2 h-4 w-4" /> {t('addMilestone')}
                  </Button>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                  <div className="p-8 bg-primary/5 rounded-[2.5rem] border-2 border-primary/10 animate-in fade-in zoom-in-95 text-start">
                     <div className="max-w-md space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                           <DollarSign className="h-3 w-3" /> {isRtl ? 'إجمالي قيمة العقد التقديرية (KWD)' : 'Estimated Contract Value (KWD)'}
                        </Label>
                        <Input 
                           type="number" 
                           value={formData.baseAmount || 0} 
                           onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                           className="h-14 rounded-2xl border-2 border-primary/20 font-black text-2xl text-primary bg-white shadow-inner text-center"
                        />
                     </div>
                  </div>

                  {formData.defaultMilestones?.map((milestone, idx) => {
                    const isFirst = idx === 0;
                    const calculatedAmount = ((formData.baseAmount || 0) * (milestone.percentage || 0)) / 100;

                    return (
                      <div key={idx} className={cn(
                        "p-8 rounded-[2.5rem] bg-slate-50 border-2 transition-all space-y-6 animate-in fade-in slide-in-from-top-2",
                        isFirst ? "border-s-8 border-s-primary" : "border-s-8 border-s-blue-500"
                      )}>
                        <div className="flex justify-between items-start gap-6 text-start">
                            <div className="w-40 space-y-2">
                               <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'مسمى الدفعة' : 'Milestone Label'}</Label>
                               <Input 
                                 value={milestone.name || ''} 
                                 onChange={e => updateMilestone(idx, 'name', e.target.value)} 
                                 className="h-12 rounded-xl bg-white border-2 font-black"
                               />
                            </div>
                            
                            <div className="flex-1 space-y-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                     <Label className="text-[10px] font-black text-primary uppercase flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-primary" /> {t('milestoneTiming')}
                                     </Label>
                                     <Select value={milestone.timing || 'after'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
                                        <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-black">
                                           <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                           <SelectItem value="at" className="font-bold">{t('at')}</SelectItem>
                                           <SelectItem value="during" className="font-bold">{t('during')}</SelectItem>
                                           <SelectItem value="after" className="font-bold">{t('after')}</SelectItem>
                                        </SelectContent>
                                     </Select>
                                  </div>

                                  <div className="space-y-2">
                                     <Label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                        <Zap className="h-3 w-3" /> {t('event')}
                                     </Label>
                                     {isFirst ? (
                                       <Select value={milestone.contractualEvent || 'SIGNING'} onValueChange={v => updateMilestone(idx, 'contractualEvent', v)}>
                                          <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-black text-blue-600">
                                             <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="SIGNING" className="font-bold">{t('contractSigning')}</SelectItem>
                                             <SelectItem value="CONTRACTING" className="font-bold">{t('contracting')}</SelectItem>
                                          </SelectContent>
                                       </Select>
                                     ) : (
                                       <Select value={milestone.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-xs bg-white">
                                             <SelectValue placeholder="..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                             {stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                                          </SelectContent>
                                       </Select>
                                     )}
                                  </div>
                               </div>
                            </div>

                            <div className="w-24 space-y-2 text-center">
                               <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'الحصة %' : 'Share %'}</Label>
                               <Input 
                                 type="number" 
                                 value={milestone.percentage || 0} 
                                 onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))} 
                                 className="h-12 rounded-xl bg-white border-2 font-black text-emerald-600 text-center"
                               />
                               <span className="text-[9px] font-bold text-emerald-500">≈ {calculatedAmount.toLocaleString()}</span>
                            </div>
                            
                            {!isFirst && (
                              <Button variant="ghost" size="icon" onClick={() => removeMilestone(idx)} className="h-10 w-10 text-rose-300 hover:text-rose-500 rounded-full mt-8">
                                 <Trash2 className="h-5 w-5" />
                              </Button>
                            )}
                        </div>
                      </div>
                    );
                  })}

                  {/* خانة التحقق من إجمالي الحصص - مطابقة للصورة */}
                  <div className={cn(
                    "p-8 rounded-[2.5rem] border-4 border-dashed flex items-center justify-between transition-all",
                    isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                  )}>
                     <div className="text-center">
                        <span className="text-4xl font-black">{totalPercentage}%</span>
                        {!isMathValid && <AlertTriangle className="h-5 w-5 mx-auto mt-1 animate-pulse" />}
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="text-end">
                           <p className="font-black text-lg">{t('totalQuoteShare')}</p>
                        </div>
                        <Calculator className="h-8 w-8" />
                     </div>
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-4 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800"><Settings2 className="h-4 w-4 text-primary" /> {isRtl ? 'ديباجة العقد' : 'Intro Text'}</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <Textarea 
                    value={formData.introText || ''} 
                    onChange={e => setFormData({...formData, introText: e.target.value})}
                    className="min-h-[120px] rounded-2xl bg-slate-50/30 p-4 border-2"
                  />
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800"><Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'المواد القانونية' : 'Legal Provisions'}</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <Textarea 
                    value={formData.legalText || ''} 
                    onChange={e => setFormData({...formData, legalText: e.target.value})}
                    className="min-h-[200px] rounded-2xl bg-slate-50/30 p-4 border-2"
                  />
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
