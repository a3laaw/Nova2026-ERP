'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Info, CreditCard, TrendingDown, 
  Save, Truck, Calculator
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

  // تهيئة الحالة بقيم فارغة تماماً لضمان مظهر نقي (Pristine UI)
  const [form, setForm] = useState<any>({
    code: '', 
    name: '', 
    type: '', 
    ownershipType: 'owned', 
    purchaseCost: '', 
    salvageValue: '', 
    expectedTotalHours: '',
    depreciationMethod: 'hours', 
    isFinanced: false,
    hourlyRentalRate: '', 
    hourlyDepreciationRate: '', 
    status: 'available',
    isActive: true,
    financierName: '',
    monthlyInstallment: '',
    installmentDay: '',
    ...initialData
  });

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

  const isOwned = form.ownershipType === 'owned';

  return (
    <div className="space-y-8 text-start pb-20 animate-in fade-in duration-700 bg-white">
      
      {/* 1. Basic Info Section */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="bg-slate-50/30 p-8 border-b">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-slate-100">
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
                   className="h-12 rounded-xl border-2 font-mono font-black text-primary bg-white" 
                 />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم المعدة' : 'Equipment Name'}</Label>
                 <Input 
                   value={form.name} 
                   onChange={e => setForm({...form, name: e.target.value})} 
                   className="h-12 rounded-xl border-2 font-bold bg-white" 
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الملكية' : 'Ownership'}</Label>
                 <Select value={form.ownershipType} onValueChange={(v: any) => setForm({...form, ownershipType: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="owned" className="font-bold">{isRtl ? 'مملوكة' : 'Owned'}</SelectItem>
                       <SelectItem value="rented" className="font-bold text-orange-600">{isRtl ? 'مستأجرة' : 'Rented'}</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* 2. Owned Assets Section */}
      {isOwned && (
        <div className="space-y-8 animate-in slide-in-from-top-4">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-white p-8 border-b">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary shadow-sm border">
                       <Calculator className="h-6 w-6" />
                    </div>
                    <div>
                       <CardTitle className="text-xl font-black">{isRtl ? 'المعالجة المالية والإهلاك' : 'Financial Treatment'}</CardTitle>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Cost Recovery Basis</p>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Purchase Cost (KWD)</Label>
                       <Input type="number" value={form.purchaseCost} onChange={e => setForm({...form, purchaseCost: e.target.value})} className="h-12 rounded-xl border-2 font-black text-emerald-600 bg-white" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Salvage Value (KWD)</Label>
                       <Input type="number" value={form.salvageValue} onChange={e => setForm({...form, salvageValue: e.target.value})} className="h-12 rounded-xl border-2 font-black bg-white" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Depreciation Method</Label>
                       <Select value={form.depreciationMethod} onValueChange={(v: DepreciationMethod) => setForm({...form, depreciationMethod: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="hours" className="font-bold">ساعات التشغيل (KWD/HR)</SelectItem>
                             <SelectItem value="straight" className="font-bold">قسط ثابت (سنوي %)</SelectItem>
                             <SelectItem value="none" className="font-bold">لا يوجد إهلاك</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-100 shadow-inner">
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black uppercase text-primary tracking-widest">{isRtl ? 'تعرفة تكلفة الساعة' : 'Hourly Cost Rate'}</Label>
                       <Input 
                         type="number" step="0.001" 
                         value={form.hourlyDepreciationRate} 
                         onChange={e => setForm({...form, hourlyDepreciationRate: e.target.value})}
                         className="h-16 rounded-2xl border-2 bg-white text-3xl font-black text-emerald-600 text-center shadow-sm" 
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'إجمالي ساعات العمل المتوقعة' : 'Expected Lifespan (Hours)'}</Label>
                       <Input type="number" value={form.expectedTotalHours} onChange={e => setForm({...form, expectedTotalHours: e.target.value})} className="h-16 rounded-2xl border-2 bg-white text-2xl font-black text-center shadow-sm" />
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
              <CardHeader className="bg-white p-8 border-b">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="h-12 w-12 bg-blue-50/50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                          <CreditCard className="h-6 w-6" />
                       </div>
                       <CardTitle className="text-xl font-black">{isRtl ? 'بيانات التمويل' : 'Financing'}</CardTitle>
                    </div>
                    <Switch checked={form.isFinanced} onCheckedChange={v => setForm({...form, isFinanced: v})} className="scale-110" />
                 </div>
              </CardHeader>
              {form.isFinanced && (
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in-95">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'جهة التمويل' : 'Financier'}</Label>
                      <Input value={form.financierName} onChange={e => setForm({...form, financierName: e.target.value})} className="h-12 rounded-xl border-2 font-bold bg-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'القسط الشهري' : 'Installment'}</Label>
                      <Input type="number" value={form.monthlyInstallment} onChange={e => setForm({...form, monthlyInstallment: e.target.value})} className="h-12 rounded-xl border-2 font-black text-emerald-600 bg-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'يوم السداد' : 'Due Day'}</Label>
                      <Input type="number" min="1" max="31" value={form.installmentDay} onChange={e => setForm({...form, installmentDay: e.target.value})} className="h-12 rounded-xl border-2 font-black text-center bg-white" />
                   </div>
                </CardContent>
              )}
           </Card>
        </div>
      )}

      {/* 3. Rented Assets Section */}
      {!isOwned && (
        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden animate-in slide-in-from-bottom-4">
           <CardHeader className="bg-orange-50/20 p-8 border-b">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-sm border">
                    <Truck className="h-6 w-6" />
                 </div>
                 <div>
                    <CardTitle className="text-xl font-black">{isRtl ? 'بيانات الاستئجار' : 'Rental Info'}</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Vendor & Rate</p>
                 </div>
              </div>
           </CardHeader>
           <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المورد' : 'Supplier'}</Label>
                 <Select value={form.supplierId} onValueChange={v => {
                    const s = suppliers?.find(x => x.id === v);
                    setForm({...form, supplierId: v, supplierName: s?.name || ''});
                 }}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                       {suppliers?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-100 shadow-inner">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'طريقة التكلفة' : 'Rate Basis'}</Label>
                    <Select value={form.costMethod} onValueChange={(v: RentalCostMethod) => setForm({...form, costMethod: v})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="hourly" className="font-bold">بالساعة (KWD/HR)</SelectItem>
                          <SelectItem value="daily" className="font-bold">يومي (KWD/Day)</SelectItem>
                          <SelectItem value="monthly" className="font-bold">شهري (KWD/Month)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'قيمة الاستئجار' : 'Rate Value'}</Label>
                    <Input type="number" step="0.001" value={form.costValue} onChange={e => setForm({...form, costValue: e.target.value})} className="h-12 rounded-xl border-2 font-black text-xl text-orange-600 bg-white" />
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      {/* Action Footer */}
      <div className="flex justify-end gap-4 pt-10 px-4">
         <Button variant="outline" onClick={() => window.history.back()} className="h-14 px-10 rounded-2xl font-black border-2 bg-white text-slate-600">إلغاء</Button>
         <button 
           type="button"
           onClick={() => onSubmit(form)} 
           disabled={loading || !form.name || !form.code}
           className="h-14 px-20 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 border-b-4 border-orange-700"
         >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
            {isRtl ? 'اعتماد وحفظ' : 'Confirm & Save'}
         </button>
      </div>
    </div>
  );
}