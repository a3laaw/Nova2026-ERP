'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Save, Plus, Trash2, Loader2, ArrowRight,
  Gavel, Calculator, DollarSign, ShieldCheck,
  AlertTriangle, Target, Percent, Workflow,
  FileText, LayoutGrid, Clock, Link as LinkIcon, Info,
  X, Landmark
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs, doc } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { ContractTemplate, ContractMilestone, PricingMode, BOQTemplate } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { PrintWrapper } from '@/components/layout/print-wrapper';

interface Props {
  template: ContractTemplate | null;
  onClose: () => void;
}

export function ContractTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
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
      boqTemplateId: '',
      boqTemplateName: '',
      introText: '',
      legalText: '',
      pricingMode: 'percentage',
      defaultMilestones: [],
      isDefault: false,
      isActive: true
    }
  );

  const [pathStages, setPathStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubService[]>([]);

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => {
    if (!companyId || !db || !formData.activityTypeId) return null;
    return query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order'));
  }, [db, companyId, formData.activityTypeId]);

  // الربط السيادي: فلترة المقايسات بناءً على المسار الفني والنشاط حصراً
  const boqTemplatesQuery = useMemo(() => {
    if (!companyId || !db || !formData.subServiceId || !formData.activityTypeId) return null;
    return query(
      collection(db, paths.boqTemplates(companyId)), 
      where('subServiceId', '==', formData.subServiceId),
      where('activityTypeId', '==', formData.activityTypeId)
    );
  }, [db, companyId, formData.subServiceId, formData.activityTypeId]);
  
  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(srvQuery);
  const { data: boqTemplates } = useCollection<BOQTemplate>(boqTemplatesQuery);

  useEffect(() => {
    if (db && companyId && formData.activityTypeId && formData.serviceId) {
      getDocs(query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')))
        .then(snap => setActiveSubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService))))
        .catch(() => setActiveSubs([]));
    }
  }, [db, companyId, formData.activityTypeId, formData.serviceId]);

  useEffect(() => {
    if (db && companyId && formData.activityTypeId && formData.serviceId && formData.subServiceId) {
      setLoadingStages(true);
      const stagesPath = paths.technicalStages(companyId, formData.activityTypeId, formData.serviceId, formData.subServiceId);
      getDocs(query(collection(db, stagesPath), orderBy('order')))
        .then(snap => setPathStages(snap.docs.map(d => ({ id: d.id, ...d.data() } as TechnicalStage))))
        .catch(() => setPathStages([]))
        .finally(() => setLoadingStages(false));
    } else {
      setPathStages([]);
    }
  }, [db, companyId, formData.subServiceId, formData.activityTypeId, formData.serviceId]);

  const stats = useMemo(() => {
    const milestones = formData.defaultMilestones || [];
    const totalPercentage = milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
    const totalItemizedAmount = milestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    
    const isPercentageMode = formData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;

    return { totalPercentage, totalItemizedAmount, isValid };
  }, [formData.defaultMilestones, formData.pricingMode]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (formData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: t('common.error'), 
        description: isRtl ? `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)` : `Total percentage must be 100%` 
      });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      const finalAmount = formData.pricingMode === 'itemized' || formData.pricingMode === 'fixed'
        ? stats.totalItemizedAmount 
        : (formData.baseAmount || 0);

      const payload = { ...formData, baseAmount: finalAmount };
      if (template?.id) await service.updateTemplate('contract', template.id, payload, user.uid);
      else await service.addTemplate('contract', payload, user.uid);
      
      toast({ title: t('common.saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...(formData.defaultMilestones || [])];
    const item = { ...newM[idx], [field]: value };
    
    // ربط النسبة المئوية بالمبلغ تلقائياً
    if (formData.pricingMode === 'percentage' && (field === 'percentage' || field === 'amount')) {
      const total = formData.baseAmount || 0;
      if (field === 'percentage') {
        item.amount = (total * (Number(value) || 0)) / 100;
      } else if (field === 'amount' && total > 0) {
        item.percentage = (Number(value) / total) * 100;
      }
    }
    
    newM[idx] = item;
    setFormData({...formData, defaultMilestones: newM});
  };

  const addMilestone = () => {
    setFormData({
      ...formData, 
      defaultMilestones: [...(formData.defaultMilestones || []), { 
        name: '', 
        percentage: 0, 
        amount: 0, 
        timing: 'at', 
        contractualEvent: 'MANUAL' 
      }]
    });
  };

  const currentDisplayAmount = formData.pricingMode === 'percentage' 
    ? (formData.baseAmount || 0)
    : stats.totalItemizedAmount;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 bg-white min-h-screen" dir={dir}>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/95 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 border-2 rounded-xl hover:bg-slate-50 transition-all text-slate-400">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-xl font-black text-slate-900 leading-none">{isRtl ? 'هندسة قوالب العقود السيادية' : 'Sovereign Contract Engineering'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft Contract Template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col text-end">
              <span className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'حالة التوازن' : 'Balance Status'}</span>
              <Badge variant="outline" className={cn("h-6 border-2 font-black text-[9px]", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                 {stats.isValid ? `BALANCED` : `MISMATCH`}
              </Badge>
           </div>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-12 px-10 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 gap-3 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
              {t('common.save')}
           </Button>
        </div>
      </header>

      <div className="max-w-full mx-auto px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         <aside className="lg:col-span-3 space-y-6 text-start">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-primary/5 p-6 border-b">
                  <CardTitle className="text-xs font-black flex items-center gap-3 uppercase tracking-widest text-primary">
                     <Target className="h-4 w-4" /> {isRtl ? 'السياق التشغيلي' : 'Operational Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">النشاط</Label>
                        <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: '', boqTemplateId: ''})}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">الخدمة</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: '', boqTemplateId: ''})}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">المسار</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => {
                           const sub = activeSubs.find(s => s.id === v);
                           setFormData({...formData, subServiceId: v, subServiceName: sub?.name || '', boqTemplateId: ''});
                        }}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="pt-6 border-t space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5"><LinkIcon className="h-3 w-3" /> {isRtl ? 'قالب المقايسة المرتبط' : 'Linked BOQ'}</Label>
                        <Select disabled={!formData.subServiceId} value={formData.boqTemplateId} onValueChange={v => {
                           const bt = boqTemplates?.find(b => b.id === v);
                           setFormData({...formData, boqTemplateId: v, boqTemplateName: bt?.name || ''});
                        }}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-orange-50/50 border-orange-100">
                              <SelectValue placeholder={isRtl ? "اختر المقايسة..." : "Choose BOQ..."} />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl z-[200]">
                              {boqTemplates?.map(bt => (
                                <SelectItem key={bt.id} value={bt.id!} className="font-bold py-3">{bt.name}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="p-6 rounded-[2rem] bg-slate-50 border-2 border-primary/20 space-y-4 relative overflow-hidden shadow-inner">
               <div className="absolute top-0 right-0 p-6 opacity-5"><Calculator className="h-24 w-24 text-primary" /></div>
               <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</p>
               <Input 
                 type="number" 
                 disabled={formData.pricingMode !== 'percentage'}
                 value={formData.baseAmount === 0 ? "" : formData.baseAmount} 
                 onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                 className="h-14 rounded-2xl border-2 bg-white text-2xl text-center shadow-inner font-black text-primary" 
               />
               <p className="text-[9px] font-bold text-slate-400 text-center italic">{isRtl ? 'تستخدم لحساب مبالغ الدفعات بناءً على النسب المئوية.' : 'Used for calculating amounts from percentages.'}</p>
            </div>
         </aside>

         <div className="lg:col-span-9 space-y-8">
            <PrintWrapper className="mt-0" fullWidth={true}>
               <div className="space-y-12 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-2 pb-8">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'مسمى القالب' : 'Template Name'}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-black text-lg bg-slate-50 shadow-inner" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نمط التسعير' : 'Pricing Mode'}</Label>
                        <Select value={formData.pricingMode} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v, baseAmount: v === 'percentage' ? formData.baseAmount : 0})}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white"><SelectValue /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                              <SelectItem value="percentage" className="font-bold py-3">{isRtl ? 'نسب مئوية من الإجمالي' : 'Percentage of Total'}</SelectItem>
                              <SelectItem value="fixed" className="font-bold py-3">{isRtl ? 'مبالغ ثابتة مقطوعة' : 'Fixed Amounts'}</SelectItem>
                              <SelectItem value="itemized" className="font-bold py-3">{isRtl ? 'بنود منفصلة (تجمع آلياً)' : 'Itemized Grid'}</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="flex justify-between items-center px-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <LayoutGrid className="h-5 w-5 text-primary" /> {isRtl ? 'جدول الدفعات والربط الفني' : 'Payment Milestones & Pipeline'}
                        </h4>
                        <Button variant="outline" size="sm" onClick={addMilestone} className="rounded-xl font-black text-[10px] border-2 h-10 px-8 gap-3 bg-white hover:bg-primary/5 shadow-md">
                           <Plus className="h-4 w-4 text-primary" /> {isRtl ? 'إضافة دفعة' : 'Add Milestone'}
                        </Button>
                     </div>

                     <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                        <table className="w-full text-xs text-start">
                           <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                              <tr>
                                 <th className="p-6 w-12 text-start">#</th>
                                 <th className="p-6 text-start">{isRtl ? 'مسمى الدفعة' : 'Milestone Name'}</th>
                                 {formData.pricingMode === 'percentage' && <th className="p-6 text-center w-24">%</th>}
                                 <th className="p-6 text-center w-32">{isRtl ? 'التوقيت' : 'Timing'}</th>
                                 <th className="p-6 text-start w-48">{isRtl ? 'الارتباط الفني' : 'Technical Link'}</th>
                                 <th className="p-6 text-end pe-12 w-48">{isRtl ? 'المبلغ' : 'Amount'}</th>
                                 <th className="p-6 w-14"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(formData.defaultMilestones || []).map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                                   <td className="p-4">
                                      <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 rounded-xl font-black text-sm bg-white border-2" />
                                   </td>
                                   {formData.pricingMode === 'percentage' && (
                                      <td className="p-4">
                                         <div className="relative w-20 mx-auto">
                                            <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value)} className="h-10 rounded-xl border-2 font-black text-center pe-6 text-sm" />
                                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                         </div>
                                      </td>
                                   )}
                                   <td className="p-4">
                                      <Select value={m.timing || 'at'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
                                         <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            <SelectItem value="at" className="font-bold text-xs">{isRtl ? 'عند' : 'at'}</SelectItem>
                                            <SelectItem value="before" className="font-bold text-xs">{isRtl ? 'قبل' : 'before'}</SelectItem>
                                            <SelectItem value="during" className="font-bold text-xs">{isRtl ? 'أثناء' : 'during'}</SelectItem>
                                            <SelectItem value="after" className="font-bold text-xs">{isRtl ? 'بعد' : 'after'}</SelectItem>
                                         </SelectContent>
                                      </Select>
                                   </td>
                                   <td className="p-4 text-start">
                                      <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className={cn(
                                           "h-10 rounded-xl border-2 font-black text-xs",
                                           m.technicalStageId ? "bg-primary/5 text-primary border-primary/20" : "bg-white"
                                         )}>
                                           <SelectValue placeholder="..." />
                                         </SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            <SelectItem value="SIGNING" className="font-black text-[10px] py-3 border-b border-slate-50">
                                               <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {isRtl ? 'توقيع العقد' : 'Contract Signing'}</span>
                                            </SelectItem>
                                            {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                               <span className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> {s.name}</span>
                                            </SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                   </td>
                                   <td className="p-4 text-end pe-12">
                                      <div className="flex items-center gap-2 justify-end">
                                         <Input 
                                           type="number" 
                                           step="0.001" 
                                           readOnly={formData.pricingMode === 'percentage'}
                                           value={m.amount === 0 ? "" : m.amount} 
                                           onChange={e => updateMilestone(idx, 'amount', e.target.value)} 
                                           className="h-10 w-32 text-end font-black text-emerald-600 text-sm bg-slate-50 border-2 rounded-xl" 
                                         />
                                         <span className="text-[10px] font-bold text-slate-300">KWD</span>
                                      </div>
                                   </td>
                                   <td className="p-4 text-center">
                                      <button type="button" onClick={() => setFormData({...formData, defaultMilestones: formData.defaultMilestones?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-5 w-5" /></button>
                                   </td>
                                </tr>
                              ))}
                           </tbody>
                           <tfoot className="bg-slate-50 border-t-8 border-primary">
                              <tr>
                                 <td colSpan={formData.pricingMode === 'percentage' ? 5 : 4} className="p-10 text-start">
                                    <h3 className="text-xl font-black font-headline uppercase tracking-tighter text-slate-800">{isRtl ? 'إجمالي قيمة العقد المعتمد' : 'Total Contract Approved Value'}</h3>
                                    <Badge className={cn("mt-3 border-0 text-[10px] font-black h-7 px-5 shadow-lg", stats.isValid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
                                       {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                    </Badge>
                                 </td>
                                 <td colSpan={2} className="p-10 text-end pe-12">
                                    <div className="space-y-1">
                                       <h2 className="text-5xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{isRtl ? 'دينار كويتي لا غير' : 'KUWAITI DINARS ONLY'}</p>
                                    </div>
                                 </td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>
                  </div>

                  <div className="space-y-4 pt-10 text-start">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-4 border-primary/20 pb-3">
                        <Gavel className="h-6 w-6 text-primary" /> {isRtl ? 'البنود والالتزامات القانونية' : 'Legal Clauses & Obligations'}
                     </h4>
                     <Textarea value={formData.legalText || ''} onChange={e => setFormData({...formData, legalText: e.target.value})} className="min-h-[400px] rounded-[3rem] border-2 p-10 text-base font-bold leading-relaxed bg-slate-50 focus:bg-white transition-all shadow-inner" placeholder="..." />
                  </div>
               </div>
            </PrintWrapper>
         </div>
      </div>
    </div>
  );
}
