'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  // Fetch Technical Reference Data
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
    return formData.items?.reduce((acc, item) => acc + (item.percentage || 0), 0) || 0;
  }, [formData.items]);

  const addItem = () => {
    const nextIndex = (formData.items?.length || 0) + 1;
    const labels = isRtl ? ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'] : ['1st', '2nd', '3rd', '4th', '5th', '6th'];
    const label = isRtl ? `الدفعة ${labels[nextIndex - 1] || nextIndex}` : `${labels[nextIndex - 1] || nextIndex} Installment`;

    setFormData({
      ...formData,
      items: [
        ...(formData.items || []), 
        { 
          description: '', 
          label: label,
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
    
    if (field === 'technicalStageId' && stages) {
      const stage = stages.find(s => s.id === value);
      if (stage) newItems[idx].description = (isRtl ? stage.name : stage.nameEn) || '';
    }

    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!formData.name || !formData.activityTypeId || !formData.serviceId) {
      toast({ variant: "destructive", title: t('error'), description: isRtl ? "بيانات ناقصة" : "Missing Fields" });
      return;
    }

    if (formData.pricingMode === 'percentage' && totalPercentage !== 100) {
      toast({ 
        variant: "destructive", 
        title: t('error'), 
        description: isRtl ? "يجب أن يكون مجموع النسب المئوية 100% لتغطية كامل قيمة العقد." : "Total percentage must be 100%."
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
        defaultTerms: formData.defaultTerms || '',
      };

      if (template?.id) {
        await service.updateTemplate('quotation', template.id, finalData, user.uid);
      } else {
        await service.addTemplate('quotation', finalData, user.uid);
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
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4 text-start">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline">
               {template ? (isRtl ? 'تعديل قالب عرض السعر' : 'Edit Quote Template') : (isRtl ? 'إنشاء قالب عرض سعر جديد' : 'New Quote Template')}
            </h1>
            <p className="text-xs font-bold text-muted-foreground opacity-70">
               {isRtl ? 'تحديد الدفعات المالية وربطها بالمسار الفني' : 'Define payment installments and link to technical path'}
            </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-primary/5 p-8 border-b text-start">
                  <CardTitle className="text-lg font-black flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> {isRtl ? 'الارتباط التشغيلي' : 'Operational Link'}</CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الكود المرجعي' : 'Template Code'}</Label>
                        <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" placeholder="e.g. RES_ARCH_01" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('orgRef')}</Label>
                        <Select value={formData.activityTypeId || ''} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('techRef')}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId || ''} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('newPath')}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId || ''} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!} className="font-bold">{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="space-y-6">
               <div className="flex justify-between items-end px-4">
                  <div className="text-start">
                     <h3 className="text-2xl font-black font-headline text-slate-800 flex items-center gap-3">
                        <Calculator className="h-8 w-8 text-primary" />
                        {isRtl ? 'هيكلة بنود الدفعات الذكية' : 'Payment Items Structure'}
                     </h3>
                     <p className="text-xs font-bold text-slate-400 mt-1">{isRtl ? 'اربط كل دفعة مادية بتوقيت فني من المسار.' : 'Link each payment to a technical timing in the path.'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <Label className="text-[10px] font-black uppercase tracking-widest">{t('pricingMode')}</Label>
                     <Select value={formData.pricingMode || 'itemized'} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                        <SelectTrigger className="h-10 w-40 border-2 font-black text-xs rounded-xl bg-white">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="itemized" className="font-bold">{t('itemized')}</SelectItem>
                           <SelectItem value="fixed" className="font-bold">{t('fixed')}</SelectItem>
                           <SelectItem value="percentage" className="font-bold">{t('percentage')}</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="p-8 bg-emerald-50/30 rounded-[2.5rem] border-2 border-emerald-100/50 text-start animate-in fade-in zoom-in-95">
                  <div className="max-w-md space-y-2">
                     <Label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                        <DollarSign className="h-3 w-3" /> {isRtl ? 'إجمالي قيمة العقد التقديرية (KWD)' : 'Estimated Contract Value (KWD)'}
                     </Label>
                     <Input 
                        type="number" 
                        value={formData.baseAmount || 0} 
                        onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                        className="h-14 rounded-2xl border-2 border-emerald-200 font-black text-2xl text-emerald-700 bg-white shadow-inner text-center"
                        placeholder="0.000"
                     />
                     <p className="text-[9px] font-bold text-emerald-600/70 mt-1 italic">{isRtl ? '* سيتم استخدام هذه القيمة كمرجع لحساب الدفعات المئوية.' : '* Used as reference for percentage calculations.'}</p>
                  </div>
               </div>

               {formData.items?.map((item, idx) => {
                  const isFirst = idx === 0;
                  const calculatedAmount = formData.pricingMode === 'percentage' ? ((formData.baseAmount || 0) * (item.percentage || 0)) / 100 : 0;
                  
                  return (
                    <Card key={idx} className={cn(
                      "border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4 duration-500",
                      isFirst ? "border-s-8 border-s-primary" : "border-s-8 border-s-blue-500"
                    )}>
                       <CardHeader className="bg-slate-50/50 p-8 border-b flex flex-row items-center justify-between">
                          <div className="flex items-center gap-4 text-start">
                             <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                                {idx + 1}
                             </div>
                             <Input 
                               value={item.label || ''} 
                               onChange={e => updateItem(idx, 'label', e.target.value)}
                               className="bg-transparent border-0 border-b border-slate-200 rounded-none h-10 text-xl font-black text-slate-800 focus-visible:ring-0 w-64"
                               placeholder={isRtl ? "مسمى الدفعة..." : "Payment Label..."}
                             />
                          </div>
                          {!isFirst && (
                             <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-10 w-10 text-rose-300 hover:text-rose-500">
                                <Trash2 className="h-5 w-5" />
                             </Button>
                          )}
                       </CardHeader>
                       <CardContent className="p-8 space-y-6 text-start">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
                             
                             <div className="md:col-span-3 space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                   <Clock className="h-3 w-3 text-primary" /> {isRtl ? 'التوقيت' : 'Timing'}
                                </Label>
                                <Select value={item.timing || 'at'} onValueChange={v => updateItem(idx, 'timing', v)}>
                                   <SelectTrigger className="h-12 rounded-xl border-2 font-black">
                                      <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent>
                                      <SelectItem value="at" className="font-bold">{t('at')}</SelectItem>
                                      <SelectItem value="during" className="font-bold">{t('during')}</SelectItem>
                                      <SelectItem value="after" className="font-bold">{t('after')}</SelectItem>
                                   </SelectContent>
                                </Select>
                             </div>

                             <div className="md:col-span-6 space-y-2">
                                <Label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                   <Zap className="h-3 w-3" /> {t('event')}
                                </Label>
                                {isFirst ? (
                                   <Select value={item.contractualEvent || 'SIGNING'} onValueChange={v => updateItem(idx, 'contractualEvent', v)}>
                                      <SelectTrigger className="h-12 rounded-xl border-2 font-black text-blue-600">
                                         <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                         <SelectItem value="SIGNING" className="font-bold">{t('contractSigning')}</SelectItem>
                                         <SelectItem value="CONTRACTING" className="font-bold">{t('contracting')}</SelectItem>
                                         <SelectItem value="MANUAL" className="font-bold">{isRtl ? 'حدث مخصص' : 'Custom Event'}</SelectItem>
                                      </SelectContent>
                                   </Select>
                                ) : (
                                   <Select value={item.technicalStageId || ''} onValueChange={v => updateItem(idx, 'technicalStageId', v)}>
                                      <SelectTrigger className="h-12 rounded-xl border-2 font-black text-xs">
                                         <SelectValue placeholder={isRtl ? "اختر مرحلة..." : "Select stage..."} />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl">
                                         {stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{isRtl ? s.name : s.nameEn}</SelectItem>)}
                                         {!stages?.length && <SelectItem value="none" disabled>{isRtl ? 'يرجى ربط المسار أولاً' : 'Link path first'}</SelectItem>}
                                      </SelectContent>
                                   </Select>
                                )}
                             </div>

                             <div className="md:col-span-3 space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase">
                                  {formData.pricingMode === 'percentage' ? (isRtl ? 'الحصة (%)' : 'Share (%)') : (isRtl ? 'القيمة / السعر' : 'Amount')}
                                </Label>
                                <div className="relative">
                                   <Input 
                                     type="number" 
                                     value={formData.pricingMode === 'percentage' ? (item.percentage || 0) : (item.unitPrice || 0)} 
                                     onChange={e => updateItem(idx, formData.pricingMode === 'percentage' ? 'percentage' : 'unitPrice', Number(e.target.value))}
                                     className="h-12 rounded-xl border-2 font-black text-lg text-emerald-600 text-center"
                                   />
                                   {formData.pricingMode === 'percentage' && (
                                     <div className="absolute -bottom-6 left-0 right-0 text-center">
                                        <span className="text-[10px] font-black text-emerald-500">≈ {calculatedAmount.toLocaleString()} KWD</span>
                                     </div>
                                   )}
                                </div>
                             </div>

                             <div className="md:col-span-12 space-y-2 pt-4">
                                <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'وصف البند في الجدول' : 'Description for Table'}</Label>
                                <Textarea 
                                  value={item.description || ''} 
                                  onChange={e => updateItem(idx, 'description', e.target.value)}
                                  className="min-h-[60px] rounded-2xl bg-slate-50/50 border-dashed border-2"
                                  placeholder="..."
                                />
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  );
               })}

               {formData.pricingMode === 'percentage' && (
                 <div className={cn(
                   "p-8 rounded-[2rem] border-4 border-dashed flex items-center justify-between",
                   totalPercentage === 100 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                 )}>
                    <div className="flex items-center gap-3">
                       <Calculator className="h-8 w-8" />
                       <div className="text-start">
                          <p className="font-black text-lg">{isRtl ? 'إجمالي حصص العقد' : 'Total Contract Share'}</p>
                          <p className="text-xs font-bold opacity-70">{isRtl ? 'يجب أن يكون المجموع 100% من إجمالي قيمة العقد.' : 'Must sum up to 100% of contract total.'}</p>
                       </div>
                    </div>
                    <div className="text-center">
                       <span className="text-4xl font-black">{totalPercentage}%</span>
                       {totalPercentage !== 100 && <AlertTriangle className="h-5 w-5 mx-auto mt-1 animate-pulse" />}
                    </div>
                 </div>
               )}

               <Button 
                 variant="outline" 
                 onClick={addItem}
                 className="w-full h-20 rounded-[2.5rem] border-2 border-dashed border-primary/30 text-primary font-black text-lg hover:bg-primary/5 transition-all gap-4"
               >
                  <Plus className="h-7 w-7" /> {isRtl ? 'إضافة بند مالي جديد' : 'Add New Installment'}
               </Button>
            </div>
         </div>

         <div className="space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800"><FileText className="h-4 w-4 text-primary" /> {t('introText')}</CardTitle>
               </CardHeader>
               <CardContent className="p-6 text-start">
                  <Textarea 
                    value={formData.introText || ''} 
                    onChange={e => setFormData({...formData, introText: e.target.value})}
                    placeholder={isRtl ? "نص مقدمة عرض السعر..." : "Introduction text..."}
                    className="min-h-[150px] rounded-2xl bg-slate-50/50 p-4 border-2"
                  />
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t('defaultTerms')}</CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6 text-start">
                  <Textarea 
                    value={formData.defaultTerms || ''} 
                    onChange={e => setFormData({...formData, defaultTerms: e.target.value})}
                    placeholder={isRtl ? "الشروط والأحكام الخاصة بالعرض..." : "Terms and conditions..."}
                    className="min-h-[150px] rounded-2xl bg-slate-50/50 p-4 border-2"
                  />
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{t('validDays')}</Label>
                     <Input type="number" value={formData.validDays || 30} onChange={e => setFormData({...formData, validDays: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black" />
                  </div>
               </CardContent>
            </Card>

            <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white space-y-6 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                  <LayoutGrid className="h-32 w-32 text-primary" />
               </div>
               <div className="flex items-center justify-between relative z-10">
                  <div className="text-start">
                     <h4 className="font-black text-lg text-primary">{t('defaultTemplate')}</h4>
                     <p className="text-white/60 text-[10px] font-bold">{isRtl ? 'اعتماد كنموذج رئيسي لهذه الخدمة.' : 'Set as primary template.'}</p>
                  </div>
                  <Switch 
                    checked={formData.isDefault || false} 
                    onCheckedChange={v => setFormData({...formData, isDefault: v})} 
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
