'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Info, CreditCard, TrendingDown, Clock, 
  Calculator, RefreshCcw, Save, Truck,
  Building2, Sparkles, ShieldCheck
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
import { Equipment, DepreciationMethod, RentalCostMethod } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';

interface Props {
  initialData?: Partial<Equipment>;
  onSubmit: (data: any) => void;
  loading: boolean;
  isRtl: boolean;
}

export function EquipmentForm({ initialData, onSubmit, loading, isRtl }: Props) {
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [form, setForm] = useState<Partial<Equipment>>({
    code: '', name: '', type: '', ownershipType: 'owned', 
    purchaseCost: 0, salvageValue: 1, 
    depreciationMethod: 'hours', isFinanced: false,
    hourlyRentalRate: 0, hourlyDepreciationRate: 0, status: 'available',
    isActive: true,
    ...initialData
  });

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

  const handleAutoCalculateRate = () => {
    const cost = Number(form.purchaseCost) || 0;
    const salvage = Number(form.salvageValue) || 0;
    const hours = Number(form.expectedTotalHours) || 0;

    if (hours > 0) {
      const rate = (cost - salvage) / hours;
      setForm({ ...form, hourlyDepreciationRate: Number(rate.toFixed(3)) });
    }
  };

  const isOwned = form.ownershipType === 'owned';

  return (
    <div className="space-y-8 text-start pb-20 animate-in fade-in duration-700">
      
      {/* 1. Basic Info Section */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="bg-primary/5 p-8 border-b">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg">
                 <Info className="h-6 w-6" />
              </div>
              <div>
                 <CardTitle className="text-xl font-black">{isRtl ? 'البيانات التعريفية' : 'Basic Details'}</CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Classification & Identity</p>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Equipment Code</Label>
                 <Input 
                   value={form.code} 
                   onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} 
                   className="h-12 rounded-xl border-2 font-mono font-black text-primary bg-slate-50" 
                 />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم المعدة / الموديل' : 'Equipment Name'}</Label>
                 <Input 
                   value={form.name} 
                   onChange={e => setForm({...form, name: e.target.value})} 
                   className="h-12 rounded-xl border-2 font-bold bg-slate-50" 
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نوع الملكية' : 'Ownership'}</Label>
                 <Select value={form.ownershipType} onValueChange={(v: any) => setForm({...form, ownershipType: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-black">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="owned" className="font-bold">{isRtl ? 'مملوكة للشركة' : 'Company Owned'}</SelectItem>
                       <SelectItem value="rented" className="font-bold text-orange-600">{isRtl ? 'معدات مستأجرة' : 'Rented'}</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* 2. Owned Assets Section (Financial & Depreciation) */}
      {isOwned && (
        <div className="space-y-8 animate-in slide-in-from-top-4">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-emerald-50/50 p-8 border-b">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-lg">
                       <TrendingDown className="h-6 w-6" />
                    </div>
                    <div>
                       <CardTitle className="text-xl font-black">{isRtl ? 'المعاملة المالية والإهلاك' : 'Asset Value & Depreciation'}</CardTitle>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Capital & Cost Recovery</p>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Purchase Cost (KWD)</Label>
                       <Input type="number" value={form.purchaseCost || ''} onChange={e => setForm({...form, purchaseCost: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Salvage Value (KWD)</Label>
                       <Input type="number" value={form.salvageValue || 1} onChange={e => setForm({...form, salvageValue: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black text-slate-400" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Depreciation Method</Label>
                       <Select value={form.depreciationMethod} onValueChange={(v: DepreciationMethod) => setForm({...form, depreciationMethod: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="hours" className="font-bold">ساعات التشغيل (KWD/HR)</SelectItem>
                             <SelectItem value="straight" className="font-bold">قسط ثابت (سنوي %)</SelectItem>
                             <SelectItem value="none" className="font-bold">لا يوجد إهلاك</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Calculator className="h-32 w-32" /></div>
                    <div className="space-y-4 flex-1 text-center md:text-start relative z-10">
                       <Label className="text-xs font-black uppercase text-primary tracking-widest">{isRtl ? 'تعرفة تكلفة الإهلاك بالساعة' : 'Internal Hourly Rate'}</Label>
                       <div className="flex items-center gap-4">
                          <Input 
                            type="number" step="0.001" 
                            value={form.hourlyDepreciationRate || ''} 
                            onChange={e => setForm({...form, hourlyDepreciationRate: Number(e.target.value)})}
                            className="h-16 rounded-2xl bg-white/10 border-0 text-3xl font-black text-emerald-400 text-center shadow-inner" 
                          />
                          <Button onClick={handleAutoCalculateRate} className="h-16 w-16 rounded-2xl bg-primary text-white shadow-xl hover:scale-105 transition-all"><RefreshCcw className="h-6 w-6" /></Button>
                       </div>
                    </div>
                    <div className="space-y-1 relative z-10 text-center md:text-end w-full md:w-64">
                       <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي ساعات العمل المتوقعة' : 'Total Expected Hours'}</Label>
                       <Input type="number" value={form.expectedTotalHours || ''} onChange={e => setForm({...form, expectedTotalHours: Number(e.target.value)})} className="h-10 rounded-lg bg-white/5 border-white/10 text-white font-black text-center" />
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-blue-50/30 p-8 border-b">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-lg">
                          <CreditCard className="h-6 w-6" />
                       </div>
                       <CardTitle className="text-xl font-black">{isRtl ? 'بيانات التمويل' : 'Financing & Installments'}</CardTitle>
                    </div>
                    <Switch checked={form.isFinanced} onCheckedChange={v => setForm({...form, isFinanced: v})} className="scale-125 data-[state=checked]:bg-primary" />
                 </div>
              </CardHeader>
              {form.isFinanced && (
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in-95">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'جهة التمويل' : 'Bank / Company'}</Label>
                      <Input value={form.financierName || ''} onChange={e => setForm({...form, financierName: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'القسط الشهري' : 'Monthly Installment'}</Label>
                      <Input type="number" value={form.monthlyInstallment || ''} onChange={e => setForm({...form, monthlyInstallment: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black text-emerald-600" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'يوم السداد' : 'Due Day'}</Label>
                      <Input type="number" min="1" max="31" value={form.installmentDay || 1} onChange={e => setForm({...form, installmentDay: Number(e.target.value)})} className="h-12 rounded-xl border-2 font-black text-center" />
                   </div>
                </CardContent>
              )}
           </Card>
        </div>
      )}

      {/* 3. Rented Assets Section */}
      {!isOwned && (
        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden animate-in slide-in-from-bottom-4">
           <CardHeader className="bg-orange-50/50 p-8 border-b">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-lg">
                    <Truck className="h-6 w-6" />
                 </div>
                 <div>
                    <CardTitle className="text-xl font-black">{isRtl ? 'بيانات الاستئجار الخارجي' : 'Rental Information'}</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">External Supply Details</p>
                 </div>
              </div>
           </CardHeader>
           <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المورد (شركة التأجير)' : 'Rental Supplier'}</Label>
                 <Select value={form.supplierId} onValueChange={v => {
                    const s = suppliers?.find(x => x.id === v);
                    setForm({...form, supplierId: v, supplierName: s?.name || ''});
                 }}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                       {suppliers?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50 rounded-[2.5rem] border-2 border-white shadow-inner">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'طريقة التكلفة' : 'Cost Basis'}</Label>
                    <Select value={form.costMethod} onValueChange={(v: RentalCostMethod) => setForm({...form, costMethod: v})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-black"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="hourly" className="font-bold">بالساعة (KWD/HR)</SelectItem>
                          <SelectItem value="daily" className="font-bold">يومي (KWD/Day)</SelectItem>
                          <SelectItem value="monthly" className="font-bold">شهري (KWD/Month)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'قيمة الاستئجار' : 'Rental Value'}</Label>
                    <Input type="number" step="0.001" value={form.costValue || ''} onChange={e => {
                       const val = Number(e.target.value);
                       let hrRate = val;
                       if (form.costMethod === 'daily') hrRate = val / 8;
                       if (form.costMethod === 'monthly') hrRate = val / 208; // 26 days * 8h
                       setForm({...form, costValue: val, hourlyRentalRate: Number(hrRate.toFixed(3))});
                    }} className="h-12 rounded-xl border-2 font-black text-xl text-orange-600" />
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      {/* Action Footer */}
      <div className="flex justify-end gap-4 pt-10">
         <Button variant="outline" onClick={() => window.history.back()} className="h-16 px-10 rounded-2xl font-black border-2 bg-white">إلغاء</Button>
         <Button 
           onClick={() => onSubmit(form)} 
           disabled={loading || !form.name || !form.code}
           className="h-16 px-20 rounded-2xl bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-4 border-b-8 border-orange-700"
         >
            {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
            {isRtl ? 'اعتماد وحفظ السجل' : 'Commit & Register'}
         </Button>
      </div>
    </div>
  );
}
