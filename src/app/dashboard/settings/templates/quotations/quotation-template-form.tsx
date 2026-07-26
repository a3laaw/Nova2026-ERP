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
  Workflow, LayoutGrid, Clock
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, QuotationItem, PricingMode, MilestoneTiming } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { PrintWrapper } from '@/components/layout/print-wrapper';

interface Props {
  template: QuotationTemplate | null;
  onClose: () => void;
}

export function QuotationTemplateForm({ template, onClose }: Props) {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
  const [pathStages, setPathStages] = useState<TechnicalStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubService[]>([]);

  const [formData, setFormData] = useState<Partial<QuotationTemplate>>(
    template || {
      name: '',
      code: '',
      baseAmount: 0,
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      introText: '',
      defaultTerms: '',
      validDays: 30,
      pricingMode: 'itemized',
      items: [
        { 
          description: '', 
          label: isRtl ? 'الدفعة الأولى' : '1st Installment',
          unit: 'batch', 
          quantity: 1, 
          unitPrice: 0, 
          percentage: 0,
          timing: 'at',
          technicalStageId: 'SIGNING'
        }
      ],
      isDefault: false,
      isActive: true
    }
  );

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  
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
        title: isRtl ? "خطأ في الميزانية" : "Budget Mismatch", 
        description: isRtl ? `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)` : `Total percentage must be 100%` 
      });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      if (template?.id) await service.updateTemplate('quotation', template.id, formData, user.uid);
      else await service.addTemplate('quotation', formData, user.uid);
      toast({ title: t('saved') });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const newItems = [...(formData.items || [])];
    (newItems[idx] as any)[field] = val;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    const nextIdx = (formData.items || []).length;
    setFormData({
      ...formData, 
      items: [...(formData.items || []), { 
        label: getOrdinalLabel(nextIdx), 
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 bg-[#fdfaf3]" dir={dir}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 border rounded-xl hover:bg-slate-50 transition-all">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-lg font-black text-slate-900 leading-none">{isRtl ? 'هندسة قوالب عروض الأسعار' : 'Quotation Template Design'}</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.name || 'Draft Template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col text-end">
              <span className="text-[9px] font-black text-slate-400 uppercase">Pricing Integrity</span>
              <Badge variant="outline" className={cn("h-6 border-2 font-black text-[9px]", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                 {stats.isValid ? 'VALID' : 'MISMATCH'}
              </Badge>
           </div>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-10 px-8 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {t('save')}
           </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-sm rounded-xl bg-white ring-1 ring-black/5">
               <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-start">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                     <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-10 rounded-lg border-2 font-bold text-xs" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Reference Code</Label>
                     <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-10 rounded-lg font-mono text-xs border-2" />
                  </div>
                  <div className="flex items-center justify-between p-3 mt-4 bg-slate-50 rounded-xl border-2">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Default</Label>
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
                          <p className="text-[7px] font-black uppercase text-primary">Pricing Mode</p>
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
                             onChange={e => setFormData({...formData, baseAmount: e.target.value === "" ? 0 : Number(e.target.value)})} 
                             className="h-7 rounded-md bg-white text-slate-900 font-black text-xs text-center shadow-inner" 
                           />
                        </div>
                      )}
                  </div>

                  <div className="space-y-2 text-start">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'المقدمة (اختياري)' : 'Preamble (Optional)'}
                     </h4>
                     <Textarea value={formData.introText || ''} onChange={e => setFormData({...formData, introText: e.target.value})} className="min-h-[80px] rounded-xl border-2 p-3 text-[10px] font-bold bg-slate-50/30" />
                  </div>

                  <div className="space-y-4 text-start">
                     <div className="flex justify-between items-center">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <LayoutGrid className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'بنود التسعير والارتباط الفني' : 'Pricing Items & Pipeline Links'}
                        </h4>
                        <Button variant="outline" size="sm" onClick={addItem} className="rounded-lg font-black text-[9px] border-2 h-7 px-4 gap-2 hover:bg-slate-50 transition-all shadow-sm">
                           <Plus className="h-3 w-3" /> {isRtl ? 'إضافة بند' : 'Add Item'}
                        </Button>
                     </div>

                     <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-lg">
                        <table className="w-full text-[10px] text-start">
                           <thead className="bg-slate-900 text-white">
                              <tr className="font-black uppercase tracking-widest text-[9px]">
                                 <th className="p-3 w-10 text-start">#</th>
                                 <th className="p-3 text-start">{isRtl ? 'مسمى البند / الدفعة' : 'Item Label'}</th>
                                 {formData.pricingMode === 'percentage' && <th className="p-3 text-center w-16">%</th>}
                                 <th className="p-3 text-center w-24">{isRtl ? 'التوقيت' : 'Timing'}</th>
                                 <th className="p-3 text-start w-32">{isRtl ? 'المرحلة الفنية' : 'Technical Link'}</th>
                                 <th className="p-3 text-end pe-6 w-32">{isRtl ? 'القيمة' : 'Amount'}</th>
                                 <th className="p-3 w-10"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(formData.items || []).map((m, idx) => {
                                 const lineAmount = formData.pricingMode === 'percentage' 
                                   ? ((formData.baseAmount || 0) * (m.percentage || 0)) / 100 
                                   : (m.unitPrice || 0);
                                 
                                 const linkedStageName = pathStages.find(s => s.id === m.technicalStageId)?.name;

                                 return (
                                   <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 font-black text-slate-300 text-start">{idx + 1}</td>
                                      <td className="p-2">
                                         <div className="space-y-1">
                                            <Input value={m.label} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-8 rounded-lg font-bold text-[10px] bg-slate-50/50" />
                                            {m.technicalStageId && m.technicalStageId !== 'SIGNING' && (
                                              <p className="text-[7px] text-slate-400 italic">
                                                {t(m.timing || 'at')} {linkedStageName}
                                              </p>
                                            )}
                                         </div>
                                      </td>
                                      {formData.pricingMode === 'percentage' && (
                                        <td className="p-2">
                                           <div className="relative w-14 mx-auto">
                                              <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateItem(idx, 'percentage', e.target.value === "" ? 0 : Number(e.target.value))} className="h-8 rounded-lg border-2 font-black text-center pe-5 text-[10px]" />
                                              <Percent className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                           </div>
                                        </td>
                                      )}
                                      <td className="p-2">
                                         <Select value={m.timing || 'at'} onValueChange={v => updateItem(idx, 'timing', v)}>
                                            <SelectTrigger className="h-8 rounded-lg border-2 font-black text-[9px] bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                               <SelectItem value="at" className="font-bold text-[10px]">{t('at')}</SelectItem>
                                               <SelectItem value="before" className="font-bold text-[10px]">{t('before')}</SelectItem>
                                               <SelectItem value="during" className="font-bold text-[10px]">{t('during')}</SelectItem>
                                               <SelectItem value="after" className="font-bold text-[10px]">{t('after')}</SelectItem>
                                            </SelectContent>
                                         </Select>
                                      </td>
                                      <td className="p-2">
                                         <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                            <SelectTrigger className={cn(
                                              "h-8 rounded-lg border-2 font-bold text-[9px]",
                                              (m.technicalStageId && m.technicalStageId !== 'NONE') ? "bg-primary/5 text-primary border-primary/20" : "bg-white"
                                            )}>
                                              <SelectValue placeholder={isRtl ? "ربط فني..." : "Link Stage..."} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                               <SelectItem value="SIGNING" className="font-black text-[10px] py-2">
                                                  <span className="flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5 text-emerald-500" /> {isRtl ? 'عند توقيع العقد (حر)' : 'At Signing (Free Link)'}</span>
                                               </SelectItem>
                                               <SelectItem value="NONE" className="font-bold text-[10px] text-slate-400 italic">--- {isRtl ? 'بدون ربط' : 'No Link'} ---</SelectItem>
                                               {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px] py-2 border-b last:border-0 border-slate-50">
                                                  <span className="flex items-center gap-1"><Workflow className="h-2.5 w-2.5 text-primary" /> {s.name}</span>
                                               </SelectItem>)}
                                            </SelectContent>
                                         </Select>
                                      </td>
                                      <td className="p-2 text-end pe-6">
                                         {formData.pricingMode === 'itemized' ? (
                                            <Input type="number" step="0.001" value={m.unitPrice === 0 ? "" : m.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value === "" ? 0 : Number(e.target.value))} className="h-8 w-24 ms-auto text-end font-black text-emerald-600 text-[10px]" />
                                         ) : (
                                            <span className="font-mono font-black text-emerald-600 text-xs">{(lineAmount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></span>
                                         )}
                                      </td>
                                      <td className="p-3 text-center">
                                         <button type="button" onClick={() => setFormData({...formData, items: formData.items?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                      </td>
                                   </tr>
                                 );
                              })}
                           </tbody>
                           <tfoot className="bg-slate-900 text-white">
                              <tr>
                                 <td colSpan={formData.pricingMode === 'percentage' ? 5 : 4} className="p-5 text-start">
                                    <h3 className="text-xs font-black font-headline uppercase tracking-tighter">{isRtl ? 'إجمالي قيمة العرض' : 'Total Quote Value'}</h3>
                                    {formData.pricingMode === 'percentage' && (
                                       <Badge className={cn("mt-1 border-0 text-[7px] font-black h-4 px-3 shadow-sm", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                                          {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                       </Badge>
                                    )}
                                 </td>
                                 <td colSpan={2} className="p-5 text-end pe-8">
                                    <div className="space-y-0.5">
                                       <h2 className="text-2xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                       <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">Kuwaiti Dinars</p>
                                    </div>
                                 </td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 text-start">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-900 pb-1">
                        <ShieldCheck className="h-3 w-3 text-primary" /> {isRtl ? 'الشروط والأحكام الافتراضية' : 'Default Terms & Conditions'}
                     </h4>
                     <Textarea value={formData.defaultTerms || ''} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} className="min-h-[150px] rounded-2xl border-2 p-5 text-xs font-bold leading-relaxed bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
                  </div>
               </div>
            </PrintWrapper>
         </div>

         <aside className="lg:col-span-4 space-y-6 text-start">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-6 border-b text-start">
                  <CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400">
                     <Target className="h-4 w-4 text-primary" /> {isRtl ? 'الارتباط التشغيلي السيادي' : 'Operational Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6 text-start">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Activity Type</Label>
                     <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold text-xs">{isRtl ? a.name : a.nameEn}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Main Service</Label>
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
                     <Label className="text-[10px] font-black uppercase text-slate-500">Specific Technical Path</Label>
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

            <div className="p-8 rounded-[2.5rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4 text-start">
               <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
               <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                  {isRtl 
                    ? 'ربط بنود التسعير بالمراحل الفنية يضمن انتقال البيانات بدقة عند تحويل العرض إلى عقد رسمي، ويسمح بتتبع التحصيل المالي الميداني لاحقاً. الدفعة الأولى عند التوقيع هي دفعة حرة لا تتطلب اكتمال مرحلة ميدانية.' 
                    : 'Linking pricing items to technical stages ensures data accuracy when converting quotes to contracts and enables field billing tracking. The first installment is a free trigger.'}
               </p>
            </div>
         </aside>
      </div>
    </div>
  );
}
