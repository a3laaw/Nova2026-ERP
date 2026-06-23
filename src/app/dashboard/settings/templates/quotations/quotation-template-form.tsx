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
  Calculator, ShieldCheck, Info, Sparkles, FileText,
  Clock, Zap, LayoutGrid, AlertTriangle, DollarSign
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, PricingMode, QuotationItem } from '@/types/templates';
import { ActivityType, Service, SubService, TechnicalStage } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

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
  const [formData, setFormData] = useState<Partial<QuotationTemplate>>(
    template || {
      name: '',
      code: '',
      description: '',
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
          contractualEvent: 'SIGNING'
        }
      ],
      isDefault: false,
      isActive: true
    }
  );

  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('order')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('order')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);
  
  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  const totalPercentage = useMemo(() => {
    return formData.items?.reduce((acc, item) => acc + (item.percentage || 0), 0) || 0;
  }, [formData.items]);

  const totalItemizedAmount = useMemo(() => {
    return formData.items?.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 1)), 0) || 0;
  }, [formData.items]);

  const isPercentageMode = formData.pricingMode === 'percentage';
  const isMathValid = isPercentageMode 
    ? totalPercentage === 100 
    : totalItemizedAmount === (formData.baseAmount || 0);

  const addItem = () => {
    const nextIndex = (formData.items?.length || 0) + 1;
    setFormData({
      ...formData,
      items: [
        ...(formData.items || []), 
        { 
          description: '', 
          label: isRtl ? `دفعة إضافية ${nextIndex}` : `Additional Item ${nextIndex}`,
          unit: 'unit', 
          quantity: 1, 
          unitPrice: 0, 
          percentage: 0, 
          timing: 'at',
          contractualEvent: 'MANUAL'
        }
      ]
    });
  };

  const removeItem = (idx: number) => {
    setFormData({
      ...formData,
      items: (formData.items || []).filter((_, i) => i !== idx)
    });
  };

  const updateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!formData.name || !formData.activityTypeId || !formData.serviceId) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "يرجى إكمال البيانات الأساسية." : "Please complete basic fields." });
      return;
    }

    if (!isMathValid) {
      const diff = isPercentageMode ? (100 - totalPercentage) : ((formData.baseAmount || 0) - totalItemizedAmount);
      toast({ 
        variant: "destructive", 
        title: t('error'), 
        description: isPercentageMode 
          ? (isRtl ? `مجموع النسب ${totalPercentage}% فقط. متبقي ${diff}% للوصول لـ 100%.` : `Total is ${totalPercentage}%. Need ${diff}% more.`)
          : (isRtl ? `مجموع البنود لا يطابق الإجمالي. الفرق: ${diff}` : `Items sum mismatch. Diff: ${diff}`)
      });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId, permissions);
      if (template?.id) {
        await service.updateTemplate('quotation', template.id, formData, user.uid);
      } else {
        await service.addTemplate('quotation', formData, user.uid);
      }
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
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline">{isRtl ? 'إعداد قالب عرض السعر' : 'Setup Quote Template'}</h1>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-primary text-white font-black rounded-xl h-12 px-8 shadow-xl shadow-primary/20 gap-2">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardContent className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود القالب' : 'Template Code'}</Label>
                        <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('orgRef')}</Label>
                        <Select value={formData.activityTypeId || ''} onValueChange={v => setFormData({...formData, activityTypeId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl">{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('techRef')}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId || ''} onValueChange={v => setFormData({...formData, serviceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('newPath')}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId || ''} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!}>{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="space-y-6">
               <div className="flex justify-between items-end px-6">
                  <h3 className="text-2xl font-black font-headline text-slate-800 flex items-center gap-3">
                     <Calculator className="h-8 w-8 text-primary" />
                     {isRtl ? 'هيكلة بنود عرض السعر' : 'Quote Items Structure'}
                  </h3>
                  <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 px-2">{t('pricingMode')}</Label>
                     <Select value={formData.pricingMode || 'itemized'} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                        <SelectTrigger className="h-9 w-40 border-0 font-black text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                           <SelectItem value="itemized">{t('itemized')}</SelectItem>
                           <SelectItem value="fixed">{t('fixed')}</SelectItem>
                           <SelectItem value="percentage">{t('percentage')}</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="p-10 bg-emerald-50/40 rounded-[3rem] border-2 border-emerald-100/50 text-start relative overflow-hidden group shadow-sm">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="h-32 w-32" /></div>
                  <div className="max-w-md mx-auto space-y-3 relative z-10 text-center">
                     <Label className="text-[11px] font-black uppercase text-emerald-600 tracking-widest flex items-center justify-center gap-2">
                        {isRtl ? 'إجمالي قيمة العرض التقديرية (KWD)' : 'Total Estimated Quote Value (KWD)'}
                     </Label>
                     <Input 
                        type="number" 
                        value={formData.baseAmount || 0} 
                        onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                        className="h-16 rounded-[2rem] border-2 border-emerald-200 font-black text-3xl text-emerald-700 bg-white shadow-2xl text-center"
                     />
                  </div>
               </div>

               <div className="space-y-4">
                  {formData.items?.map((item, idx) => (
                    <Card key={idx} className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
                       <CardContent className="p-8 flex flex-col md:flex-row items-center gap-6">
                          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</div>
                          <div className="flex-1 space-y-4 w-full">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                   <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'المسمى / الوصف' : 'Label / Description'}</Label>
                                   <Input value={item.label || ''} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-10 border-2 font-bold" />
                                </div>
                                <div className="grid grid-cols-3 gap-2 items-end">
                                   <div className="space-y-1">
                                      <Label className="text-[9px] font-black text-slate-400 uppercase">{t('amount')}</Label>
                                      <Input type="number" value={isPercentageMode ? item.percentage : item.unitPrice} onChange={e => updateItem(idx, isPercentageMode ? 'percentage' : 'unitPrice', Number(e.target.value))} className="h-10 text-center font-black text-emerald-600" />
                                   </div>
                                   <div className="space-y-1">
                                      <Label className="text-[9px] font-black text-slate-400 uppercase">{isPercentageMode ? '%' : 'KWD'}</Label>
                                      <div className="h-10 flex items-center justify-center bg-slate-100 rounded-lg text-xs font-black">{isPercentageMode ? '%' : 'KWD'}</div>
                                   </div>
                                   <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-10 w-10 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" onClick={addItem} className="w-full h-16 rounded-[2rem] border-2 border-dashed border-primary/20 text-primary font-black gap-2 hover:bg-primary/5 transition-all">
                     <Plus className="h-5 w-5" /> {t('addQuotationItem')}
                  </Button>
               </div>

               <div className={cn(
                 "p-10 rounded-[3rem] border-4 border-dashed flex items-center justify-between transition-all shadow-xl",
                 isMathValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
               )}>
                  <div className="text-center bg-white p-6 rounded-[2rem] shadow-xl border-2 border-inherit min-w-[150px]">
                     <span className="text-4xl font-black font-headline">
                       {isPercentageMode ? `${totalPercentage}%` : `${totalItemizedAmount.toLocaleString()} KWD`}
                     </span>
                     {!isMathValid && <AlertTriangle className="h-6 w-6 mx-auto mt-2 animate-pulse text-rose-500" />}
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="text-end">
                        <p className="font-black text-2xl font-headline">
                          {isPercentageMode ? t('totalQuoteShare') : t('totalQuoteValue')}
                        </p>
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{isMathValid ? 'BALANCED' : 'MISMATCH'}</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-1 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start"><CardTitle className="text-sm font-black flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {t('introText')}</CardTitle></CardHeader>
               <CardContent className="p-6"><Textarea value={formData.introText || ''} onChange={e => setFormData({...formData, introText: e.target.value})} className="min-h-[120px] rounded-2xl bg-slate-50/50 p-4 border-2" /></CardContent>
            </Card>
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start"><CardTitle className="text-sm font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t('defaultTerms')}</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-4">
                  <Textarea value={formData.defaultTerms || ''} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} className="min-h-[120px] rounded-2xl bg-slate-50/50 p-4 border-2" />
                  <div className="space-y-1 text-start">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{t('validDays')}</Label>
                     <Input type="number" value={formData.validDays || 30} onChange={e => setFormData({...formData, validDays: Number(e.target.value)})} className="h-10 rounded-xl border-2 font-black text-center" />
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}

