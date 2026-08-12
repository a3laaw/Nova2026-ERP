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
  Handshake, Calculator, ShieldCheck,
  Target, Percent, Workflow,
  LayoutGrid, Clock, Info, Landmark,
  Hammer, ListChecks, CheckCircle2, AlertTriangle, X
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { SubConContractTemplate, ContractMilestone, PricingMode } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { PrintWrapper } from '@/components/layout/print-wrapper';

interface Props {
  template: SubConContractTemplate | null;
  onClose: () => void;
}

export function SubConContractTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<SubConContractTemplate>>(
    template || {
      name: '',
      code: '',
      trade: '', 
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
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

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services, loading: servicesLoading } = useCollection<Service>(srvQuery);

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
    if (!formData.name) return toast({ variant: "destructive", title: tSafe('inline.name.required', 'الاسم مطلوب', 'Name required') });
    if (formData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: tSafe('common.error', 'خطأ', 'Error'), 
        description: isRtl ? `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)` : `Total percentage must be 100%` 
      });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      const finalAmount = formData.pricingMode === 'percentage' 
        ? (formData.baseAmount || 0)
        : stats.totalItemizedAmount;

      const payload = { ...formData, baseAmount: finalAmount };
      if (template?.id) await service.updateTemplate('subcon_contract', template.id, payload, user.uid);
      else await service.addTemplate('subcon_contract', payload, user.uid);
      
      toast({ title: t('common.saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const getOrdinalLabel = (index: number) => {
    const arOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const enOrdinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const base = tSafe('inline.installment', 'الدفعة', 'Installment');
    return isRtl ? `${base} ${arOrdinals[index] || `#${index + 1}`}` : `${base} ${enOrdinals[index] || `#${index + 1}`}`;
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...(formData.defaultMilestones || [])];
    const item = { ...newM[idx], [field]: value };
    
    // ربط تفاعلي للنسبة مع المبلغ بناءً على الميزانية المستهدفة
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

  const currentDisplayAmount = formData.pricingMode === 'percentage' 
    ? (formData.baseAmount || 0)
    : stats.totalItemizedAmount;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 bg-white min-h-screen" dir={dir}>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/95 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 border-2 rounded-xl hover:bg-slate-50 transition-all text-slate-400">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-xl font-black text-slate-900 leading-none">{tSafe('inline.subcon.template.design', 'هندسة قوالب عقود الباطن', 'SubCon Template Design')}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft SubCon Template'}</p>
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
                  <CardTitle className="text-[10px] font-black flex items-center gap-3 uppercase tracking-widest text-primary">
                     <Target className="h-4 w-4" /> {isRtl ? 'السياق والمجال' : 'Operational Scope'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'التخصص الفني' : 'Specialization'}</Label>
                        <Input value={formData.trade || ''} onChange={e => setFormData({...formData, trade: e.target.value})} className="h-11 rounded-xl border-2 font-black text-primary" placeholder={isRtl ? "مثلاً: حدادة" : "e.g. Steel Works"} />
                     </div>
                     <div className="space-y-1.5 pt-4 border-t">
                        <Label className="text-[10px] font-black uppercase text-slate-400">النشاط</Label>
                        <Select value={formData.activityTypeId || ''} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">الخدمة</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId || ''} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">المسار</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId || ''} onValueChange={v => {
                           const sub = activeSubs.find(s => s.id === v);
                           setFormData({...formData, subServiceId: v, subServiceName: sub?.name || ''});
                        }}>
                           <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
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
                 value={formData.baseAmount === 0 ? "" : (formData.baseAmount || "")} 
                 onChange={e => setFormData({...formData, baseAmount: e.target.value === '' ? 0 : Number(e.target.value)})} 
                 className="h-14 rounded-2xl border-2 bg-white text-2xl text-center shadow-inner font-black text-primary" 
               />
               <p className="text-[9px] font-bold text-slate-400 text-center italic">{isRtl ? 'تستخدم لحساب مبالغ الدفعات بناءً على النسب المئوية.' : 'Used for calculating amounts from percentages.'}</p>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-blue-50 border-2 border-blue-100 flex items-start gap-4 shadow-inner ring-4 ring-white">
               <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
               <p className="text-[10px] font-bold text-blue-700 leading-relaxed italic text-start">
                  {isRtl ? 'قوالب عقود الباطن تستخدم لتوحيد شروط الدفع والارتباط الفني للمراحل المنفذة بواسطة عمالة خارجية.' : 'SubCon templates unify payment terms and technical links for outsourced labor.'}
               </p>
            </div>
         </aside>

         <div className="lg:col-span-9 space-y-8 text-start">
            <PrintWrapper className="mt-0" fullWidth={true}>
               <div className="space-y-12 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-2 pb-8">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'مسمى القالب' : 'Template Name'}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-black text-lg bg-slate-50 shadow-inner" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نمط التسعير' : 'Pricing Mode'}</Label>
                        <Select value={formData.pricingMode} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
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
                           <LayoutGrid className="h-5 w-5 text-primary" /> {isRtl ? 'جدول دفعات المقاول والربط الفني' : 'Payment Milestones & Execution Links'}
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
                                 <th className="p-6 text-start w-48">{isRtl ? 'الارتباط الميداني' : 'Technical Link'}</th>
                                 <th className="p-6 text-end pe-12 w-48">{tSafe('inline.amount', 'المبلغ', 'Amount')}</th>
                                 <th className="p-6 w-14"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(formData.defaultMilestones || []).map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                                   <td className="p-4">
                                      <Input value={m.name || ''} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 rounded-xl font-black text-sm bg-white border-2" />
                                   </td>
                                   {formData.pricingMode === 'percentage' && (
                                      <td className="p-4">
                                         <div className="relative w-24 mx-auto">
                                            <Input 
                                              type="number" 
                                              value={m.percentage === 0 ? "" : (m.percentage || "")} 
                                              onChange={e => updateMilestone(idx, 'percentage', e.target.value)} 
                                              className="h-10 rounded-xl border-2 font-black text-center pe-6 text-sm" 
                                            />
                                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                         </div>
                                      </td>
                                   )}
                                   <td className="p-4 text-center">
                                      <Select value={m.timing || 'at'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
                                         <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            <SelectItem value="at" className="font-bold text-xs">{t('at')}</SelectItem>
                                            <SelectItem value="before" className="font-bold text-xs">{t('before')}</SelectItem>
                                            <SelectItem value="during" className="font-bold text-xs">{t('during')}</SelectItem>
                                            <SelectItem value="after" className="font-bold text-xs">{t('after')}</SelectItem>
                                         </SelectContent>
                                      </Select>
                                   </td>
                                   <td className="p-4 text-start">
                                      <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className={cn(
                                           "h-10 rounded-xl border-2 font-black text-xs",
                                           m.technicalStageId ? "bg-primary/5 text-primary border-primary/20" : "bg-white"
                                         )}>
                                           <SelectValue placeholder="..." />
                                         </SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                               <span className="flex items-center gap-1"><Workflow className="h-3 w-3 text-primary" /> {s.name}</span>
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
                                           value={m.amount === 0 ? "" : (m.amount || "")} 
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
                                    <h3 className="text-xl font-black font-headline uppercase tracking-tighter text-slate-800">{isRtl ? 'إجمالي قيمة عقد الباطن' : 'Total SubCon Contract Value'}</h3>
                                    <Badge className={cn("mt-3 border-0 text-[10px] font-black h-7 px-5 shadow-lg", stats.isValid ? "bg-emerald-600 text-white" : "bg-rose-50 text-rose-600 border-rose-100")}>
                                       {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                    </Badge>
                                 </td>
                                 <td colSpan={2} className="p-10 text-end pe-12">
                                    <div className="space-y-1">
                                       <h2 className="text-5xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{tSafe('inline.kuwaiti.dinars', 'دينار كويتي لا غير', 'KUWAITI DINARS ONLY')}</p>
                                    </div>
                                 </td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>
                  </div>

                  <div className="space-y-4 pt-10 text-start">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-4 border-primary/20 pb-3">
                        <ShieldCheck className="h-6 w-6 text-primary" /> {isRtl ? 'البنود والشروط القانونية (عقد الباطن)' : 'SubCon Legal Terms & Clauses'}
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
