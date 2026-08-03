
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, Info, CreditCard, TrendingDown, Clock, 
  Calculator, RefreshCcw, Save, Trash2, HardHat
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SmartDateInput } from "@/components/ui/smart-date-input";
import { Equipment } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';

interface Props {
  initialData?: Partial<Equipment>;
  onSubmit: (data: any) => void;
  loading: boolean;
  isRtl: boolean;
}

export function EquipmentForm({ initialData, onSubmit, loading, isRtl }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Partial<Equipment>>({
    code: '', name: '', type: '', ownershipType: 'owned', 
    purchaseCost: 0, salvageValue: 1, 
    depreciationMethod: 'hours', isFinanced: false,
    hourlyRentalRate: 0, hourlyDepreciationRate: 0, status: 'available',
    ...initialData
  });

  const handleAutoCalculateRate = () => {
    const cost = Number(form.purchaseCost) || 0;
    const salvage = Number(form.salvageValue) || 0;
    const hours = Number(form.expectedTotalHours) || 0;

    if (hours > 0) {
      const rate = (cost - salvage) / hours;
      setForm({ ...form, hourlyDepreciationRate: Number(rate.toFixed(3)) });
    }
  };

  const validateAndSubmit = () => {
    if (form.ownershipType === 'owned' && form.depreciationMethod === 'hours' && !form.hourlyDepreciationRate) {
       // Alert handled in parent usually, but logic is here
    }
    onSubmit(form);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. Basic Info Section */}
      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white/60 backdrop-blur-xl ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 p-8 border-b">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg ring-4 ring-primary/5">
                 <Info className="h-6 w-6" />
              </div>
              <div className="text-start">
                 <CardTitle className="text-xl font-black font-headline text-slate-800">{isRtl ? 'البيانات الأساسية للمعدة' : 'Basic Equipment Details'}</CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Identification & Classification</p>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-start">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Equipment Code</Label>
                 <Input 
                   value={form.code} 
                   onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} 
                   className="h-14 rounded-2xl border-2 font-mono font-black text-primary bg-slate-50 focus:bg-white transition-all shadow-inner" 
                   placeholder="EQP-0000" 
                 />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم المعدة (الموديل)' : 'Equipment Name'}</Label>
                 <Input 
                   value={form.name} 
                   onChange={e => setForm({...form, name: e.target.value})} 
                   className="h-14 rounded-2xl border-2 font-bold text-lg bg-slate-50 focus:bg-white transition-all shadow-inner" 
                   placeholder={isRtl ? "مثلاً: حفار كوماتسو 2026" : "e.g. Komatsu Excavator 2026"} 
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'النوع' : 'Type'}</Label>
                 <Input 
                   value={form.type} 
                   onChange={e => setForm({...form, type: e.target.value})} 
                   className="h-14 rounded-2xl border-2 font-bold bg-slate-50 focus:bg-white transition-all shadow-inner" 
                 />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تاريخ بدء التشغيل' : 'Commencement Date'}</Label>
                 <SmartDateInput value={form.purchaseDate || ''} onChange={v => setForm({...form, purchaseDate: v})} />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'رقم اللوحة / المرجع' : 'Plate Number / Reference'}</Label>
                 <Input 
                   value={form.plateNumber || ''} 
                   onChange={e => setForm({...form, plateNumber: e.target.value})} 
                   className="h-14 rounded-2xl border-2 font-bold bg-slate-50 focus:bg-white transition-all shadow-inner" 
                 />
              </div>
           </div>
        </CardContent>
      </Card>

      {/* 2. Ownership & Financing Section */}
      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="bg-slate-50/50 p-8 border-b">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-lg ring-4 ring-blue-50">
                 <CreditCard className="h-6 w-6" />
              </div>
              <div className="text-start">
                 <CardTitle className="text-xl font-black font-headline text-slate-800">{isRtl ? 'الملكية والتمويل' : 'Ownership & Financing'}</CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Asset Status & Liabilities</p>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10 text-start">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-4">
                 <Label className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] block">{isRtl ? 'نوع ملكية الأصل' : 'Ownership Structure'}</Label>
                 <Select value={form.ownershipType} onValueChange={(v: any) => setForm({...form, ownershipType: v})}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 font-black text-lg bg-white shadow-sm">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 shadow-2xl">
                       <SelectItem value="owned" className="font-bold py-3">{isRtl ? 'مملوكة للمنشأة (Internal)' : 'Internal (Owned)'}</SelectItem>
                       <SelectItem value="rented" className="font-bold py-3 text-orange-600">{isRtl ? 'مستأجرة من الغير (Rental)' : 'External (Rented)'}</SelectItem>
                    </SelectContent>
                 </Select>
              </div>

              {form.ownershipType === 'owned' && (
                 <div className="p-6 rounded-3xl bg-primary/5 border-2 border-primary/10 flex items-center justify-between group animate-in slide-in-from-left-4 duration-500 shadow-sm">
                    <div className="space-y-0.5 text-start">
                       <Label className="font-black text-sm uppercase text-primary tracking-tighter">{isRtl ? 'معدة ممولة / أقساط بنكية' : 'Financed Asset'}</Label>
                       <p className="text-[10px] font-bold text-slate-400">{isRtl ? 'تفعيل في حال وجود التزامات مالية' : 'Enable if asset has installments'}</p>
                    </div>
                    <Switch checked={form.isFinanced} onCheckedChange={v => setForm({...form, isFinanced: v})} className="scale-125 data-[state=checked]:bg-primary" />
                 </div>
              )}
           </div>

           {form.ownershipType === 'owned' && form.isFinanced && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-slate-50 rounded-[3rem] border-2 border-white shadow-inner animate-in zoom-in-95 duration-300">
                 <div className="space-y-2 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'جهة التمويل (البنك)' : 'Financial Institution'}</Label>
                    <Input value={form.financierName || ''} onChange={e => setForm({...form, financierName: e.target.value})} className="h-12 rounded-xl bg-white border-2 font-bold" />
                 </div>
                 <div className="space-y-2 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'القسط الشهري' : 'Monthly Installment'}</Label>
                    <div className="relative">
                       <Input type="number" value={form.monthlyInstallment || ''} onChange={e => setForm({...form, monthlyInstallment: Number(e.target.value)})} className="h-12 rounded-xl bg-white border-2 font-black text-emerald-600 text-lg ps-4" />
                       <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">KWD</span>
                    </div>
                 </div>
                 <div className="space-y-2 text-start">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'يوم الاستحقاق' : 'Due Day'}</Label>
                    <Input type="number" min="1" max="31" value={form.installmentDay || 1} onChange={e => setForm({...form, installmentDay: Number(e.target.value)})} className="h-12 rounded-xl bg-white border-2 font-black text-center" />
                 </div>
              </div>
           )}
        </CardContent>
      </Card>

      {/* 3. Financial & Depreciation Section */}
      {form.ownershipType === 'owned' && (
        <Card className="border-0 shadow-3xl rounded-[3rem] bg-white ring-1 ring-black/5 overflow-hidden">
           <CardHeader className="bg-slate-50/50 p-8 border-b">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-lg ring-4 ring-emerald-50">
                    <TrendingDown className="h-6 w-6" />
                 </div>
                 <div className="text-start">
                    <CardTitle className="text-xl font-black font-headline text-slate-800">{isRtl ? 'المعالجة المالية والإهلاك' : 'Financial & Depreciation'}</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Valuation & Recovery Calculation</p>
                 </div>
              </div>
           </CardHeader>
           <CardContent className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-8 text-start">
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'سعر شراء الأصل' : 'Purchase Cost'}</Label>
                          <Input type="number" value={form.purchaseCost || ''} onChange={e => setForm({...form, purchaseCost: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-slate-900 text-xl bg-slate-50/50" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'القيمة التخريدية' : 'Salvage Value'}</Label>
                          <Input type="number" value={form.salvageValue || ''} onChange={e => setForm({...form, salvageValue: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-slate-500 text-xl bg-slate-50/50" />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'طريقة احتساب الإهلاك' : 'Depreciation Logic'}</Label>
                       <Select value={form.depreciationMethod} onValueChange={(v: any) => setForm({...form, depreciationMethod: v})}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-white">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-2 shadow-2xl">
                             <SelectItem value="hours" className="font-bold py-3">{isRtl ? 'ساعات التشغيل (KWD/HR)' : 'Hourly Usage (Internal)'}</SelectItem>
                             <SelectItem value="straight" className="font-bold py-3">{isRtl ? 'قسط ثابت (سنوي %)' : 'Straight Line (%)'}</SelectItem>
                             <SelectItem value="none" className="font-bold py-3 text-slate-300">{isRtl ? 'لا يوجد إهلاك' : 'No Depreciation'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="p-10 rounded-[3rem] bg-slate-900 text-white shadow-3xl relative overflow-hidden flex flex-col justify-center gap-6 border-b-8 border-emerald-500 group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform"><Calculator className="h-32 w-32 text-primary" /></div>
                    <div className="relative z-10 text-start space-y-3">
                       <Label className="text-sm font-black uppercase tracking-[0.2em] text-primary">{isRtl ? 'معدل التكلفة المعتمد بالساعة' : 'Hourly Recovery Rate'}</Label>
                       <div className="flex items-center gap-4">
                          <div className="relative flex-1">
                             <Input 
                                type="number" 
                                step="0.001" 
                                value={form.hourlyDepreciationRate || ''} 
                                onChange={e => setForm({...form, hourlyDepreciationRate: Number(e.target.value)})} 
                                className="h-20 rounded-3xl bg-white/10 border-0 text-5xl font-black text-emerald-400 text-center shadow-inner"
                             />
                             <span className="absolute right-6 bottom-6 text-xs font-black text-white/30">KWD / HR</span>
                          </div>
                          <Button 
                             onClick={handleAutoCalculateRate} 
                             className="h-20 w-20 rounded-3xl bg-primary text-white shadow-xl hover:scale-105 transition-all shrink-0 border-b-8 border-orange-700"
                             title="حساب تلقائي"
                          >
                             <RefreshCcw className="h-8 w-8" />
                          </Button>
                       </div>
                    </div>
                    <div className="relative z-10 pt-6 border-t border-white/5 space-y-2 text-start">
                       <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'إجمالي الساعات المتوقعة للمعايرة' : 'Expected Lifetime Hours'}</Label>
                       <Input 
                          type="number" 
                          value={form.expectedTotalHours || ''} 
                          onChange={e => setForm({...form, expectedTotalHours: Number(e.target.value)})} 
                          className="h-10 bg-white/5 border-white/10 text-white font-mono font-black text-center" 
                       />
                    </div>
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      {/* Rented Price Section */}
      {form.ownershipType === 'rented' && (
        <Card className="border-0 shadow-3xl rounded-[3rem] bg-orange-600 text-white p-12 relative overflow-hidden group animate-in zoom-in-95 duration-500">
           <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform"><Clock className="h-48 w-48" /></div>
           <div className="relative z-10 text-center space-y-6">
              <Label className="text-xl font-black uppercase tracking-[0.3em] text-orange-200">{isRtl ? 'تعرفة الاستئجار المباشر بالساعة' : 'Direct Hourly Rental Rate'}</Label>
              <div className="relative max-w-xs mx-auto">
                 <Input 
                    type="number" 
                    step="0.001" 
                    value={form.hourlyRentalRate || ''} 
                    onChange={e => setForm({...form, hourlyRentalRate: Number(e.target.value)})} 
                    className="h-24 rounded-[2rem] bg-white border-0 text-6xl font-black text-orange-600 text-center shadow-inner" 
                 />
                 <span className="absolute right-6 bottom-8 text-sm font-black text-slate-300">KWD / HR</span>
              </div>
              <p className="text-sm font-bold text-orange-100 opacity-70 italic max-w-lg mx-auto leading-relaxed">
                 {isRtl ? 'سيتم استخدام هذه القيمة كتعرفة توريد خارجية عند ربط المعدة ببنود المقايسة الميدانية.' : 'This value will be used as external supply cost when linking equipment to BOQ execution entries.'}
              </p>
           </div>
        </Card>
      )}

      {/* Action Footer */}
      <div className="pt-10 flex justify-end gap-4 print:hidden">
         <Button 
           variant="outline" 
           onClick={() => window.history.back()} 
           className="h-16 px-10 rounded-2xl font-black border-2 border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all"
         >
            {isRtl ? 'إلغاء والرجوع' : 'Cancel & Return'}
         </Button>
         <Button 
           onClick={validateAndSubmit} 
           disabled={loading}
           className="h-16 px-16 rounded-2xl bg-primary text-white font-black text-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-4 border-b-8 border-orange-700"
         >
            {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
            {form.id ? (isRtl ? 'تحديث سجل الأصل' : 'Update Asset Record') : (isRtl ? 'اعتماد وإضافة المعدة' : 'Commit & Register')}
         </Button>
      </div>
    </div>
  );
}
