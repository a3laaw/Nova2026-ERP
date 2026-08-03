'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Info, CreditCard, Save, Truck, 
  Calculator, ShieldCheck, FileText, 
  MapPin, Gavel, AlertTriangle, Key,
  LayoutGrid
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Equipment, EquipmentCategory, InsuranceType } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { SmartDateInput } from '@/components/ui/smart-date-input';

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

  const [form, setForm] = useState<any>({
    code: '', 
    name: '', 
    category: 'heavy_machinery', 
    ownershipType: 'owned', 
    isLicensed: false,
    chassisNumber: '',
    plateNumber: '',
    registrationExpiry: '',
    insuranceType: 'none',
    insuranceCompany: '',
    insuranceExpiry: '',
    purchaseCost: '', 
    salvageValue: '', 
    depreciationMethod: 'hours', 
    isFinanced: false,
    status: 'available',
    isActive: true,
    ...initialData
  });

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

  const isOwned = form.ownershipType === 'owned';
  const canBeLicensed = ['heavy_machinery', 'vehicle', 'stationary'].includes(form.category);
  const showAdminSection = isOwned && canBeLicensed && form.isLicensed;

  return (
    <div className="space-y-8 text-start pb-20 animate-in fade-in duration-700 bg-transparent">
      
      {/* 1. Basic Identity Section */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="bg-primary/5 p-8 border-b">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                 <LayoutGrid className="h-6 w-6" />
              </div>
              <div>
                 <CardTitle className="text-xl font-black">{isRtl ? 'الهوية والنوع' : 'Identity & Category'}</CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Global Asset Classification</p>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Code</Label>
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
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تصنيف المعدة' : 'Category'}</Label>
                 <Select value={form.category} onValueChange={(v: EquipmentCategory) => setForm({...form, category: v, isLicensed: ['heavy_machinery', 'vehicle'].includes(v)})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                       <SelectItem value="heavy_machinery" className="font-bold">آليات ثقيلة (حفار/جرافة)</SelectItem>
                       <SelectItem value="vehicle" className="font-bold">مركبات (سيارات/شاحنات)</SelectItem>
                       <SelectItem value="stationary" className="font-bold">معدات ثابتة (مولدات)</SelectItem>
                       <SelectItem value="hand_tool" className="font-bold">أدوات يدوية (صاروخ/دريل)</SelectItem>
                       <SelectItem value="other" className="font-bold">أخرى</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* 2. Ownership & Financing Section */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="bg-white p-8 border-b">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-start">
                 <div className="h-12 w-12 bg-blue-50/50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                    <ShieldCheck className="h-6 w-6" />
                 </div>
                 <div>
                    <CardTitle className="text-xl font-black">{isRtl ? 'الملكية والترخيص' : 'Ownership & Licensing'}</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Legal Possession Status</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 px-6 py-2 rounded-2xl border-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'مملوكة' : 'Owned'}</Label>
                 <Switch checked={isOwned} onCheckedChange={v => setForm({...form, ownershipType: v ? 'owned' : 'rented'})} />
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-start">
              {isOwned ? (
                 <div className="flex items-center justify-between p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/10">
                    <div className="space-y-1">
                       <Label className="font-black text-sm text-slate-800">{isRtl ? 'هل المعدة ممولة (أقساط)؟' : 'Is it Financed?'}</Label>
                       <p className="text-[9px] text-slate-400 font-bold uppercase">Linked to Bank/Finance Co.</p>
                    </div>
                    <Switch checked={form.isFinanced} onCheckedChange={v => setForm({...form, isFinanced: v})} />
                 </div>
              ) : (
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المورد المؤجر' : 'Renting Supplier'}</Label>
                    <Select value={form.supplierId} onValueChange={v => {
                       const s = suppliers?.find((x:any) => x.id === v);
                       setForm({...form, supplierId: v, supplierName: s?.name || ''});
                    }}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                       <SelectContent>{suppliers?.map((s:any) => <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              )}

              {isOwned && canBeLicensed && (
                 <div className="flex items-center justify-between p-6 bg-blue-50/30 rounded-[2rem] border-2 border-blue-100">
                    <div className="space-y-1">
                       <Label className="font-black text-sm text-slate-800">{isRtl ? 'مركبة مرور / ترخيص رسمي' : 'Licensed Vehicle'}</Label>
                       <p className="text-[9px] text-slate-400 font-bold uppercase">Requires Plate & Insurance</p>
                    </div>
                    <Switch checked={form.isLicensed} onCheckedChange={v => setForm({...form, isLicensed: v})} />
                 </div>
              )}
           </div>

           {form.isFinanced && isOwned && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-slate-50/50 rounded-[2rem] border-2 border-white shadow-inner animate-in zoom-in-95 text-start">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Financier</Label>
                    <Input value={form.financierName} onChange={e => setForm({...form, financierName: e.target.value})} className="h-11 rounded-xl border-2 bg-white" placeholder={isRtl ? "البنك أو شركة التمويل" : "Bank Name"} />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Installment (KWD)</Label>
                    <Input type="number" value={form.monthlyInstallment} onChange={e => setForm({...form, monthlyInstallment: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-black text-emerald-600" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Due Day</Label>
                    <Input type="number" min="1" max="31" value={form.installmentDay} onChange={e => setForm({...form, installmentDay: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-black text-center" />
                 </div>
              </div>
           )}
        </CardContent>
      </Card>

      {/* 3. Administrative & Licensing Section (Conditional) */}
      {showAdminSection && (
        <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-top-4 duration-500">
           <CardHeader className="bg-slate-50/80 p-8 border-b">
              <div className="flex items-center gap-4 text-start">
                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                    <Gavel className="h-6 w-6" />
                 </div>
                 <div>
                    <CardTitle className="text-xl font-black">{isRtl ? 'البيانات الإدارية والتراخيص' : 'Admin & Licensing'}</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Traffic Dept & Insurance Compliance</p>
                 </div>
              </div>
           </CardHeader>
           <CardContent className="p-8 space-y-10 text-start">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Chassis / VIN</Label>
                    <Input value={form.chassisNumber} onChange={e => setForm({...form, chassisNumber: e.target.value})} className="h-12 rounded-xl border-2 font-mono font-bold bg-white" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'رقم اللوحة / الدفتر' : 'Plate Number'}</Label>
                    <Input value={form.plateNumber} onChange={e => setForm({...form, plateNumber: e.target.value})} className="h-12 rounded-xl border-2 font-black bg-white" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'انتهاء الدفتر' : 'Reg Expiry'}</Label>
                    <SmartDateInput value={form.registrationExpiry} onChange={v => setForm({...form, registrationExpiry: v})} />
                 </div>
              </div>

              <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نوع التأمين' : 'Insurance Type'}</Label>
                    <Select value={form.insuranceType} onValueChange={(v: InsuranceType) => setForm({...form, insuranceType: v})}>
                       <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="none" className="font-bold">بدون تأمين</SelectItem>
                          <SelectItem value="third_party" className="font-bold">ضد الغير (TPL)</SelectItem>
                          <SelectItem value="comprehensive" className="font-bold text-primary">تأمين شامل (Full)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'شركة التأمين' : 'Insurance Company'}</Label>
                    <Input value={form.insuranceCompany} onChange={e => setForm({...form, insuranceCompany: e.target.value})} className="h-12 rounded-xl border-2 font-bold bg-white" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'انتهاء التأمين' : 'Ins Expiry'}</Label>
                    <SmartDateInput value={form.insuranceExpiry} onChange={v => setForm({...form, insuranceExpiry: v})} />
                 </div>
              </div>

              <div className="bg-blue-50/50 p-6 rounded-3xl border-2 border-dashed border-blue-100 flex items-start gap-4">
                 <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-blue-700 font-bold leading-relaxed italic">
                    {isRtl ? 'سيقوم النظام تلقائياً بتفعيل تنبيهات انتهاء التراخيص والتأمين قبل 30 يوماً من الموعد لضمان استمرارية التشغيل.' : 'System will auto-trigger expiry alerts 30 days prior to dates to ensure operational continuity.'}
                 </p>
              </div>
           </CardContent>
        </Card>
      )}

      {/* 4. Financial & Operating Section */}
      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 p-8 border-b">
           <div className="flex items-center gap-4 text-start">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                 <Calculator className="h-6 w-6" />
              </div>
              <div>
                 <CardTitle className="text-xl font-black">{isRtl ? 'المعالجة المالية والتشغيلية' : 'Finance & Operations'}</CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Cost Recovery Metrics</p>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8 text-start">
           {isOwned ? (
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
                   <Label className="text-[10px] font-black uppercase text-slate-400">Operating Rate (KWD/HR)</Label>
                   <Input type="number" step="0.001" value={form.hourlyDepreciationRate} onChange={e => setForm({...form, hourlyDepreciationRate: e.target.value})} className="h-12 rounded-xl border-2 font-black text-primary bg-white" />
                </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner text-start">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">Rental Rate Basis</Label>
                   <Select value={form.costMethod} onValueChange={(v: any) => setForm({...form, costMethod: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="hourly" className="font-bold">بالساعة (KWD/HR)</SelectItem>
                         <SelectItem value="daily" className="font-bold">يومي (KWD/Day)</SelectItem>
                         <SelectItem value="monthly" className="font-bold">شهري (KWD/Month)</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">Rental Value</Label>
                   <Input type="number" step="0.001" value={form.costValue} onChange={e => setForm({...form, costValue: e.target.value})} className="h-12 rounded-xl border-2 font-black text-xl text-orange-600 bg-white" />
                </div>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-4 pt-10 px-4">
         <Button variant="outline" onClick={() => window.history.back()} className="h-14 px-10 rounded-[1.5rem] font-bold border-2 bg-white text-slate-600">إلغاء</Button>
         <button 
           type="button"
           onClick={() => {
              if (showAdminSection && !form.chassisNumber) {
                 toast({ variant: "destructive", title: isRtl ? "تنبيه" : "Alert", description: isRtl ? "يرجى إكمال بيانات الترخيص أو تعطيل خيار الترخيص" : "Please complete license data" });
                 return;
              }
              onSubmit(form);
           }} 
           disabled={loading || !form.name || !form.code}
           className="h-14 px-24 rounded-[1.5rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 border-b-8 border-orange-700"
         >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
            {isRtl ? 'اعتماد وحفظ الأصل' : 'Commit Asset'}
         </button>
      </div>
    </div>
  );
}
