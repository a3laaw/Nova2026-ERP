'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, 
  Edit3, Trash2, Settings2,
  Calculator, Save, CheckCircle2, 
  Link as LinkIcon, RefreshCcw,
  Calendar, CreditCard, Banknote,
  TrendingDown, Hammer, AlertTriangle,
  ArrowRight, Filter, Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Equipment, EquipmentStatus, DepreciationMethod } from '@/types/equipment';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SmartDateInput } from "@/components/ui/smart-date-input";

export default function EquipmentMasterPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isAssigning, setIsAssigning] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<Equipment>>({
    code: '', name: '', type: '', ownershipType: 'owned', 
    purchaseCost: 0, salvageValue: 1, 
    depreciationMethod: 'hours', isFinanced: false,
    hourlyRentalRate: 0, hourlyDepreciationRate: 0, status: 'available'
  });

  const [assignForm, setAssignForm] = useState({ projectId: '', fromDate: new Date().toISOString().split('T')[0] });

  const equipQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.equipment(companyId)), orderBy('code')) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: equipment, loading: equipLoading } = useCollection<Equipment>(equipQuery);
  const { data: projects } = useCollection<any>(projectsQuery);

  const equipmentService = useMemo(() => db && companyId ? new EquipmentService(db, companyId) : null, [db, companyId]);

  const handleAutoCalculateRate = () => {
    const cost = Number(form.purchaseCost) || 0;
    const salvage = Number(form.salvageValue) || 0;
    const hours = Number(form.expectedTotalHours) || 0;

    if (hours > 0) {
      const rate = (cost - salvage) / hours;
      setForm({ ...form, hourlyDepreciationRate: Number(rate.toFixed(3)) });
      toast({ title: isRtl ? "تم احتساب التعرفة تلقائياً" : "Rate calculated" });
    } else {
      toast({ variant: "destructive", title: isRtl ? "يرجى إدخال إجمالي الساعات" : "Enter total hours first" });
    }
  };

  const handleSave = async () => {
    if (!equipmentService || !user || !form.name || !form.code) return;
    
    // Validation for Owned Equipment
    if (form.ownershipType === 'owned' && form.depreciationMethod === 'hours' && !form.hourlyDepreciationRate) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "تنبيه محاسبي" : "Accounting Alert", 
        description: isRtl ? "يجب إدخال معدل الإهلاك لضمان دقة تكاليف المشاريع." : "Hourly rate is required for cost accuracy." 
      });
      return;
    }

    setLoading(true);
    try {
      if (form.id) {
        await equipmentService.updateEquipment(form.id, form, user.uid);
      } else {
        await equipmentService.createEquipment(form, user.uid);
      }
      toast({ title: t('saved') });
      setIsAdding(false);
      resetForm();
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ 
      code: '', name: '', type: '', ownershipType: 'owned', 
      purchaseCost: 0, salvageValue: 1, 
      depreciationMethod: 'hours', isFinanced: false,
      hourlyRentalRate: 0, hourlyDepreciationRate: 0 
    });
  };

  const handleAssign = async () => {
    if (!equipmentService || !user || !isAssigning || !assignForm.projectId) return;
    setLoading(true);
    try {
      const proj = projects?.find(p => p.id === assignForm.projectId);
      await equipmentService.assignToProject(
        isAssigning.id, 
        isAssigning.name, 
        assignForm.projectId, 
        proj?.subServiceName || 'Project', 
        assignForm.fromDate, 
        user.uid,
        globalUser?.fullName || 'Admin'
      );
      toast({ title: isRtl ? "تم تخصيص المعدة للمشروع" : "Equipment Assigned" });
      setIsAssigning(null);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (equip: Equipment) => {
    if (!equipmentService || !user) return;
    if (!confirm(isRtl ? "تأكيد تحرير المعدة وإعادتها للمخزن؟" : "Confirm equipment release?")) return;
    setLoading(true);
    try {
      await equipmentService.releaseFromProject(equip.id, new Date().toISOString().split('T')[0], user.uid);
      toast({ title: isRtl ? "تم تحرير المعدة" : "Equipment Released" });
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
            {isRtl ? 'سجل المعدات والآليات' : 'Equipment Master'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة الأصول التشغيلية، تتبع التخصيص، والتحليل المحاسبي للإهلاك.' : 'Manage operational assets, track assignments, and depreciation analysis.'}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsAdding(true); }} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700">
           <Plus className="h-5 w-5" /> {isRtl ? 'إضافة معدة جديدة' : 'Add New Equipment'}
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
          <Button variant="outline" className="h-11 px-6 border-slate-200">
             <Filter className="h-4 w-4 me-2 text-primary" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </div>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المعدة / الكود' : 'Equipment / Code'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'النوع والملكية' : 'Type & Ownership'}</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">{isRtl ? 'تعرفة الساعة' : 'Hourly Rate'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة والمشروع' : 'Status & Project'}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-300 font-bold italic">{isRtl ? 'لا يوجد معدات مسجلة.' : 'No equipment found.'}</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-primary/[0.01] transition-colors border-b-slate-100">
                    <TableCell className="ps-10 py-6 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                             <Hammer className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-lg leading-none">{item.name}</span>
                             <span className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest font-mono">#{item.code}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-slate-600">{item.type}</span>
                          <Badge variant="outline" className={cn(
                            "w-fit text-[8px] font-black uppercase bg-white",
                            item.ownershipType === 'owned' ? "text-blue-600 border-blue-100" : "text-orange-600 border-orange-100"
                          )}>
                             {item.ownershipType}
                          </Badge>
                       </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-emerald-600 text-lg">
                       {item.ownershipType === 'owned' ? item.hourlyDepreciationRate : item.hourlyRentalRate}
                       <span className="text-[8px] text-slate-300 ms-1">KWD</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="space-y-1.5">
                          <Badge className={cn(
                            "font-black px-3 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                            item.status === 'available' ? 'bg-emerald-50 text-emerald-600' :
                            item.status === 'in_use' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                          )}>
                             {item.status}
                          </Badge>
                          {item.currentProjectId && (
                            <p className="text-[9px] font-bold text-primary flex items-center gap-1">
                               <LinkIcon className="h-2 w-2" /> {item.currentProjectName}
                            </p>
                          )}
                       </div>
                    </TableCell>
                    <TableCell className="pe-10 text-end">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.status === 'available' ? (
                            <Button size="sm" variant="outline" onClick={() => setIsAssigning(item)} className="h-8 rounded-lg text-[9px] font-black gap-1.5 bg-blue-50 text-blue-600 border-blue-100">
                               <LinkIcon className="h-3 w-3" /> {isRtl ? 'تخصيص' : 'Assign'}
                            </Button>
                          ) : item.status === 'in_use' && (
                            <Button size="sm" variant="outline" onClick={() => handleRelease(item)} className="h-8 rounded-lg text-[9px] font-black gap-1.5 bg-orange-50 text-orange-600 border-orange-100">
                               <RefreshCcw className="h-3 w-3" /> {isRtl ? 'تحرير' : 'Release'}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600" onClick={() => { setForm(item); setIsAdding(true); }}>
                             <Edit3 className="h-4 w-4" />
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Glassmorphism Modal for Add/Edit */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white/80 backdrop-blur-2xl max-w-4xl flex flex-col h-fit max-h-[95vh] border-white/40 ring-1 ring-black/5" dir={dir}>
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-8 text-slate-900 text-start border-b border-white/20 shrink-0">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <Settings2 className="h-8 w-8 text-primary" />
                  {form.id ? (isRtl ? 'تعديل بيانات المعدة' : 'Edit Equipment') : (isRtl ? 'إضافة معدة جديدة' : 'Add New Equipment')}
               </DialogTitle>
               <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{isRtl ? 'إدارة الأصول الهندسية والمالية' : 'Engineering Asset Management'}</p>
            </div>

            <div className="p-8 space-y-10 text-start overflow-y-auto scrollbar-hide">
               {/* 1. Basic Info Section */}
               <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                     <Info className="h-4 w-4" />
                     <h4 className="text-xs font-black uppercase tracking-widest">{isRtl ? 'البيانات الأساسية' : 'Basic Information'}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">Code</Label>
                       <Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="h-11 rounded-xl border-2 font-mono font-black" placeholder="EQP-0000" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اسم المعدة' : 'Name'}</Label>
                       <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 rounded-xl border-2 font-bold" placeholder={isRtl ? "مثلاً: حفار كوماتسو" : "e.g. Komatsu Excavator"} />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'النوع' : 'Type'}</Label>
                       <Input value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ الشراء / بدء التشغيل' : 'Start Date'}</Label>
                       <SmartDateInput value={form.purchaseDate || ''} onChange={v => setForm({...form, purchaseDate: v})} />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'رقم اللوحة' : 'Plate Number'}</Label>
                       <Input value={form.plateNumber || ''} onChange={e => setForm({...form, plateNumber: e.target.value})} className="h-11 rounded-xl border-2 font-bold" />
                    </div>
                  </div>
               </section>

               {/* 2. Ownership & Financing Section */}
               <section className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-primary">
                     <CreditCard className="h-4 w-4" />
                     <h4 className="text-xs font-black uppercase tracking-widest">{isRtl ? 'الملكية والتمويل' : 'Ownership & Financing'}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نوع الملكية' : 'Ownership Type'}</Label>
                        <Select value={form.ownershipType} onValueChange={(v: any) => setForm({...form, ownershipType: v})}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white shadow-sm">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-2 shadow-2xl">
                              <SelectItem value="owned" className="font-bold">{isRtl ? 'مملوكة للمنشأة' : 'Owned'}</SelectItem>
                              <SelectItem value="rented" className="font-bold">{isRtl ? 'مستأجرة من الغير' : 'Rented'}</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>

                     {form.ownershipType === 'owned' && (
                        <div className="p-5 rounded-2xl bg-primary/5 border-2 border-primary/10 flex items-center justify-between group animate-in slide-in-from-left-2">
                           <div className="space-y-0.5">
                              <Label className="font-black text-xs uppercase text-primary">{isRtl ? 'معدة ممولة / أقساط' : 'Financed / Installments'}</Label>
                              <p className="text-[9px] font-bold text-slate-400">{isRtl ? 'تفعيل في حال وجود أقساط بنكية' : 'Enable for monthly installments'}</p>
                           </div>
                           <Switch checked={form.isFinanced} onCheckedChange={v => setForm({...form, isFinanced: v})} />
                        </div>
                     )}
                  </div>

                  {form.ownershipType === 'owned' && form.isFinanced && (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50/50 rounded-[2rem] border-2 border-white shadow-inner animate-in zoom-in-95">
                        <div className="space-y-1.5">
                           <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'جهة التمويل' : 'Financier'}</Label>
                           <Input value={form.financierName || ''} onChange={e => setForm({...form, financierName: e.target.value})} className="h-10 rounded-lg bg-white font-bold" />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'القسط الشهري' : 'Monthly Payment'}</Label>
                           <Input type="number" value={form.monthlyInstallment || 0} onChange={e => setForm({...form, monthlyInstallment: Number(e.target.value)})} className="h-10 rounded-lg bg-white font-black text-emerald-600" />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'يوم استحقاق القسط' : 'Due Day'}</Label>
                           <Input type="number" min="1" max="31" value={form.installmentDay || 1} onChange={e => setForm({...form, installmentDay: Number(e.target.value)})} className="h-10 rounded-lg bg-white font-black text-center" />
                        </div>
                     </div>
                  )}
               </section>

               {/* 3. Financial & Depreciation Section */}
               {form.ownershipType === 'owned' && (
                 <section className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-primary">
                       <TrendingDown className="h-4 w-4" />
                       <h4 className="text-xs font-black uppercase tracking-widest">{isRtl ? 'المعالجة المالية والإهلاك' : 'Depreciation & Valuation'}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'سعر شراء الأصل' : 'Purchase Cost'}</Label>
                                <Input type="number" value={form.purchaseCost} onChange={e => setForm({...form, purchaseCost: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black text-base" />
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'القيمة التخريدية (الخردة)' : 'Salvage Value'}</Label>
                                <Input type="number" value={form.salvageValue} onChange={e => setForm({...form, salvageValue: Number(e.target.value)})} className="h-11 rounded-xl border-2 font-black text-base" />
                             </div>
                          </div>
                          <div className="space-y-1.5">
                             <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'طريقة احتساب الإهلاك' : 'Depreciation Method'}</Label>
                             <Select value={form.depreciationMethod} onValueChange={(v: any) => setForm({...form, depreciationMethod: v})}>
                                <SelectTrigger className="h-11 rounded-xl border-2 font-bold bg-white">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-2xl">
                                   <SelectItem value="hours" className="font-bold">{isRtl ? 'ساعات التشغيل (KWD/HR)' : 'Operating Hours'}</SelectItem>
                                   <SelectItem value="straight" className="font-bold">{isRtl ? 'قسط ثابت (سنوي %)' : 'Straight Line'}</SelectItem>
                                   <SelectItem value="none" className="font-bold text-slate-400">{isRtl ? 'لا يوجد إهلاك' : 'None'}</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                       </div>

                       <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-8 opacity-5"><Calculator className="h-24 w-24" /></div>
                          <div className="relative z-10 space-y-4">
                             <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Clock className="h-4 w-4" /> {isRtl ? 'معدل الإهلاك المعتمد بالساعة' : 'Hourly Depreciation Rate'}
                             </Label>
                             <div className="flex gap-2">
                                <div className="relative flex-1">
                                   <Input 
                                      type="number" 
                                      step="0.001" 
                                      value={form.hourlyDepreciationRate || ''} 
                                      onChange={e => setForm({...form, hourlyDepreciationRate: e.target.value === '' ? undefined : Number(e.target.value)})} 
                                      className="h-14 rounded-2xl bg-white/10 border-0 text-3xl font-black text-emerald-400 text-center shadow-inner"
                                      placeholder="0.000"
                                   />
                                   <span className="absolute right-4 bottom-4 text-[9px] font-black text-slate-500 uppercase">KWD / HR</span>
                                </div>
                                <Button 
                                  type="button"
                                  onClick={handleAutoCalculateRate}
                                  className="h-14 w-14 rounded-2xl bg-white/10 hover:bg-primary transition-all border-0 shadow-lg shrink-0"
                                  title={isRtl ? "حساب تلقائي 🧮" : "Auto Calc"}
                                >
                                   <RefreshCcw className="h-6 w-6" />
                                </Button>
                             </div>
                             
                             <div className="pt-4 border-t border-white/5 space-y-2">
                                <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي الساعات المتوقعة للمعايرة' : 'Expected Lifetime Hours'}</Label>
                                <Input 
                                   type="number" 
                                   value={form.expectedTotalHours || ''} 
                                   onChange={e => setForm({...form, expectedTotalHours: Number(e.target.value)})} 
                                   className="h-9 rounded-lg bg-white/5 border-white/10 text-white font-mono text-center font-black"
                                   placeholder="..."
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                 </section>
               )}

               {/* Rented Equipment Price Section */}
               {form.ownershipType === 'rented' && (
                 <section className="p-8 rounded-[2.5rem] bg-orange-600 text-white shadow-2xl relative overflow-hidden animate-in zoom-in-95">
                    <div className="absolute top-0 right-0 p-8 opacity-10"><Banknote className="h-32 w-32" /></div>
                    <div className="relative z-10 space-y-4 text-center">
                       <Label className="text-sm font-black uppercase tracking-[0.2em] text-orange-200">{isRtl ? 'تعرفة الإيجار بالساعة' : 'Hourly Rental Rate'}</Label>
                       <div className="relative max-w-xs mx-auto">
                          <Input 
                             type="number" 
                             step="0.001" 
                             value={form.hourlyRentalRate} 
                             onChange={e => setForm({...form, hourlyRentalRate: Number(e.target.value)})} 
                             className="h-20 rounded-3xl bg-white border-0 text-5xl font-black text-orange-600 text-center shadow-inner" 
                          />
                          <span className="absolute right-4 bottom-4 text-xs font-black text-slate-300">KWD / HR</span>
                       </div>
                       <p className="text-[10px] font-bold text-orange-100 opacity-70 italic">{isRtl ? 'سيتم استخدام هذه التعرفة عند ربط المعدة بسجل إنجاز ميداني.' : 'This rate will be used for field execution cost calculation.'}</p>
                    </div>
                 </section>
               )}
            </div>

            <DialogFooter className="p-8 bg-slate-50/50 backdrop-blur-xl border-t border-white/20 shrink-0">
               <Button variant="outline" onClick={() => setIsAdding(false)} className="rounded-2xl h-16 px-10 font-bold border-2 bg-white">
                  {isRtl ? 'إلغاء' : 'Cancel'}
               </Button>
               <Button onClick={handleSave} disabled={loading} className="flex-1 h-16 rounded-2xl bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 transition-all border-b-8 border-orange-700 hover:scale-[1.02]">
                  {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8 me-2" />}
                  {t('save')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Assign to Project Dialog */}
      <Dialog open={!!isAssigning} onOpenChange={() => setIsAssigning(null)}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-md" dir={dir}>
            <div className="bg-blue-600 p-8 text-white text-start">
               <DialogTitle className="text-xl font-black font-headline flex items-center gap-3">
                  <LinkIcon className="h-6 w-6 text-blue-200" />
                  {isRtl ? 'تخصيص المعدة لمشروع' : 'Assign to Project'}
               </DialogTitle>
               <p className="text-[10px] font-bold text-blue-100/70 mt-2 uppercase tracking-widest">{isAssigning?.name}</p>
            </div>
            <div className="p-8 space-y-6 text-start">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'اختر المشروع' : 'Target Project'}</Label>
                  <Select value={assignForm.projectId} onValueChange={v => setAssignForm({...assignForm, projectId: v})}>
                     <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="rounded-xl border-2 shadow-2xl">
                        {projects?.filter(p => p.status !== 'completed').map(p => (
                          <SelectItem key={p.id} value={p.id} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                             <div className="flex flex-col text-start">
                                <span>{p.subServiceName}</span>
                                <span className="text-[8px] text-slate-400 uppercase">#{p.transactionNumber}</span>
                             </div>
                          </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ التخصيص' : 'From Date'}</Label>
                  <Input type="date" value={assignForm.fromDate} onChange={e => setAssignForm({...assignForm, fromDate: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleAssign} disabled={loading || !assignForm.projectId} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-200 transition-all border-b-8 border-blue-800">
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 me-2" />}
                  {isRtl ? 'تأكيد التخصيص' : 'Confirm Assignment'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
