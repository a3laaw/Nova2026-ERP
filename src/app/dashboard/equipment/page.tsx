'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, 
  Trash2, Edit3, Clock, Calculator,
  Building2, Save, X, Filter,
  ArrowRight, CheckCircle2, AlertTriangle,
  Sparkles, PlusCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { EquipmentService } from '@/services/equipment-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function EquipmentPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isNewRentedOpen, setIsNewRentedOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State for Rented Equipment
  const [rentedForm, setRentedForm] = useState({
    code: '',
    name: '',
    supplierId: '',
    supplierName: '',
    costMethod: 'hourly' as any,
    costValue: 0
  });

  const equipQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: equipment, loading: equipLoading } = useCollection<Equipment>(equipQuery);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

  const handleCreateRented = async () => {
    if (!db || !companyId || !user || !rentedForm.name || !rentedForm.supplierId) {
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Data" });
      return;
    }

    setLoading(true);
    try {
      const service = new EquipmentService(db, companyId);
      const supplier = suppliers.find(s => s.id === rentedForm.supplierId);
      
      await service.createRentedEquipment({
        ...rentedForm,
        supplierName: supplier?.name || ''
      }, user.uid);

      toast({ title: isRtl ? "تمت إضافة المعدة بنجاح" : "Rented Equipment Added" });
      setIsNewRentedOpen(false);
      setRentedForm({ code: '', name: '', supplierId: '', supplierName: '', costMethod: 'hourly', costValue: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return (equipment || []).filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [equipment, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Truck className="h-8 w-8 text-primary" />
            {isRtl ? 'سجل المعدات والآليات' : 'Equipment Registry'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة وتتبع المعدات المستأجرة وتكاليف التشغيل الميدانية.' : 'Manage and track rented equipment and field operating costs.'}
          </p>
        </div>
        <Button 
          onClick={() => setIsNewRentedOpen(true)} 
          className="h-12 px-8 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2 border-b-4 border-orange-700"
        >
           <Plus className="h-5 w-5" /> {isRtl ? 'إضافة معدة مؤجرة' : 'Add Rented Item'}
        </Button>
      </header>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث بالكود أو الاسم...' : 'Search equipment...'} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-slate-200 font-bold">
             <Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </div>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المعدة / الكود' : 'Equipment / Code'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المورد / المؤجر' : 'Supplier'}</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">{isRtl ? 'طريقة التكلفة' : 'Cost Basis'}</TableHead>
                <TableHead className="text-end font-black uppercase text-[10px] tracking-widest">{isRtl ? 'القيمة' : 'Rate'}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-bold italic">{isRtl ? 'لا يوجد معدات مسجلة.' : 'No equipment found.'}</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-primary/[0.01] transition-colors border-b-slate-100">
                    <TableCell className="ps-10 py-6 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                             <Truck className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-lg leading-none">{item.name}</span>
                             <span className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest font-mono">#{item.code}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs font-bold text-slate-600">{item.supplierName}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="font-black text-[9px] uppercase px-3 py-1 bg-white border-slate-200">
                          {item.costMethod}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-emerald-600 text-lg pe-10">
                       {item.costValue?.toLocaleString()} <span className="text-[8px] text-slate-300 ms-1">KWD</span>
                    </TableCell>
                    <TableCell className="pe-10 text-end">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-9 w-9">
                          <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rented Equipment Glassmorphism Modal */}
      <Dialog open={isNewRentedOpen} onOpenChange={setIsNewRentedOpen}>
         <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white/70 backdrop-blur-2xl ring-1 ring-white/50" dir={dir}>
            <div className="bg-primary/10 p-8 text-slate-900 text-start border-b border-white/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5"><Sparkles className="h-40 w-40 text-primary" /></div>
               <div className="flex items-center gap-4 relative z-10">
                  <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 ring-4 ring-white/50">
                     <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                     <DialogTitle className="text-2xl font-black font-headline text-slate-900">{isRtl ? 'إضافة معدة مؤجرة' : 'Add Rented Equipment'}</DialogTitle>
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Quick Asset Registration</p>
                  </div>
               </div>
            </div>

            <div className="p-10 space-y-8 text-start bg-transparent">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'كود المعدة' : 'Equipment Code'}</Label>
                     <Input 
                       value={rentedForm.code} 
                       onChange={e => setRentedForm({...rentedForm, code: e.target.value.toUpperCase()})}
                       placeholder="EQ-R-001" 
                       className="h-12 rounded-xl border-2 font-mono font-black text-primary bg-white/50 focus:bg-white transition-all shadow-inner" 
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم المعدة' : 'Equipment Name'}</Label>
                     <Input 
                       value={rentedForm.name} 
                       onChange={e => setRentedForm({...rentedForm, name: e.target.value})}
                       placeholder={isRtl ? "مثلاً: بوكات" : "e.g. Bobcat"} 
                       className="h-12 rounded-xl border-2 font-bold bg-white/50 focus:bg-white transition-all shadow-inner" 
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'المورد / شركة التأجير' : 'Rental Supplier'}</Label>
                  <Select value={rentedForm.supplierId} onValueChange={v => setRentedForm({...rentedForm, supplierId: v})}>
                     <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-white/50">
                        <SelectValue placeholder={isRtl ? "اختر المورد..." : "Select supplier..."} />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-2 shadow-2xl">
                        {suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-white/40 rounded-[2rem] border-2 border-white/60 shadow-inner">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'طريقة التكلفة' : 'Cost Method'}</Label>
                     <Select value={rentedForm.costMethod} onValueChange={v => setRentedForm({...rentedForm, costMethod: v})}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                           <SelectItem value="hourly" className="font-bold">{isRtl ? 'بالساعة KWD/HR' : 'Hourly'}</SelectItem>
                           <SelectItem value="daily" className="font-bold">{isRtl ? 'يومي KWD/Day' : 'Daily'}</SelectItem>
                           <SelectItem value="monthly" className="font-bold">{isRtl ? 'شهري KWD/Month' : 'Monthly'}</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'قيمة التكلفة (KWD)' : 'Cost Value'}</Label>
                     <div className="relative">
                        <Input 
                           type="number" 
                           step="0.001"
                           value={rentedForm.costValue || ''} 
                           onChange={e => setRentedForm({...rentedForm, costValue: Number(e.target.value)})}
                           className="h-12 rounded-xl border-2 font-black text-emerald-600 text-xl text-center bg-white shadow-inner" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300">KWD</span>
                     </div>
                  </div>
               </div>
            </div>

            <DialogFooter className="p-8 bg-white/50 border-t border-white/20 shrink-0">
               <Button variant="outline" onClick={() => setIsNewRentedOpen(false)} className="flex-1 h-14 rounded-2xl font-bold bg-white/50 border-2">إلغاء</Button>
               <Button onClick={handleCreateRented} disabled={loading} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 transition-all border-b-8 border-orange-700 hover:scale-[1.02] active:scale-95">
                  {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6 me-2" />}
                  {isRtl ? 'اعتماد الإضافة' : 'Confirm & Save'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
