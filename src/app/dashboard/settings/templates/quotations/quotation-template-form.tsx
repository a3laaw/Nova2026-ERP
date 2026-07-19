'use client';

import { useState, useMemo } from 'react';
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
  DollarSign, AlertTriangle, Target, Percent
} from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { useAuthContext } from '@/context/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { QuotationTemplate, PricingMode } from '@/types/templates';
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
  const { permissions } = usePermissions();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [loading, setLoading] = useState(false);
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
          percentage: 0
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

  // محرك الحساب الموحد
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
        title: t('error'), 
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <h1 className="text-2xl font-black font-headline">{isRtl ? 'إعداد قالب عرض السعر المرجعي' : 'Setup Quote Template'}</h1>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-primary text-white font-black rounded-xl h-12 px-10 shadow-xl gap-2 hover:scale-[1.02] transition-all">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {t('save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardContent className="p-10 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                        <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Code</Label>
                        <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-12 rounded-xl border-2 font-mono" />
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className={cn(
              "p-12 rounded-[3.5rem] border-2 text-center relative overflow-hidden group shadow-xl transition-all",
              stats.isValid ? "bg-emerald-50/50 border-emerald-100" : "bg-slate-900 border-slate-800 text-white"
            )}>
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="h-40 w-40" /></div>
               <div className="max-w-md mx-auto space-y-4 relative z-10">
                  <Label className={cn("text-xs font-black uppercase tracking-[0.2em]", stats.isValid ? "text-emerald-600" : "text-primary")}>
                     {isRtl ? 'الميزانية المستهدفة للعقد (KWD)' : 'Total Estimated Contract Baseline (KWD)'}
                  </Label>
                  <Input 
                     type="number" 
                     value={formData.baseAmount || 0} 
                     onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                     className={cn(
                       "h-20 rounded-[2.5rem] border-4 font-black text-4xl text-center shadow-2xl focus:ring-4",
                       stats.isValid ? "border-emerald-200 text-emerald-700 bg-white" : "border-slate-700 bg-slate-800 text-white"
                     )}
                  />
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex justify-between items-center px-6">
                  <h3 className="text-2xl font-black font-headline flex items-center gap-3"><Calculator className="h-8 w-8 text-primary" /> {isRtl ? 'هيكلة بنود التسعير' : 'Pricing Matrix'}</h3>
                  <Select value={formData.pricingMode || 'itemized'} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                     <SelectTrigger className="h-10 w-48 rounded-xl border-2 font-black text-xs bg-white shadow-sm"><SelectValue /></SelectTrigger>
                     <SelectContent className="rounded-2xl border-0 shadow-2xl">
                        <SelectItem value="itemized" className="font-bold">{t('itemized')}</SelectItem>
                        <SelectItem value="fixed" className="font-bold">{t('fixed')}</SelectItem>
                        <SelectItem value="percentage" className="font-bold">{t('percentage')}</SelectItem>
                     </SelectContent>
                  </Select>
               </div>

               <div className="space-y-4">
                  {formData.items?.map((item, idx) => {
                    const lineAmount = formData.pricingMode === 'percentage' 
                      ? ((formData.baseAmount || 0) * (item.percentage || 0)) / 100 
                      : (item.unitPrice || 0);

                    return (
                      <Card key={idx} className="border-0 shadow-lg rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/10 transition-all">
                        <CardContent className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-1 flex justify-center"><Badge className="h-10 w-10 rounded-xl bg-slate-900 text-white font-black">#{idx + 1}</Badge></div>
                            <div className="md:col-span-6 space-y-1 text-start">
                              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المسمى / الدفعة' : 'Description / Milestone'}</Label>
                              <Input value={item.label || ''} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-11 border-2 font-black rounded-xl bg-slate-50/50" />
                            </div>
                            <div className="md:col-span-4 grid grid-cols-2 gap-3 text-start">
                              <div className="space-y-1">
                                  <Label className="text-[9px] font-black text-slate-400 uppercase">{formData.pricingMode === 'percentage' ? '%' : 'KWD'}</Label>
                                  <div className="relative">
                                    <Input 
                                      type="number" 
                                      value={formData.pricingMode === 'percentage' ? item.percentage : item.unitPrice} 
                                      onChange={e => updateItem(idx, formData.pricingMode === 'percentage' ? 'percentage' : 'unitPrice', Number(e.target.value))} 
                                      className="h-11 border-2 font-black text-emerald-600 rounded-xl text-center pe-8" 
                                    />
                                    {formData.pricingMode === 'percentage' && <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />}
                                  </div>
                              </div>
                              <div className="flex items-end justify-between pb-1">
                                  <div className="text-end">
                                     <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'القيمة المحسوبة' : 'Calculated'}</p>
                                     <p className="text-xs font-black text-slate-900">{lineAmount.toLocaleString()} <span className="text-[8px] opacity-30">KWD</span></p>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, items: formData.items?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-5 w-5" /></Button>
                              </div>
                            </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Button onClick={() => setFormData({...formData, items: [...(formData.items || []), { label: '', percentage: 0, unitPrice: 0, quantity: 1 }]})} variant="outline" className="w-full h-16 rounded-[2.5rem] border-2 border-dashed border-primary/20 text-primary font-black gap-2 hover:bg-primary/5 transition-all"><Plus className="h-6 w-6" /> {t('addQuotationItem')}</Button>
               </div>

               {/* التحقق من توازن القالب */}
               <div className={cn(
                 "p-10 rounded-[3rem] border-4 border-dashed flex items-center justify-between shadow-xl transition-all",
                 stats.isValid ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
               )}>
                  <div className="text-center bg-white p-6 rounded-[2rem] shadow-xl min-w-[200px]">
                     <span className="text-4xl font-black font-headline">
                        {formData.pricingMode === 'percentage' ? `${stats.totalPercentage}%` : `${stats.totalItemizedAmount.toLocaleString()} KWD`}
                     </span>
                  </div>
                  <div className="text-end space-y-1">
                     <p className="font-black text-2xl font-headline">{formData.pricingMode === 'percentage' ? t('totalQuoteShare') : t('totalQuoteValue')}</p>
                     <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{stats.isValid ? 'READY FOR INSTANTIATION' : 'VALIDATION REQUIRED'}</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-1 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 border-b p-6 text-start"><CardTitle className="text-sm font-black flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {t('introText')}</CardTitle></CardHeader>
               <CardContent className="p-6"><Textarea value={formData.introText || ''} onChange={e => setFormData({...formData, introText: e.target.value})} className="min-h-[150px] rounded-2xl bg-slate-50/50 p-4 border-2 text-xs font-bold leading-relaxed" /></CardContent>
            </Card>
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 border-b p-6 text-start"><CardTitle className="text-sm font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t('defaultTerms')}</CardTitle></CardHeader>
               <CardContent className="p-6"><Textarea value={formData.defaultTerms || ''} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} className="min-h-[300px] rounded-2xl bg-slate-50/50 p-4 border-2 text-xs font-bold leading-relaxed" /></CardContent>
            </Card>

            <div className="space-y-4 p-6 bg-primary/5 rounded-[2.5rem] border border-primary/10 text-start">
               <Label className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <Target className="h-4 w-4" /> {isRtl ? 'المطابقة والربط' : 'Matching Context'}
               </Label>
               <div className="space-y-3">
                  <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v})}>
                    <SelectTrigger className="h-10 font-bold border-2 bg-white"><SelectValue placeholder="Activity..." /></SelectTrigger>
                    <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                    <SelectTrigger className="h-10 font-bold border-2 bg-white"><SelectValue placeholder="Technical Path..." /></SelectTrigger>
                    <SelectContent>{subServices?.map(s => <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
