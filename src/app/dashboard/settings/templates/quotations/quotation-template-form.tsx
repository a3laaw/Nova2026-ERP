'use client';

import { useState, useMemo, useEffect } from 'react';
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
  LayoutGrid, Boxes, Layers, Calculator,
  ShieldCheck, Info, Sparkles
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, PricingMode, QuotationItem } from '@/types/templates';
import { ActivityType, Service, SubService } from '@/types/reference';
import { TemplateService } from '@/services/template-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

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
      activityTypeId: '',
      serviceId: '',
      subServiceId: '',
      introText: '',
      defaultTerms: '',
      validDays: 30,
      pricingMode: 'itemized',
      items: [{ description: '', unit: 'unit', quantity: 1, unitPrice: 0, notes: '' }],
      isDefault: false,
      isActive: true
    }
  );

  // جلب المراجع الفنية للربط
  const actQuery = useMemo(() => companyId && db ? query(collection(db, paths.activityTypes(companyId)), orderBy('name')) : null, [db, companyId]);
  const srvQuery = useMemo(() => companyId && db && formData.activityTypeId ? query(collection(db, paths.services(companyId, formData.activityTypeId)), orderBy('name')) : null, [db, companyId, formData.activityTypeId]);
  const subQuery = useMemo(() => companyId && db && formData.activityTypeId && formData.serviceId ? query(collection(db, paths.subServices(companyId, formData.activityTypeId, formData.serviceId)), orderBy('name')) : null, [db, companyId, formData.activityTypeId, formData.serviceId]);

  const { data: activities } = useCollection<ActivityType>(actQuery);
  const { data: services } = useCollection<Service>(srvQuery);
  const { data: subServices } = useCollection<SubService>(subQuery);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...(formData.items || []), { description: '', unit: 'unit', quantity: 1, unitPrice: 0, notes: '' }]
    });
  };

  const removeItem = (idx: number) => {
    setFormData({
      ...formData,
      items: formData.items?.filter((_, i) => i !== idx)
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
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Fields" });
      return;
    }

    setLoading(true);
    try {
      const service = new TemplateService(db, companyId);
      
      // إسناد المسميات المرجعية لسهولة العرض مستقبلاً
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
            <h1 className="text-2xl font-black font-headline">
               {template ? (isRtl ? 'تعديل قالب عرض سعر' : 'Edit Quote Template') : (isRtl ? 'إنشاء قالب عرض سعر جديد' : 'New Quote Template')}
            </h1>
            <p className="text-xs font-bold text-muted-foreground opacity-70">
               {isRtl ? 'تحديد البنود، الشروط، ونظام التسعير المرجعي' : 'Define line items, terms, and reference pricing'}
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
            {/* 1. Basic Info & Linking */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-primary/5 p-8 border-b text-start">
                  <CardTitle className="text-lg font-black flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> {isRtl ? 'الارتباط التشغيلي' : 'Operational Link'}</CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الكود المرجعي' : 'Template Code'}</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="h-12 rounded-xl border-2 font-mono" placeholder="e.g. RES_ARCH_01" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t('orgRef')}</Label>
                        <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v, serviceId: '', subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{isRtl ? a.name : a.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t('techRef')}</Label>
                        <Select disabled={!formData.activityTypeId} value={formData.serviceId} onValueChange={v => setFormData({...formData, serviceId: v, subServiceId: ''})}>
                           <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{services?.map(s => <SelectItem key={s.id} value={s.id!}>{isRtl ? s.name : s.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t('newPath')}</Label>
                        <Select disabled={!formData.serviceId} value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                           <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent>{subServices?.map(ss => <SelectItem key={ss.id} value={ss.id!}>{isRtl ? ss.name : ss.nameEn}</SelectItem>)}</SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* 2. Items & Pricing */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-900 text-white p-8 border-b flex flex-row items-center justify-between">
                  <div className="text-start">
                     <CardTitle className="text-lg font-black flex items-center gap-2 text-primary"><Calculator className="h-5 w-5" /> {isRtl ? 'بنود التسعير المرجعية' : 'Pricing Line Items'}</CardTitle>
                  </div>
                  <div className="flex items-center gap-3">
                     <Label className="text-white text-[10px] font-black uppercase tracking-widest">{t('pricingMode')}</Label>
                     <Select value={formData.pricingMode} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                        <SelectTrigger className="h-10 w-40 bg-white/10 border-white/20 text-white font-black text-xs rounded-lg">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="itemized" className="font-bold">{t('itemized')}</SelectItem>
                           <SelectItem value="fixed" className="font-bold">{t('fixed')}</SelectItem>
                           <SelectItem value="percentage" className="font-bold">{t('percentage')}</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                  {formData.items?.map((item, idx) => (
                    <div key={idx} className="p-6 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                       <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-2 text-start">
                             <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'وصف البند أو المرحلة' : 'Item/Stage Description'}</Label>
                             <Input 
                               value={item.description} 
                               onChange={e => updateItem(idx, 'description', e.target.value)} 
                               className="h-10 rounded-xl bg-white border-2 font-bold"
                             />
                          </div>
                          {formData.items!.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-10 w-10 text-rose-500 hover:bg-rose-50 rounded-xl mt-6">
                               <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                          {formData.pricingMode === 'itemized' && (
                             <>
                                <div className="space-y-1.5 text-start">
                                   <Label className="text-[8px] font-black text-slate-400 uppercase">{t('quantity')}</Label>
                                   <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="h-10 rounded-xl bg-white" />
                                </div>
                                <div className="space-y-1.5 text-start">
                                   <Label className="text-[8px] font-black text-slate-400 uppercase">{t('unit')}</Label>
                                   <Input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="h-10 rounded-xl bg-white" />
                                </div>
                                <div className="space-y-1.5 text-start">
                                   <Label className="text-[8px] font-black text-slate-400 uppercase">{t('unitPrice')}</Label>
                                   <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="h-10 rounded-xl bg-white font-mono text-emerald-600 font-black" />
                                </div>
                             </>
                          )}
                          {formData.pricingMode === 'percentage' && (
                             <div className="space-y-1.5 text-start">
                                <Label className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'النسبة (%)' : 'Percentage %'}</Label>
                                <Input type="number" value={item.percentage} onChange={e => updateItem(idx, 'percentage', Number(e.target.value))} className="h-10 rounded-xl bg-white font-black text-primary" />
                             </div>
                          )}
                          <div className={cn("space-y-1.5 text-start", formData.pricingMode === 'fixed' ? 'col-span-4' : '')}>
                             <Label className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'ملاحظات البند' : 'Notes'}</Label>
                             <Input value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} className="h-10 rounded-xl bg-white" />
                          </div>
                       </div>
                    </div>
                  ))}
                  
                  <Button 
                    variant="outline" 
                    onClick={addItem}
                    className="w-full h-14 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-black gap-2 hover:bg-primary/5 transition-all"
                  >
                     <Plus className="h-5 w-5" /> {t('addQuotationItem')}
                  </Button>
               </CardContent>
            </Card>
         </div>

         <div className="space-y-8">
            {/* 3. Narrative Content */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50 border-b p-6 text-start">
                  <CardTitle className="text-sm font-black flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {t('introText')}</CardTitle>
               </CardHeader>
               <CardContent className="p-6 text-start">
                  <Textarea 
                    value={formData.introText} 
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
                    value={formData.defaultTerms} 
                    onChange={e => setFormData({...formData, defaultTerms: e.target.value})}
                    placeholder={isRtl ? "الشروط والأحكام الخاصة بالعرض..." : "Terms and conditions..."}
                    className="min-h-[150px] rounded-2xl bg-slate-50/50 p-4 border-2"
                  />
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{t('validDays')}</Label>
                     <Input type="number" value={formData.validDays} onChange={e => setFormData({...formData, validDays: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black" />
                  </div>
               </CardContent>
            </Card>

            {/* 4. Global Settings */}
            <div className="p-8 rounded-[2.5rem] bg-primary text-white space-y-6 shadow-2xl shadow-primary/20">
               <div className="flex items-center justify-between">
                  <div className="text-start">
                     <h4 className="font-black text-lg">{t('defaultTemplate')}</h4>
                     <p className="text-white/60 text-[10px] font-bold">{isRtl ? 'سيتم اختيار هذا القالب آلياً عند فتح عرض سعر لهذه الخدمة.' : 'Automatically selected when creating a quote for this service.'}</p>
                  </div>
                  <Switch 
                    checked={formData.isDefault} 
                    onCheckedChange={v => setFormData({...formData, isDefault: v})} 
                    className="data-[state=checked]:bg-white data-[state=checked]:text-primary"
                  />
               </div>
               
               <div className="pt-4 border-t border-white/20 flex items-start gap-3">
                  <Sparkles className="h-6 w-6 text-white/40 shrink-0" />
                  <p className="text-[10px] font-bold leading-relaxed text-white/80 text-start">
                     {isRtl ? 'نصيحة: استخدم الكلمات المفتاحية في المقدمة مثل [CLIENT_NAME] أو [PROJECT_NAME] ليتم استبدالها لاحقاً بالقيم الفعلية.' : 'Tip: Use placeholders like [CLIENT_NAME] in the intro to be replaced during generation.'}
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
