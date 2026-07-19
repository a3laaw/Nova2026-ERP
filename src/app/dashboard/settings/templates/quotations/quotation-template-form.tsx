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
    <div className="space-y-6 max-w-6xl mx-auto pb-10 text-start" dir={dir}>
      <header className="flex items-center justify-between border-b pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 border rounded-lg">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <h1 className="text-xl font-black">{isRtl ? 'إعداد قالب عرض السعر' : 'Setup Quote Template'}</h1>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 rounded-lg font-bold">إلغاء</Button>
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-9 px-6 rounded-lg shadow-lg gap-2">
             {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
             {t('save')}
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
         <div className="lg:col-span-8 space-y-6">
            <Card className="border-0 shadow-sm rounded-2xl bg-white ring-1 ring-black/5">
               <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                     <Label className="text-[10px] font-black uppercase text-slate-400">{t('name')}</Label>
                     <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9 rounded-lg font-bold" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Code</Label>
                     <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-9 rounded-lg font-mono text-xs" />
                  </div>
                  <div className="flex items-center justify-between p-2 mt-4 bg-slate-50 rounded-lg border">
                     <Label className="text-[9px] font-black uppercase text-slate-500">{isRtl ? 'افتراضي' : 'Default'}</Label>
                     <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                  </div>
               </CardContent>
            </Card>

            <Card className={cn(
              "border-0 shadow-md rounded-2xl p-6 transition-all ring-1 ring-black/5",
              stats.isValid ? "bg-emerald-50/50" : "bg-slate-50"
            )}>
               <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-start space-y-1 flex-1">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'الميزانية المستهدفة (KWD)' : 'Target Budget'}</Label>
                     <Input 
                        type="number" 
                        value={formData.baseAmount || 0} 
                        onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})} 
                        className="h-10 rounded-xl border-2 font-black text-xl text-primary bg-white text-center"
                     />
                  </div>
                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                     <div className="text-start">
                        <p className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'إجمالي البنود' : 'Items Sum'}</p>
                        <p className="text-lg font-black text-slate-800">{totalItemsValue.toLocaleString()}</p>
                     </div>
                     <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", stats.isValid ? "bg-emerald-500 text-white" : "bg-rose-100 text-rose-500")}>
                        {stats.isValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                     </div>
                  </div>
               </div>
            </Card>

            <div className="space-y-4">
               <div className="flex justify-between items-center px-2">
                  <h3 className="text-sm font-black flex items-center gap-2 text-slate-700"><Calculator className="h-4 w-4" /> {isRtl ? 'هيكلة بنود التسعير' : 'Pricing Matrix'}</h3>
                  <Select value={formData.pricingMode || 'itemized'} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                     <SelectTrigger className="h-8 w-36 rounded-lg border-2 font-black text-[10px] bg-white"><SelectValue /></SelectTrigger>
                     <SelectContent className="rounded-xl">
                        <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                        <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                        <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                     </SelectContent>
                  </Select>
               </div>

               <div className="space-y-3">
                  {formData.items?.map((item, idx) => {
                    const lineAmount = formData.pricingMode === 'percentage' 
                      ? ((formData.baseAmount || 0) * (item.percentage || 0)) / 100 
                      : (item.unitPrice || 0);

                    return (
                      <Card key={idx} className="border-0 shadow-sm rounded-xl bg-white group hover:shadow-md transition-all">
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <div className="md:col-span-1 flex justify-center"><Badge variant="outline" className="h-7 w-7 rounded-md font-black">#{idx + 1}</Badge></div>
                            <div className="md:col-span-6 space-y-1 text-start">
                              <Input value={item.label || ''} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-8 rounded-lg border-transparent hover:border-slate-200 bg-slate-50 font-bold text-xs" placeholder="اسم الدفعة..." />
                              <Textarea value={item.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} className="min-h-[40px] text-[10px] py-1 border-transparent hover:border-slate-200 bg-transparent resize-none" placeholder="وصف فني مختصر..." />
                            </div>
                            <div className="md:col-span-5 flex items-center gap-3 text-start">
                              {formData.pricingMode === 'percentage' && (
                                <div className="space-y-1 flex-1">
                                  <Label className="text-[9px] font-black text-slate-400">الحصة %</Label>
                                  <div className="relative">
                                    <Input type="number" value={item.percentage} onChange={e => updateItem(idx, 'percentage', Number(e.target.value))} className="h-8 rounded-lg border-2 font-black text-xs text-center pe-6" />
                                    <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-slate-300" />
                                  </div>
                                </div>
                              )}
                              <div className="space-y-1 flex-1">
                                  <Label className="text-[9px] font-black text-slate-400">{formData.pricingMode === 'percentage' ? 'المبلغ' : 'السعر'}</Label>
                                  <Input 
                                    type="number" 
                                    readOnly={formData.pricingMode === 'percentage'}
                                    value={formData.pricingMode === 'percentage' ? lineAmount : item.unitPrice} 
                                    onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                                    className={cn("h-8 rounded-lg border-2 font-black text-xs text-center", formData.pricingMode === 'percentage' ? "bg-slate-50 border-transparent" : "bg-white")} 
                                  />
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, items: formData.items?.filter((_, i) => i !== idx)})} className="h-8 w-8 text-rose-300 hover:text-rose-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Button onClick={() => setFormData({...formData, items: [...(formData.items || []), { label: '', percentage: 0, unitPrice: 0, quantity: 1 }]})} variant="outline" size="sm" className="w-full h-10 rounded-xl border-dashed border-primary/40 text-primary font-black gap-2 hover:bg-primary/5 transition-all text-xs"><Plus className="h-4 w-4" /> {t('addQuotationItem')}</Button>
               </div>

               <div className={cn(
                 "p-4 rounded-2xl border-2 flex items-center justify-between shadow-sm transition-all",
                 stats.isValid ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
               )}>
                  <div className="text-start">
                     <p className="text-[8px] font-black uppercase opacity-60 tracking-widest">{isRtl ? 'إجمالي الحصص الموزعة' : 'Total Distribution'}</p>
                     <p className="text-lg font-black">{formData.pricingMode === 'percentage' ? `${stats.totalPercentage}%` : `${stats.totalItemizedAmount.toLocaleString()} KWD`}</p>
                  </div>
                  <div className="text-end">
                     <Badge className={cn("font-black text-[9px] uppercase", stats.isValid ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                        {stats.isValid ? 'BALANCED' : 'MISMATCH'}
                     </Badge>
                  </div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-md rounded-2xl bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 border-b p-4 text-start"><CardTitle className="text-xs font-black flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {t('introText')}</CardTitle></CardHeader>
               <CardContent className="p-4"><Textarea value={formData.introText || ''} onChange={e => setFormData({...formData, introText: e.target.value})} className="min-h-[100px] rounded-lg bg-slate-50/30 p-3 text-[11px] font-bold leading-relaxed border-2" /></CardContent>
            </Card>

            <Card className="border-0 shadow-md rounded-2xl bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 border-b p-4 text-start"><CardTitle className="text-xs font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t('defaultTerms')}</CardTitle></CardHeader>
               <CardContent className="p-4"><Textarea value={formData.defaultTerms || ''} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} className="min-h-[150px] rounded-lg bg-slate-50/30 p-3 text-[11px] font-bold leading-relaxed border-2" /></CardContent>
            </Card>

            <div className="p-5 bg-[#1e1b4b] rounded-2xl text-white space-y-4 text-start">
               <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest border-b border-white/10 pb-2">
                  <Target className="h-3 w-3" /> {isRtl ? 'المطابقة والربط' : 'Context'}
               </div>
               <div className="space-y-3">
                  <div className="space-y-1">
                     <Label className="text-[8px] text-white/50 uppercase">Activity</Label>
                     <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v})}>
                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white/5 border-white/10"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="text-xs font-bold">{a.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[8px] text-white/50 uppercase">Technical Path</Label>
                     <Select value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white/5 border-white/10"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{subServices?.map(s => <SelectItem key={s.id} value={s.id!} className="text-xs font-bold">{s.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

const totalItemsValue = 0; // Placeholder to avoid compilation error in sample