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
  Calculator, ShieldCheck, FileText,
  DollarSign, AlertTriangle, Target, Percent,
  Workflow, LayoutGrid, Clock, GitBranch, Sparkles,
  Link as LinkIcon, Info
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, QuotationItem, PricingMode, MilestoneTiming, BOQTemplate } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage, BOQReferenceNode } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { BOQReferenceSelector } from '@/components/settings/checklists/boq-reference/boq-reference-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface Props {
  template: QuotationTemplate | null;
  onClose: () => void;
}

export function QuotationTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [pathStages, setPathStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubService[]>([]);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<QuotationTemplate>>(
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
      defaultTerms: '',
      validDays: 30,
      pricingMode: 'itemized',
      items: [],
      isDefault: false,
      isActive: true
    }
  );

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => {
    if (!companyId || !db || !formData.activityTypeId) return null;
    return query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order'));
  }, [db, companyId, formData.activityTypeId]);

  const boqTemplatesQuery = useMemo(() => {
    if (!companyId || !db || !formData.subServiceId) return null;
    return query(collection(db, paths.boqTemplates(companyId)), where('subServiceId', '==', formData.subServiceId));
  }, [db, companyId, formData.subServiceId]);
  
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

  const getOrdinalLabel = (index: number) => {
    const arOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const enOrdinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const base = isRtl ? "الدفعة" : "Installment";
    const ordinal = isRtl ? (arOrdinals[index] || `#${index + 1}`) : (enOrdinals[index] || `#${index + 1}`);
    return `${base} ${ordinal}`;
  };

  const stats = useMemo(() => {
    const items = formData.items || [];
    const totalPercentage = items.reduce((acc, item) => acc + (item.percentage || 0), 0);
    const totalItemizedAmount = items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 1)), 0);
    
    const isPercentageMode = formData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;

    return {
      totalPercentage,
      totalItemizedAmount,
      isValid
    };
  }, [formData.items, formData.pricingMode]);

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
      if (template?.id) await service.updateTemplate('quotation', template.id, payload, user.uid);
      else await service.addTemplate('quotation', payload, user.uid);
      
      toast({ title: t('common.saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const newItems = [...(formData.items || [])];
    (newItems[idx] as any)[field] = val;
    setFormData({ ...formData, items: newItems });
  };

  const addItemFromRegistry = (node: BOQReferenceNode) => {
    const newItem: QuotationItem = {
      label: node.title,
      description: node.description || '',
      boqReferenceNodeId: node.id,
      unit: node.unitSymbol || 'unit',
      unitPrice: node.estimatedRate || 0,
      quantity: 1,
      percentage: 0,
      timing: 'at',
      technicalStageId: node.technicalStageId || ''
    };
    setFormData({ ...formData, items: [...(formData.items || []), newItem] });
    setIsRegistryOpen(false);
    toast({ title: isRtl ? "تم ربط البند المرجعي" : "Registry Item Linked" });
  };

  const addItemManual = () => {
    const nextIdx = (formData.items || []).length;
    setFormData({
      ...formData, 
      items: [...(formData.items || []), { 
        label: getOrdinalLabel(nextIdx), 
        description: '',
        percentage: 0, 
        unitPrice: 0, 
        quantity: 1,
        timing: 'at',
        technicalStageId: ''
      }]
    });
  };

  const currentDisplayAmount = formData.pricingMode === 'itemized' 
    ? stats.totalItemizedAmount 
    : (formData.baseAmount || 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 bg-[#fdfaf3] min-h-screen" dir={dir}>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/95 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 border-2 rounded-xl hover:bg-slate-50 transition-all text-slate-400">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-xl font-black text-slate-900 leading-none">{isRtl ? 'هندسة قوالب عروض الأسعار' : 'Quotation Template Design'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft Quotation Template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col text-end">
              <span className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'سلامة التسعير' : 'Pricing Integrity'}</span>
              <Badge variant="outline" className={cn("h-6 border-2 font-black text-[9px]", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                 {stats.isValid ? 'VALID' : 'MISMATCH'}
              </Badge>
           </div>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-12 px-10 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 gap-3 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
              {t('common.save')}
           </Button>
        </div>
      </header>

      <div className="max-w-full mx-auto px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         <div className="lg:col-span-9 space-y-8">
            
            <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-primary/5 p-8 border-b">
                  <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
                     <Target className="h-6 w-6 text-primary" /> {isRtl ? 'السياق التشغيلي والارتباط المسبق' : 'Operational Context & Sovereign Link'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-10 space-y-8 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">نوع النشاط</Label>
                        <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: '', boqTemplateId: ''})}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">الخدمة الرئيسية</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: '', boqTemplateId: ''})}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{services?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المسار التنفيذي (Pipeline)</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => {
                           const sub = activeSubs.find(s => s.id === v);
                           setFormData({...formData, subServiceId: v, subServiceName: sub?.name || '', boqTemplateId: ''});
                        }}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activeSubs.map(s => <SelectItem key={s.id} value={s.id!} className="font-black text-xs">{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="p-8 rounded-[2rem] bg-orange-50 border-4 border-dashed border-primary/20 space-y-4 animate-in zoom-in-95">
                     <div className="flex items-center gap-4 text-primary">
                        <LinkIcon className="h-8 w-8" />
                        <div className="text-start">
                           <h4 className="font-black text-xl">{isRtl ? 'الارتباط المسبق بالمقايسة' : 'Pre-Link to BOQ Template'}</h4>
                           <p className="text-xs font-bold text-orange-800/70">{isRtl ? 'سيتم حصر اختيار المقايسات في المشروع بهذا القالب حصراً عند تحويل العرض لعقد.' : 'Only this BOQ template will be linked when converting this quotation to a contract.'}</p>
                        </div>
                     </div>
                     
                     <Select disabled={!formData.subServiceId} value={formData.boqTemplateId} onValueChange={v => {
                        const bt = boqTemplates?.find(b => b.id === v);
                        setFormData({...formData, boqTemplateId: v, boqTemplateName: bt?.name || ''});
                     }}>
                        <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-white shadow-xl shadow-primary/5">
                           <SelectValue placeholder={isRtl ? "اختر قالب المقايسة المرتبط..." : "Select linked BOQ template..."} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-0 shadow-3xl z-[200]">
                           {boqTemplates?.map(bt => (
                             <SelectItem key={bt.id} value={bt.id!} className="font-bold py-4 border-b last:border-0 border-slate-50">
                                <div className="flex justify-between items-center gap-10">
                                   <span>{bt.name}</span>
                                   <Badge variant="outline" className="h-5 px-2 bg-white text-[8px] font-black uppercase border-primary/20">{bt.code}</Badge>
                                </div>
                             </SelectItem>
                           ))}
                           {(!boqTemplates || boqTemplates.length === 0) && formData.subServiceId && (
                             <div className="p-8 text-center text-rose-500 font-bold italic flex flex-col items-center gap-3">
                                <AlertTriangle className="h-8 w-8" />
                                <p>{isRtl ? 'لا يوجد قوالب مقايسات معرّفة لهذا المسار الفني.' : 'No BOQ templates found for this technical path.'}</p>
                             </div>
                           )}
                        </SelectContent>
                     </Select>
                  </div>
               </CardContent>
            </Card>

            <PrintWrapper className="mt-4 overflow-hidden" fullWidth={true}>
               <div className="space-y-12 text-start">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b-4 border-primary/10 pb-10">
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'مسمى عرض السعر' : 'Quotation Template Name'}</Label>
                           <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-xl bg-slate-50/50 shadow-inner" />
                        </div>
                     </div>
                     <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><Calculator className="h-32 w-32" /></div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</p>
                        <div className="flex items-center gap-4 relative z-10">
                           <Input 
                             type="number" 
                             value={formData.baseAmount === 0 ? "" : formData.baseAmount} 
                             onChange={e => setFormData({...formData, baseAmount: e.target.value === '' ? 0 : Number(e.target.value)})} 
                             className="h-16 rounded-2xl bg-white/10 border-0 text-3xl font-black text-center text-primary shadow-inner" 
                           />
                           <span className="text-xl font-bold opacity-40">KWD</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2 text-start">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'النص التعريفي' : 'Intro Text'}
                     </h4>
                     <Textarea value={formData.introText || ''} onChange={e => setFormData({...formData, introText: e.target.value})} className="min-h-[120px] rounded-[2rem] border-2 p-8 text-sm font-bold leading-relaxed bg-slate-50/30" />
                  </div>

                  <div className="space-y-6">
                     <div className="flex justify-between items-center px-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <LayoutGrid className="h-5 w-5 text-primary" /> {tSafe('inline.pricing.payments', 'جدول بنود التسعير والدفعات', 'Pricing & Payments')}
                        </h4>
                        <div className="flex gap-2">
                           <Dialog open={isRegistryOpen} onOpenChange={setIsRegistryOpen}>
                              <DialogTrigger asChild>
                                 <Button variant="outline" size="sm" className="rounded-xl font-black text-[10px] border-2 h-10 px-8 gap-3 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all shadow-md">
                                    <GitBranch className="h-4 w-4 text-primary" /> {isRtl ? 'القاموس الموحد' : 'Registry Link'}
                                 </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
                                 <div className="bg-slate-50 p-8 text-slate-900 text-start border-b">
                                    <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3"><Sparkles className="h-7 w-7 text-primary" /> {isRtl ? 'ربط بنود العرض بالقاموس الموحد' : 'Link Offer Items to Registry'}</DialogTitle>
                                 </div>
                                 <div className="p-8"><BOQReferenceSelector onSelect={addItemFromRegistry} /></div>
                                 <DialogFooter className="p-4 bg-slate-50"><Button variant="outline" onClick={() => setIsRegistryOpen(false)}>{t('common.close')}</Button></DialogFooter>
                              </DialogContent>
                           </Dialog>
                           <Button onClick={addItemManual} variant="outline" size="sm" className="rounded-xl font-black text-[10px] border-2 h-10 px-8 gap-3 bg-white hover:bg-primary/5 shadow-md">
                              <Plus className="h-4 w-4 text-primary" /> {isRtl ? 'بند يدوي' : 'Manual Item'}
                           </Button>
                        </div>
                     </div>

                     <div className="border-2 border-slate-200 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl ring-1 ring-black/[0.02]">
                        <table className="w-full text-xs text-start">
                           <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                              <tr>
                                 <th className="p-6 w-12 text-start">#</th>
                                 <th className="p-6 text-start">{tSafe('inline.item.label', 'مسمى البند / الدفعة', 'Item Label')}</th>
                                 {formData.pricingMode === 'percentage' && <th className="p-6 text-center w-24">%</th>}
                                 <th className="p-6 text-center w-32">{isRtl ? 'التوقيت' : 'Timing'}</th>
                                 <th className="p-6 text-start w-48">{isRtl ? 'الارتباط الفني' : 'Technical Link'}</th>
                                 <th className="p-6 text-end pe-12 w-48">{isRtl ? 'المبلغ' : 'Amount'}</th>
                                 <th className="p-6 w-14"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(formData.items || []).map((m, idx) => {
                                 const lineAmount = formData.pricingMode === 'percentage' 
                                   ? ((formData.baseAmount || 0) * (m.percentage || 0)) / 100 
                                   : (m.unitPrice || 0) * (m.quantity || 1);
                                 
                                 const linkedStageName = pathStages.find(s => s.id === m.technicalStageId)?.name;

                                 return (
                                   <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                                      <td className="p-4">
                                         <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                               {m.boqReferenceNodeId && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[8px] h-5 px-3 uppercase font-black">{tSafe('inline.linked', 'مرتبط', 'LINKED')}</Badge>}
                                               <Input value={m.label} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-10 rounded-xl font-black text-sm bg-white border-2" />
                                            </div>
                                            {m.technicalStageId && m.technicalStageId !== 'NONE' && (
                                              <p className="text-[8px] font-black text-primary/60 italic flex items-center gap-1 mt-1 px-2">
                                                <Clock className="h-3 w-3" />
                                                {isRtl ? 'عند' : 'at'} {m.technicalStageId === 'SIGNING' ? (isRtl ? 'توقيع العقد' : 'Contract Signing') : linkedStageName}
                                              </p>
                                            )}
                                         </div>
                                      </td>
                                      {formData.pricingMode === 'percentage' && (
                                        <td className="p-4">
                                           <div className="relative w-20 mx-auto">
                                              <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateItem(idx, 'percentage', e.target.value === '' ? 0 : Number(e.target.value))} className="h-10 rounded-xl border-2 font-black text-center pe-6 text-sm" />
                                              <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                           </div>
                                        </td>
                                      )}
                                      <td className="p-4">
                                         <Select value={m.timing || 'at'} onValueChange={v => updateItem(idx, 'timing', v)}>
                                            <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                               <SelectItem value="at" className="font-bold text-xs">{isRtl ? 'عند' : 'at'}</SelectItem>
                                               <SelectItem value="before" className="font-bold text-xs">{isRtl ? 'قبل' : 'before'}</SelectItem>
                                               <SelectItem value="during" className="font-bold text-xs">{isRtl ? 'أثناء' : 'during'}</SelectItem>
                                               <SelectItem value="after" className="font-bold text-xs">{isRtl ? 'بعد' : 'after'}</SelectItem>
                                            </SelectContent>
                                         </Select>
                                      </td>
                                      <td className="p-4">
                                         <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                            <SelectTrigger className={cn(
                                              "h-10 rounded-xl border-2 font-bold text-xs",
                                              m.technicalStageId ? "bg-primary/5 text-primary border-primary/20" : "bg-white"
                                            )}>
                                              <SelectValue placeholder={isRtl ? "ربط فني..." : "Link Stage..."} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                               <SelectItem value="SIGNING" className="font-black text-[10px] py-3 border-b border-slate-50">
                                                  <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {isRtl ? 'توقيع العقد' : 'Contract Signing'}</span>
                                               </SelectItem>
                                               <SelectItem value="NONE" className="font-bold text-[10px] text-slate-400 italic">--- {isRtl ? 'بدون ربط' : 'No Link'} ---</SelectItem>
                                               {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                                  <span className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> {s.name}</span>
                                               </SelectItem>)}
                                            </SelectContent>
                                         </Select>
                                      </td>
                                      <td className="p-4 text-end pe-12 w-48">
                                         {formData.pricingMode === 'itemized' ? (
                                            <div className="flex items-center gap-2 justify-end">
                                               <Input type="number" step="1" value={m.quantity || 1} onChange={e => updateItem(idx, 'quantity', e.target.value === '' ? 1 : Number(e.target.value))} className="h-10 w-14 text-center text-xs font-black border-2 rounded-xl" />
                                               <X className="h-3 w-3 opacity-20" />
                                               <Input type="number" step="0.001" value={m.unitPrice === 0 ? "" : m.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value === '' ? 0 : Number(e.target.value))} className="h-10 w-24 text-end font-black text-emerald-600 text-sm bg-slate-50 border-2 rounded-xl" />
                                            </div>
                                         ) : (
                                            <p className="font-mono font-black text-emerald-600 text-lg">{(lineAmount || 0).toLocaleString()} <span className="text-[10px] opacity-40">KWD</span></p>
                                         )}
                                      </td>
                                      <td className="p-4 text-center">
                                         <button type="button" onClick={() => setFormData({...formData, items: formData.items?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600 transition-colors hover:scale-110"><Trash2 className="h-5 w-5" /></button>
                                      </td>
                                   </tr>
                                 );
                              })}
                           </tbody>
                           <tfoot className="bg-slate-50 border-t-8 border-primary">
                              <tr>
                                 <td colSpan={formData.pricingMode === 'percentage' ? 5 : 4} className="p-10 text-start">
                                    <h3 className="text-xl font-black font-headline uppercase tracking-tighter text-slate-800">{isRtl ? 'إجمالي قيمة العرض المقترح' : 'Total Quotation Proposed Value'}</h3>
                                    {formData.pricingMode === 'percentage' && (
                                       <Badge className={cn("mt-3 border-0 text-[10px] font-black h-7 px-5 shadow-lg", stats.isValid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
                                          {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                       </Badge>
                                    )}
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
                        <ShieldCheck className="h-6 w-6 text-primary" /> {t('defaultTerms')}
                     </h4>
                     <Textarea value={formData.defaultTerms || ''} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} className="min-h-[200px] rounded-[3rem] border-2 p-10 text-base font-bold leading-relaxed bg-slate-50/50 focus:bg-white transition-all shadow-inner" placeholder="..." />
                  </div>
               </div>
            </PrintWrapper>
         </div>

         <aside className="lg:col-span-3 space-y-6 text-start sticky top-24">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-900 p-6 border-b text-start">
                  <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase text-primary tracking-widest">
                     <Target className="h-4 w-4" /> {isRtl ? 'حالة القالب' : 'Template Status'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2">
                     <Label className="font-black text-xs uppercase">{t('common.isActive')}</Label>
                     <Switch checked={formData.isActive !== false} onCheckedChange={v => setFormData({...formData, isActive: v})} />
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-start gap-3">
                     <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                     <p className="text-[9px] font-bold text-blue-700 leading-relaxed italic">{isRtl ? 'تنبيه: ربط القوالب يضمن دقة الفوترة ومنع الخطأ في اختيار المقايسات أثناء التعاقد مع العملاء.' : 'Linking templates ensures billing accuracy and prevents errors in selecting BOQs during client contracting.'}</p>
                  </div>
               </CardContent>
            </Card>
         </aside>
      </div>
    </div>
  );
}
