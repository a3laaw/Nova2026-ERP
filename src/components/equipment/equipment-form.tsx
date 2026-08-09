'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Save, Truck, Calculator, ShieldCheck, 
  LayoutGrid, Zap, HardHat, Wrench, Info, 
  Loader2, RefreshCw, Clock, Landmark, Banknote
} from "lucide-react";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Equipment, EquipmentCategory, ToolCondition } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { toast } from '@/hooks/use-toast';

interface Props {
  initialData?: Partial<Equipment>;
  onSubmit: (data: any) => void;
  loading: boolean;
  isRtl: boolean;
}

export function EquipmentForm({ initialData, onSubmit, loading, isRtl }: Props) {
  const { globalUser } = useAuthContext();
  const { t } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [form, setForm] = useState<any>({
    code: '', name: '', category: 'heavy_machinery', ownershipType: 'owned', 
    manufacturingYear: '', isActive: true, status: 'available', ...initialData
  });

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

  const isOwned = form.ownershipType === 'owned';

  return (
    <div className="space-y-6 text-start pb-10 animate-in fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-8 space-y-6">
            <Card className="rounded-lg shadow-sm border-slate-100 bg-white">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                     <LayoutGrid className="h-4 w-4" /> {t('equipment.form.identity')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.code')}</Label>
                        <Input value={form.code ?? ''} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="h-9 rounded-md border-slate-200 font-mono font-bold" />
                     </div>
                     <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.name')}</Label>
                        <Input value={form.name ?? ''} onChange={e => setForm({...form, name: e.target.value})} className="h-9 rounded-md border-slate-200 font-bold" />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">{t('category')}</Label>
                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                           <SelectTrigger className="h-9 text-xs font-medium"><SelectValue /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="heavy_machinery">{isRtl ? 'آليات ثقيلة' : 'Heavy Machinery'}</SelectItem>
                              <SelectItem value="vehicle">{isRtl ? 'مركبات' : 'Vehicles'}</SelectItem>
                              <SelectItem value="stationary">{isRtl ? 'ثابتة' : 'Stationary'}</SelectItem>
                              <SelectItem value="hand_tool">{isRtl ? 'أدوات يدوية' : 'Hand Tools'}</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                     <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">{t('equipment.form.isOwned')}</Label>
                        <Switch checked={isOwned} onCheckedChange={v => setForm({...form, ownershipType: v ? 'owned' : 'rented'})} />
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="rounded-lg shadow-sm border-slate-100 bg-white">
               <CardHeader className="bg-slate-50 p-4 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                     <Calculator className="h-4 w-4" /> {t('equipment.form.financials')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  {isOwned ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.purchasePrice')}</Label><Input type="number" value={form.purchaseCost ?? ''} onChange={e => setForm({...form, purchaseCost: e.target.value})} className="h-9 font-bold" /></div>
                       <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.salvageValue')}</Label><Input type="number" value={form.salvageValue ?? ''} onChange={e => setForm({...form, salvageValue: e.target.value})} className="h-9 font-bold" /></div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.hourlyRate')}</Label>
                          <div className="relative">
                             <Input type="number" step="0.001" value={form.hourlyDepreciationRate ?? ''} onChange={e => setForm({...form, hourlyDepreciationRate: e.target.value})} className="h-9 font-bold text-emerald-600 pe-8" />
                             <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black opacity-30">{t('dashboard.units.kwd')}</span>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.supplier')}</Label><Select value={form.supplierId} onValueChange={v => setForm({...form, supplierId: v})}><SelectTrigger className="h-9"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{suppliers?.map((s:any) => <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">{t('equipment.form.rentalRate')}</Label>
                          <div className="relative">
                             <Input type="number" step="0.001" value={form.hourlyRentalRate ?? ''} onChange={e => setForm({...form, hourlyRentalRate: e.target.value})} className="h-9 font-bold text-orange-600 pe-8" />
                             <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black opacity-30">{t('dashboard.units.kwd')}</span>
                          </div>
                       </div>
                    </div>
                  )}
               </CardContent>
            </Card>
         </div>

         <aside className="lg:col-span-4 space-y-6">
            <div className="flex flex-col gap-3">
               <Button onClick={() => onSubmit(form)} disabled={loading} className="w-full h-11 font-bold shadow-md">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-2" />} {t('common.save')}
               </Button>
               <Button variant="outline" onClick={() => window.history.back()} className="h-9 font-bold">{t('common.cancel')}</Button>
            </div>
         </aside>
      </div>
    </div>
  );
}
