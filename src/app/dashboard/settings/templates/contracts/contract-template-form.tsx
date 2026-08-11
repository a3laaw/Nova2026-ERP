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
  Save, X, Plus, Trash2, Loader2, ArrowRight,
  Gavel, Calculator, DollarSign, ShieldCheck,
  AlertTriangle, Target, Percent, Workflow,
  FileText, LayoutGrid, Clock
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { ContractTemplate, ContractMilestone, PricingMode, MilestoneTiming } from '@/types/templates';
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
      introText: '',
      legalText: '',
      pricingMode: 'percentage',
      defaultMilestones: [
        { name: isRtl ? 'الدفعة الأولى' : '1st Installment', percentage: 10, timing: 'at', contractualEvent: 'SIGNING', amount: 0 }
      ],
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
  
  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(srvQuery);

  const getOrdinalLabel = (index: number) => {
    const arOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const enOrdinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const base = isRtl ? "الدفعة" : "Installment";
    const ordinal = isRtl ? (arOrdinals[index] || `#${index + 1}`) : (enOrdinals[index] || `#${index + 1}`);
    return `${base} ${ordinal}`;
  };

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
    const totalPercentage = milestones.reduce((acc, m) => acc + (m.percentage || 0), 0);
    const totalItemizedAmount = milestones.reduce((acc, m) => acc + (m.amount || 0), 0);
    
    const isPercentageMode = formData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;

    return {
      totalPercentage,
      totalItemizedAmount,
      isValid
    };
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
      const finalAmount = formData.pricingMode === 'itemized' 
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
    newM[idx] = { ...newM[idx], [field]: value };
    setFormData({...formData, defaultMilestones: newM});
  };

  const addMilestone = () => {
    const nextIdx = (formData.defaultMilestones || []).length;
    setFormData({
      ...formData, 
      defaultMilestones: [...(formData.defaultMilestones || []), { 
        name: getOrdinalLabel(nextIdx), 
        percentage: 0, 
        amount: 0, 
        timing: 'at', 
        contractualEvent: 'MANUAL' 
      }]
    });
  };

  const currentDisplayAmount = formData.pricingMode === 'itemized' 
    ? stats.totalItemizedAmount 
    : (formData.baseAmount || 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 bg-[#fdfaf3]" dir={dir}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 border rounded-lg hover:bg-slate-50 transition-all">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-lg font-black text-slate-900 leading-none">{isRtl ? 'هندسة قوالب العقود' : 'Contract Template Engineering'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft Contract Template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col text-end">
              <span className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'توازن الميزانية' : 'Balance Status'}</span>
              <Badge variant="outline" className={cn("h-6 border-2 font-black text-[9px]", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                 {stats.isValid ? `BALANCED: ${formData.pricingMode === 'percentage' ? '100%' : 'OK'}` : `MISMATCH: ${stats.totalPercentage}%`}
              </Badge>
           </div>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-9 px-8 rounded-lg shadow-lg gap-2 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {t('common.save')}
           </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-start">
         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-sm rounded-xl bg-white ring-1 ring-black/5">
               <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-start">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('common.name')}</Label>
                     <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9 rounded-lg border-2 font-bold text-xs" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">{tSafe('inline.code', 'الكود', 'Code')}</Label>
                     <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-9 rounded-lg font-mono text-xs border-2" />
                  </div>
                  <div className="flex items-center justify-between p-2 mt-4 bg-slate-50 rounded-lg border">
                     <Label className="text-[8px] font-black uppercase text-slate-500">{isRtl ? 'قالب افتراضي' : 'Default Template'}</Label>
                     <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                  </div>
               </CardContent>
            </Card>

            <PrintWrapper className="mt-4 overflow-hidden">
               <div className="space-y-8 text-start">
                  <div className="p-4 bg-[#1e1b4b] rounded-xl text-white flex items-center justify-between gap-4 shadow-xl print:hidden">
                      <div className="flex items-center gap-3 text-start">
                        <Calculator className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[7px] font-black uppercase text-primary">{t('pricingMode')}</p>
                          <Select value={formData.pricingMode} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                             <SelectTrigger className="h-6 w-32 rounded-md bg-white/10 border-0 text-white font-black text-[9px] mt-0.5"><SelectValue /></SelectTrigger>
                             <SelectContent className="rounded-xl">
                                <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                                <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                                <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {(formData.pricingMode === 'percentage' || formData.pricingMode === 'fixed') && (
                        <div className="space-y-1 text-start w-32">
                           <Label className="text-[7px] font-black uppercase text-primary">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</Label>
                           <Input 
                             type="number" 
                             value={formData.baseAmount === 0 ? "" : formData.baseAmount} 
                             onChange={e => setFormData({...formData, baseAmount: e.target.value === '' ? 0 : Number(e.target.value)})} 
                             className="h-7 rounded-md bg-white text-slate-900 font-black text-xs text-center shadow-inner" 
                           />
                        </div>
                      )}
                  </div>

                  <div className="space-y-2 text-start">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'النص التعريفي' : 'Intro Text'}
                     </h4>
                     <Textarea value={formData.introText || ''} onChange={e => setFormData({...formData, introText: e.target.value})} className="min-h-[80px] rounded-xl border-2 p-3 text-[10px] font-bold bg-slate-50/30" />
                  </div>

                  <div className="space-y-4 text-start">
                     <div className="flex justify-between items-center">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <LayoutGrid className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'جدول الدفعات والربط الفني' : 'Payment Milestones & Pipeline'}
                        </h4>
                        <Button variant="outline" size="sm" onClick={addMilestone} className="rounded-lg font-black text-[9px] border-2 h-7 px-4 gap-2 hover:bg-slate-50 transition-all shadow-sm">
                           <Plus className="h-3 w-3" /> {isRtl ? 'إضافة دفعة' : 'Add Payment'}
                        </Button>
                     </div>

                     <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-lg">
                        <table className="w-full text-[10px] text-start">
                           <thead className="bg-slate-900 text-white">
                              <tr className="font-black uppercase tracking-widest text-[9px]">
                                 <th className="p-3 w-10 text-start">#</th>
                                 <th className="p-3 text-start">{isRtl ? 'مسمى الدفعة' : 'Milestone Name'}</th>
                                 {formData.pricingMode === 'percentage' && <th className="p-3 text-center w-16">%</th>}
                                 <th className="p-3 text-center w-24">{isRtl ? 'التوقيت' : 'Timing'}</th>
                                 <th className="p-3 text-start w-32">{isRtl ? 'الارتباط الفني' : 'Technical Link'}</th>
                                 <th className="p-3 text-end pe-6 w-32">{isRtl ? 'المبلغ' : 'Amount'}</th>
                                 <th className="p-3 w-10"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(formData.defaultMilestones || []).map((m, idx) => {
                                 const lineAmount = formData.pricingMode === 'percentage' 
                                   ? ((formData.baseAmount || 0) * (m.percentage || 0)) / 100 
                                   : (m.amount || 0);
                                 
                                 const linkedStageName = pathStages.find(s => s.id === m.technicalStageId)?.name;

                                 return (
                                   <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 font-black text-slate-300 text-start">{idx + 1}</td>
                                      <td className="p-2">
                                         <div className="space-y-1">
                                            <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-8 rounded-lg font-bold text-[10px] bg-slate-50/50" />
                                            {m.technicalStageId && m.technicalStageId !== 'NONE' && (
                                              <p className="text-[7px] font-black text-primary/60 italic flex items-center gap-1 mt-1">
                                                <Clock className="h-2 w-2" />
                                                {isRtl ? 'عند' : 'at'} {m.technicalStageId === 'SIGNING' ? (isRtl ? 'توقيع العقد' : 'Contract Signing') : linkedStageName}
                                              </p>
                                            )}
                                         </div>
                                      </td>
                                      {formData.pricingMode === 'percentage' && (
                                        <td className="p-2">
                                           <div className="relative w-14 mx-auto">
                                              <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 rounded-lg border-2 font-black text-center pe-5 text-[10px]" />
                                              <Percent className="absolute right-1 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                           </div>
                                        </td>
                                      )}
                                      <td className="p-2">
                                         <Select value={m.timing || 'at'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
                                            <SelectTrigger className="h-8 rounded-lg border-2 font-black text-[9px] bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                               <SelectItem value="at" className="font-bold text-[10px]">{isRtl ? 'عند' : 'at'}</SelectItem>
                                               <SelectItem value="before" className="font-bold text-[10px]">{isRtl ? 'قبل' : 'before'}</SelectItem>
                                               <SelectItem value="during" className="font-bold text-[10px]">{isRtl ? 'أثناء' : 'during'}</SelectItem>
                                               <SelectItem value="after" className="font-bold text-[10px]">{isRtl ? 'بعد' : 'after'}</SelectItem>
                                            </SelectContent>
                                         </Select>
                                      </td>
                                      <td className="p-2">
                                         <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                            <SelectTrigger className="h-8 rounded-lg border-2 font-black text-[9px] bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                               <SelectItem value="SIGNING" className="font-bold text-[10px]">{isRtl ? 'توقيع العقد' : 'Contract Signing'}</SelectItem>
                                               {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px] py-2 border-b last:border-0 border-slate-50">
                                                  <span className="flex items-center gap-1"><Workflow className="h-2.5 w-2.5 text-primary" /> {s.name}</span>
                                               </SelectItem>)}
                                            </SelectContent>
                                         </Select>
                                      </td>
                                      <td className="p-2 text-end pe-6 w-32">
                                         {formData.pricingMode === 'itemized' ? (
                                            <Input type="number" step="0.001" value={m.amount === 0 ? "" : m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 w-24 ms-auto text-end font-black text-emerald-600 text-[10px]" />
                                         ) : (
                                            <span className="font-mono font-black text-emerald-600">{(lineAmount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></span>
                                         )}
                                      </td>
                                      <td className="p-3 text-center">
                                         <button type="button" onClick={() => setFormData({...formData, defaultMilestones: formData.defaultMilestones?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                      </td>
                                   </tr>
                                 );
                              })}
                           </tbody>
                           <tfoot className="bg-slate-900 text-white">
                              <tr>
                                 <td colSpan={formData.pricingMode === 'percentage' ? 5 : 4} className="p-5 text-start">
                                    <h3 className="text-xs font-black font-headline uppercase tracking-tighter">{isRtl ? 'إجمالي قيمة العقد' : 'Total Contract Value'}</h3>
                                    {formData.pricingMode === 'percentage' && (
                                       <Badge className={cn("mt-1 border-0 text-[7px] font-black h-4 px-3 shadow-sm", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                                          {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                       </Badge>
                                    )}
                                 </td>
                                 <td colSpan={2} className="p-5 text-end pe-8">
                                    <div className="space-y-0.5">
                                       <h2 className="text-2xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                       <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">{isRtl ? 'دينار كويتي' : 'Kuwaiti Dinars'}</p>
                                    </div>
                                 </td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 text-start">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-900 pb-2">
                        <Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'البنود القانونية' : 'Legal Text'}
                     </h4>
                     <Textarea value={formData.legalText || ''} onChange={e => setFormData({...formData, legalText: e.target.value})} className="min-h-[250px] rounded-2xl border-2 p-5 text-xs font-bold leading-relaxed bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
                  </div>
               </div>
            </PrintWrapper>
         </div>

         <aside className="lg:col-span-4 space-y-6 text-start">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-6 border-b text-start">
                  <CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400">
                     <Target className="h-4 w-4 text-primary" /> {isRtl ? 'السياق التشغيلي' : 'Operational Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6 text-start">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">{isRtl ? 'نوع النشاط' : 'Activity Type'}</Label>
                     <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">{isRtl ? 'الخدمة الرئيسية' : 'Main Service'}</Label>
                     <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs">
                           {servicesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="..." />}
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">{isRtl ? 'المسار التشغيلي' : 'Specific Technical Path'}</Label>
                     <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => {
                        const sub = activeSubs.find(s => s.id === v);
                        setFormData({...formData, subServiceId: v, subServiceName: sub?.name || ''});
                     }}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-black text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
               </CardContent>
            </Card>

            <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white space-y-4 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
               <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck className="h-12 w-12 text-primary" /></div>
               <h5 className="font-black text-xs uppercase tracking-widest text-primary">{isRtl ? 'حالة القالب' : 'Template Status'}</h5>
               <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <Label className="text-[10px] font-bold text-slate-300 uppercase">{t('common.isActive')}</Label>
                  <Switch checked={formData.isActive !== false} onCheckedChange={v => setFormData({...formData, isActive: v})} />
               </div>
            </div>

            <div className="p-6 bg-amber-50 rounded-[2rem] border-2 border-dashed border-amber-200 flex items-start gap-4 text-start">
               <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
               <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                  {isRtl 
                    ? 'سيتم استخدام هذا القالب كأساس عند فتح معاملة جديدة لهذا المسار الفني. تأكد من ربط الدفعات بمراحلها الفنية الصحيحة لتمكين محرك المطالبة الآلي.' 
                    : 'This template will be the baseline for new transactions in this path. Link milestones to stages to enable automated billing triggers.'}
               </p>
            </div>
         </aside>
      </div>
    </div>
  );
}
