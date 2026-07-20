
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

  const addItem = () => {
    const nextIdx = (formData.items || []).length;
    setFormData({
      ...formData, 
      items: [...(formData.items || []), { 
        label: getOrdinalLabel(nextIdx), 
        percentage: 0, 
        unitPrice: 0, 
        quantity: 1 
      }]
    });
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500" dir={dir}>
      <header className="flex items-center justify-between border-b pb-4 shrink-0 max-w-6xl mx-auto w-full px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 border rounded-lg">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <h1 className="text-lg font-black">{isRtl ? 'تصميم قالب عروض الأسعار' : 'Quotation Template Design'}</h1>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={handleSave} disabled={loading} size="sm" className="h-9 px-8 rounded-lg shadow-lg gap-2">
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              {isRtl ? 'حفظ القالب' : 'Save Template'}
           </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-6">
         <div className="md:col-span-8 space-y-6">
            <Card className="border-0 shadow-sm rounded-xl bg-white ring-1 ring-black/5">
               <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-start">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t('name')}</Label>
                     <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9 rounded-lg border-2 font-bold text-xs" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Code</Label>
                     <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-9 rounded-lg font-mono text-xs" />
                  </div>
                  <div className="flex items-center justify-between p-2 mt-4 bg-slate-50 rounded-lg border">
                     <Label className="text-[8px] font-black uppercase text-slate-500">Default</Label>
                     <Switch checked={formData.isDefault || false} onCheckedChange={v => setFormData({...formData, isDefault: v})} />
                  </div>
               </CardContent>
            </Card>

            <PrintWrapper className="mt-4 overflow-hidden">
               <div className="space-y-6">
                  <div className="p-4 bg-[#1e1b4b] rounded-xl text-white flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-start">
                        <Calculator className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[7px] font-black uppercase text-primary">Pricing Mode</p>
                          <Select value={formData.pricingMode} onValueChange={(v: PricingMode) => setFormData({...formData, pricingMode: v})}>
                             <SelectTrigger className="h-6 w-32 rounded-md bg-white/10 border-0 text-white font-black text-[9px]"><SelectValue /></SelectTrigger>
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
                           <Label className="text-[7px] font-black uppercase text-primary">{isRtl ? 'الميزانية' : 'Target'}</Label>
                           <Input 
                             type="number" 
                             value={formData.baseAmount === 0 ? "" : formData.baseAmount} 
                             onChange={e => setFormData({...formData, baseAmount: e.target.value === "" ? 0 : Number(e.target.value)})} 
                             className="h-6 rounded-md bg-white text-slate-900 font-black text-xs text-center shadow-inner" 
                           />
                        </div>
                      )}
                  </div>

                  <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white">
                     <table className="w-full text-[10px] text-start">
                        <thead className="bg-slate-900 text-white font-black uppercase">
                           <tr>
                              <th className="p-3 w-8">#</th>
                              <th className="p-3 text-start">{isRtl ? 'وصف الدفعة' : 'Item Description'}</th>
                              {formData.pricingMode === 'percentage' && <th className="p-3 text-center w-20">%</th>}
                              <th className="p-3 text-end pe-6 w-24">{isRtl ? 'القيمة' : 'Amount'}</th>
                              <th className="p-3 w-8"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y">
                           {(formData.items || []).map((item, idx) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 text-slate-300 font-bold">{idx + 1}</td>
                                <td className="p-2 text-start">
                                   <Input value={item.label} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-7 text-[10px] font-bold" />
                                </td>
                                {formData.pricingMode === 'percentage' && (
                                  <td className="p-2 text-center">
                                     <Input type="number" value={item.percentage === 0 ? "" : item.percentage} onChange={e => updateItem(idx, 'percentage', e.target.value === "" ? 0 : Number(e.target.value))} className="h-7 w-12 mx-auto text-center font-black text-[10px]" />
                                  </td>
                                )}
                                <td className="p-2 text-end pe-6">
                                   <Input type="number" step="0.001" value={item.unitPrice === 0 ? "" : item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value === "" ? 0 : Number(e.target.value))} disabled={formData.pricingMode === 'percentage'} className="h-7 w-20 ms-auto text-end font-mono font-black text-emerald-600 text-[10px]" />
                                </td>
                                <td className="p-2 text-center">
                                  <button type="button" onClick={() => updateItem(idx, 'deleted', true)} className="text-rose-300 hover:text-rose-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                     <Button variant="ghost" size="sm" onClick={addItem} className="w-full h-8 rounded-none border-t border-dashed font-black text-[9px] gap-2"><Plus className="h-3 w-3" /> {isRtl ? 'إضافة دفعة' : 'Add Item'}</Button>
                  </div>
               </div>
            </PrintWrapper>
         </div>

         <aside className="md:col-span-4 space-y-6 text-start">
            <Card className="border-0 shadow-sm rounded-xl bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-slate-400">
                     <Target className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'الارتباط التشغيلي' : 'Matching Context'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-4">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Activity</Label>
                     <Select value={formData.activityTypeId} onValueChange={v => setFormData({...formData, activityTypeId: v})}>
                        <SelectTrigger className="h-8 text-[10px] font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{activities?.map(a => <SelectItem key={a.id} value={a.id!} className="text-[10px] font-bold">{a.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Service Link</Label>
                     <Select value={formData.subServiceId} onValueChange={v => setFormData({...formData, subServiceId: v})}>
                        <SelectTrigger className="h-8 text-[10px] font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>{subServices?.map(s => <SelectItem key={s.id} value={s.id!} className="text-[10px] font-bold">{s.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-xl bg-white ring-1 ring-black/5 overflow-hidden">
               <CardHeader className="bg-slate-50 p-4 border-b"><CardTitle className="text-xs font-black uppercase text-slate-400">{t('defaultTerms')}</CardTitle></CardHeader>
               <CardContent className="p-4"><Textarea value={formData.defaultTerms} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} className="min-h-[200px] text-[10px] p-4 bg-slate-50/50 border-0" /></CardContent>
            </Card>
         </aside>
      </div>
    </div>
  );
}
