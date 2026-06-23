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
  Gavel, Calculator, ShieldCheck, Info, Sparkles,
  Landmark, Clock, ListChecks, FileText,
  BadgeCheck, Settings2, Zap
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

  // جلب المراجع الفنية للربط
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);
  
  // جلب المراحل الفنية لربطها بالدفعات (The Magic Connection)
  const stagesQuery = useMemo(() => 
    companyId && db && formData.activityTypeId && formData.serviceId && formData.subServiceId
      ? query(collection(db, paths.technicalStages(companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId)), orderBy('order'))
      : null, 
  [db, companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const addMilestone = () => {
    setFormData({
      ...formData,
      defaultMilestones: [...(formData.defaultMilestones || []), { name: '', percentage: 0, conditionText: '', technicalStageId: '' }]
    });
  };

  // وظيفة ذكية: توليد الدفعات القياسية (توقيع ومباشرة)
  const seedStandardMilestones = () => {
    const standards: ContractMilestone[] = [
      { name: isRtl ? 'دفعة مقدمة عند توقيع العقد' : 'Down Payment Upon Signing', percentage: 20, conditionText: isRtl ? 'تُستحق فور توقيع العقد من الطرفين' : 'Due upon signing', technicalStageId: '' },
      { name: isRtl ? 'دفعة عند مباشرة الأعمال بالموقع' : 'Project Mobilization Payment', percentage: 10, conditionText: isRtl ? 'عند تجهيز الموقع وتوريد المعدات' : 'Upon site mobilization', technicalStageId: '' }
    ];
    setFormData({ ...formData, defaultMilestones: [...standards, ...(formData.defaultMilestones || [])] });
    toast({ title: isRtl ? "تمت إضافة الدفعات القياسية" : "Standard Milestones Added" });
  };

  const removeMilestone = (idx: number) => {
    setFormData({
      ...formData,
      defaultMilestones: formData.defaultMilestones?.filter((_, i) => i !== idx)
    });
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newMilestones = [...(formData.defaultMilestones || [])];
    newMilestones[idx] = { ...newMilestones[idx], [field]: value };
    setFormData({ ...formData, defaultMilestones: newMilestones });
  };

  const addClause = () => {
    setFormData({ ...formData, clauses: [...(formData.clauses || []), ''] });
  };

  const updateClause = (idx: number, value: string) => {
    const newClauses = [...(formData.clauses || [])];
    newClauses[idx] = value;
    setFormData({ ...formData, clauses: newClauses });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!formData.name || !formData.activityTypeId || !formData.serviceId) {
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Fields" });
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
        activityTypeName: isRtl ? activity?.name : activity?.nameEn,
        serviceName: isRtl ? srv?.name : srv?.nameEn,
        subServiceName: isRtl ? sub?.name : sub?.nameEn,
        code: formData.code || formData.name?.toUpperCase().replace(/\s+/g, '_')
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline">
               {template ? (isRtl ? 'تعديل قالب العقد' : 'Edit Contract Template') : (isRtl ? 'إنشاء قالب عقد جديد' : 'New Contract Template')}
            </h1>
          </div>
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-primary text-white font-black rounded-xl h-12 px-8 shadow-xl shadow-primary/20 gap-2"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
            {t('save')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 space-y-8">
            
            {/* 1. Linking & Header */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 p-8 border-b">
                  <CardTitle className="text-lg font-black flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> {isRtl ? 'الارتباط القانوني والتعريفي' : 'Legal & Identity Link'}</CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم القالب' : 'Template Name'}</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الرقم المرجعي' : 'Ref Code'}</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" placeholder="CONT_STD_01" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'النشاط الرئيسي' : 'Activity'}</Label>
                        <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الخدمة الفنية' : 'Service'}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المسار الفرعي' : 'Sub-Service'}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* 2. Milestones & Payment Schedule */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-900 text-white p-8 border-b">
                  <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
                     <CardTitle className="text-lg font-black flex items-center gap-2 text-primary"><Calculator className="h-5 w-5" /> {isRtl ? 'دفعات التعاقد المرجعية' : 'Payment Milestones'}</CardTitle>
                     <div className="flex gap-3">
                        <Button variant="outline" size="sm" onClick={seedStandardMilestones} className="rounded-xl h-10 px-4 bg-white/5 border-primary/40 text-primary font-black hover:bg-primary/10">
                           <Sparkles className="me-2 h-4 w-4" /> {isRtl ? 'توليد الدفعات القياسية' : 'Standard Defaults'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={addMilestone} className="rounded-xl h-10 px-4 bg-white/10 border-white/20 text-white font-bold hover:bg-white/20">
                           <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة دفعة مخصصة' : 'Add Milestone'}
                        </Button>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  {formData.defaultMilestones?.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                       <Calculator className="h-16 w-16 text-slate-300" />
                       <p className="font-bold text-sm">{isRtl ? 'لا يوجد دفعات حالياً. اضغط "توليد الدفعات القياسية" للبدء.' : 'No milestones. Click "Standard Defaults" to begin.'}</p>
                    </div>
                  )}
                  
                  {formData.defaultMilestones?.map((milestone, idx) => {
                    const isManualTrigger = !milestone.technicalStageId;
                    return (
                      <div key={idx} className={cn(
                        "p-6 rounded-[2.5rem] bg-slate-50 border-2 transition-all space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                        isManualTrigger ? "border-slate-100" : "border-primary/10 bg-primary/[0.01]"
                      )}>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-2">
                               <div className="flex items-center gap-2">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'مسمى الدفعة' : 'Milestone Name'}</Label>
                                  <Badge className={cn("text-[8px] font-black border-0", isManualTrigger ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-600")}>
                                     {isManualTrigger ? (isRtl ? 'يدوي / تعاقدي' : 'Admin Trigger') : (isRtl ? 'آلي / ميداني' : 'Tech Trigger')}
                                  </Badge>
                               </div>
                               <Input 
                                 value={milestone.name} 
                                 onChange={e => updateMilestone(idx, 'name', e.target.value)} 
                                 className="h-10 rounded-xl bg-white border-2 font-bold"
                                 placeholder={isRtl ? "مثال: عند توقيع العقد..." : "e.g. Upon signing..."}
                               />
                            </div>
                            <div className="w-32 space-y-2">
                               <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'النسبة (%)' : 'Share %'}</Label>
                               <Input 
                                 type="number" 
                                 value={milestone.percentage} 
                                 onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))} 
                                 className="h-10 rounded-xl bg-white border-2 font-black text-primary text-center"
                               />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeMilestone(idx)} className="h-10 w-10 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl mt-6">
                               <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white/50 rounded-2xl border border-dashed border-slate-200">
                            <div className="space-y-2">
                               <Label className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1">
                                  <Zap className="h-3 w-3" /> {isRtl ? 'طريقة الاستحقاق (Trigger)' : 'Triggering Logic'}
                               </Label>
                               <Select value={milestone.technicalStageId || 'manual'} onValueChange={v => updateMilestone(idx, 'technicalStageId', v === 'manual' ? '' : v)}>
                                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white font-bold text-xs">
                                     <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                     <SelectItem value="manual" className="font-black text-slate-400">{isRtl ? 'تنشيط يدوي (عند التوقيع أو طلب إداري)' : 'Manual / Administrative Event'}</SelectItem>
                                     <hr className="my-1" />
                                     {stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs text-primary">{isRtl ? `آلي: عند اكتمال ${s.name}` : `Auto: Upon ${s.name}`}</SelectItem>)}
                                  </SelectContent>
                               </Select>
                               <p className="text-[8px] text-slate-400 italic">
                                  {isManualTrigger 
                                    ? (isRtl ? "* هذه الدفعة تُصرف يدوياً ولا ترتبط بمراحل العمل الفني." : "* This milestone is triggered manually by admin.") 
                                    : (isRtl ? "* الربط نشط: ستصبح هذه الدفعة 'مستحقة' آلياً فور انتهاء المرحلة المحددة." : "* Automated: Becomes 'Due' when the site stage completes.")}
                               </p>
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'شرط الاستحقاق المكتوب' : 'Legal Condition Text'}</Label>
                               <Input 
                                 value={milestone.conditionText} 
                                 onChange={e => updateMilestone(idx, 'conditionText', e.target.value)} 
                                 placeholder={isRtl ? "مثلاً: عند تسليم المخططات النهائية..." : "e.g. Upon blueprints delivery..."}
                                 className="h-10 rounded-xl bg-white border-slate-200"
                               />
                            </div>
                        </div>
                      </div>
                    );
                  })}
               </CardContent>
            </Card>

            {/* 3. Clauses & Paragraphs */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-8">
                  <div className="flex justify-between items-center w-full">
                     <CardTitle className="text-lg font-black flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> {isRtl ? 'بنود وشروط العقد المفصلة' : 'Contract Clauses'}</CardTitle>
                     <Button variant="ghost" onClick={addClause} className="rounded-xl font-bold text-primary hover:bg-primary/5">
                        <Plus className="me-2 h-4 w-4" /> {isRtl ? 'إضافة بند قانوني' : 'Add Clause'}
                     </Button>
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-4">
                  {formData.clauses?.map((clause, idx) => (
                    <div key={idx} className="flex gap-4 group">
                       <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-black text-slate-400 text-xs">
                          {idx + 1}
                       </div>
                       <Textarea 
                         value={clause} 
                         onChange={e => updateClause(idx, e.target.value)}
                         placeholder={isRtl ? "اكتب نص البند هنا..." : "Enter clause text..."}
                         className="min-h-[80px] rounded-2xl bg-slate-50/50 border-2 border-slate-100 focus:bg-white transition-all text-sm"
                       />
                       <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, clauses: formData.clauses?.filter((_, i) => i !== idx)})} className="opacity-0 group-hover:opacity-100 text-rose-400">
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  ))}
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-4 space-y-8">
            {/* 4. Narrative Sections */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800"><Settings2 className="h-4 w-4 text-primary" /> {isRtl ? 'ديباجة العقد' : 'Intro & Preamble'}</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <Textarea 
                    value={formData.introText} 
                    onChange={e => setFormData({...formData, introText: e.target.value})}
                    placeholder={isRtl ? "نص الافتتاح والتعريف بالأطراف..." : "Contract intro text..."}
                    className="min-h-[120px] rounded-2xl bg-slate-50/30 p-4 border-2 border-slate-100"
                  />
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800"><Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'المواد القانونية العامة' : 'Legal Generalities'}</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <Textarea 
                    value={formData.legalText} 
                    onChange={e => setFormData({...formData, legalText: e.target.value})}
                    placeholder={isRtl ? "النصوص القانونية الموحدة..." : "General legal text..."}
                    className="min-h-[200px] rounded-2xl bg-slate-50/30 p-4 border-2 border-slate-100"
                  />
               </CardContent>
            </Card>

            {/* 5. Logic Toggles */}
            <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white space-y-6 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                  <BadgeCheck className="h-32 w-32 text-primary" />
               </div>
               <div className="flex items-center justify-between relative z-10">
                  <div className="text-start">
                     <h4 className="font-black text-lg text-primary">{t('defaultTemplate')}</h4>
                     <p className="text-white/60 text-[10px] font-bold">{isRtl ? 'اعتماد هذا العقد كنموذج أولي لهذه الخدمة.' : 'Set as primary template for this service.'}</p>
                  </div>
                  <Switch 
                    checked={formData.isDefault} 
                    onCheckedChange={v => setFormData({...formData, isDefault: v})} 
                    className="data-[state=checked]:bg-primary"
                  />
               </div>
               <div className="pt-6 border-t border-white/10 relative z-10">
                  <div className="flex items-start gap-3">
                     <Info className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                     <p className="text-[10px] font-bold leading-relaxed text-slate-400">
                        {isRtl ? 'نصيحة: استخدم زر "توليد الدفعات القياسية" بالأعلى لإضافة دفعة التوقيع والمباشرة بسرعة، ثم اربط بقية الدفعات بمراحل المسار الفني.' : 'Tip: Use "Standard Defaults" to quickly add signing and mobilization fees.'}
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
