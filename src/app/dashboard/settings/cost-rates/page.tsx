'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, Plus, Loader2, Save, Trash2, 
  CheckCircle2, AlertTriangle, ShieldCheck,
  TrendingUp, History, X, Clock, Users,
  Briefcase, Building2, ChevronDown, Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, collectionGroup, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { CostRateCard, LaborRateEntry } from '@/types/cost-rate';
import { CostRateService } from '@/services/cost-rate-service';
import { Job } from '@/types/reference';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SmartDateInput } from '@/components/ui/smart-date-input';

export default function CostRatesPage() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', effectiveFrom: new Date().toISOString().split('T')[0] });
  const [rates, setRates] = useState<LaborRateEntry[]>([{ jobTitle: '', hourlyCost: 0 }]);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const cardsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.costRateCards(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: cards, loading: cardsLoading } = useCollection<CostRateCard>(cardsQuery);
  const costService = useMemo(() => db && companyId ? new CostRateService(db, companyId) : null, [db, companyId]);

  useEffect(() => {
     if (isAdding && db && companyId) {
        setLoadingJobs(true);
        getDocs(collectionGroup(db, 'jobs'))
          .then(snap => {
             const allJobs = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as Job))
                .filter(j => j.companyId === companyId);
             setAvailableJobs(allJobs);
          })
          .finally(() => setLoadingJobs(false));
     }
  }, [isAdding, db, companyId]);

  // محرك الأتمتة: تعبئة الجدول بكافة الوظائف المتاحة فوراً عند بدء الإضافة
  useEffect(() => {
    if (isAdding && availableJobs.length > 0 && rates.length <= 1 && rates[0].jobTitle === '') {
       const initialRates = availableJobs.map(job => ({
          jobTitle: isRtl ? job.name : job.nameEn,
          hourlyCost: job.hourlyCost || 0
       }));
       setRates(initialRates);
    }
  }, [isAdding, availableJobs, isRtl]);

  const handleCreate = async () => {
    if (!costService || !user || !form.name) return;
    
    const cleanedRates = rates.filter(r => r.jobTitle.trim() !== '').map(r => ({
      jobTitle: r.jobTitle,
      hourlyCost: Number(r.hourlyCost) || 0
    }));

    if (cleanedRates.length === 0) {
      toast({ variant: "destructive", title: isRtl ? "بيانات ناقصة" : "Missing Data" });
      return;
    }

    setLoading(true);
    try {
      await costService.createCard({ ...form, laborRates: cleanedRates }, user.uid);
      toast({ title: t('saved') });
      setIsAdding(false);
      setRates([{ jobTitle: '', hourlyCost: 0 }]);
      setForm({ name: '', effectiveFrom: new Date().toISOString().split('T')[0] });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!costService) return;
    setLoading(true);
    try {
      await costService.activateCard(id);
      toast({ title: isRtl ? "تم تفعيل جدول التعرفة بنجاح" : "Rate card activated" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoading(false);
    }
  };

  const addRateRow = () => setRates([...rates, { jobTitle: '', hourlyCost: 0 }]);
  const removeRateRow = (idx: number) => setRates(rates.filter((_, i) => i !== idx));
  const updateRate = (idx: number, field: keyof LaborRateEntry, val: any) => {
    const newRates = [...rates];
    (newRates[idx] as any)[field] = val;
    setRates(newRates);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8 border-slate-100">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit border border-primary/10">
              <Calculator className="h-3 w-3" /> {isRtl ? 'محرك استرداد التكاليف الميدانية' : 'Cost Recovery Engine'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'جداول تعرفة العمالة' : 'Labor Cost Rates'}</h1>
           <p className="text-muted-foreground font-bold text-sm opacity-80 italic">
             {isRtl ? 'تحديد تكلفة الساعة للوظائف المعتمدة لاحتساب تكاليف الإنتاج آلياً.' : 'Define hourly rates for jobs to automate COGS calculations.'}
           </p>
        </div>
        <button onClick={() => setIsAdding(true)} className="h-16 px-10 rounded-[2rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-3 border-b-8 border-[#f57c00]">
           <Plus className="h-7 w-7" /> {isRtl ? 'إنشاء جدول تعرفة' : 'New Rate Card'}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {cardsLoading ? (
          <div className="py-40 text-center flex flex-col items-center gap-4">
             <Loader2 className="animate-spin h-12 w-12 text-primary/20" />
             <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Loading Master Rates...</p>
          </div>
        ) : cards?.length === 0 ? (
          <Card className="border-4 border-dashed border-slate-100 bg-slate-50/50 rounded-[3rem] p-24 text-center opacity-40">
             <Calculator className="h-20 w-20 mx-auto text-slate-200 mb-6" />
             <h3 className="text-2xl font-black text-slate-400">{isRtl ? 'لا يوجد جداول تعرفة مسجلة' : 'No Rate Cards Found'}</h3>
             <p className="text-sm font-bold text-slate-300 mt-2">{isRtl ? 'قم بإضافة أول جدول لتمكين حساب التكاليف الميدانية.' : 'Create your first card to enable field costing.'}</p>
          </Card>
        ) : (
          cards?.map(card => (
            <Card key={card.id} className={cn(
              "border-0 shadow-xl rounded-[3rem] bg-white overflow-hidden transition-all relative group",
              card.isActive ? "ring-4 ring-primary ring-offset-4" : "opacity-80 grayscale-[0.5] hover:grayscale-0"
            )}>
               <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-8 text-start">
                     <div className={cn(
                       "h-20 w-20 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform group-hover:rotate-6",
                       card.isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                     )}>
                        <History className="h-10 w-10" />
                     </div>
                     <div className="space-y-1">
                        <div className="flex items-center gap-3">
                           <h3 className="text-2xl font-black text-slate-800">{card.name}</h3>
                           {card.isActive && (
                             <Badge className="bg-emerald-500 text-white font-black text-[10px] px-5 py-1 rounded-full border-0 shadow-lg shadow-emerald-200">
                                ACTIVE REFERENCE
                             </Badge>
                           )}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                           <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Effective: {card.effectiveFrom}</span>
                           <span className="h-1 w-1 rounded-full bg-slate-200" />
                           <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {card.laborRates.length} Trades</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     {!card.isActive && (
                       <Button 
                         onClick={() => handleActivate(card.id)} 
                         disabled={loading}
                         variant="outline" 
                         className="h-14 px-10 rounded-2xl border-2 font-black gap-3 hover:bg-primary hover:text-white transition-all shadow-sm"
                       >
                          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <ShieldCheck className="h-6 w-6 text-primary" />} 
                          {isRtl ? 'تفعيل كمرجع حالي' : 'Activate Card'}
                       </Button>
                     )}
                  </div>
               </div>
               <CardContent className="p-0 border-t-2 border-slate-50 bg-slate-50/20">
                  <Table>
                     <TableBody>
                        {card.laborRates.map((r, i) => (
                          <TableRow key={i} className="hover:bg-white transition-colors border-b-white/50">
                             <TableCell className="ps-12 py-5 font-black text-slate-700 text-lg">{r.jobTitle}</TableCell>
                             <TableCell className="text-end pe-12">
                                <div className="flex flex-col items-end">
                                   <span className="font-mono font-black text-2xl text-emerald-600">{r.hourlyCost.toFixed(3)}</span>
                                   <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Kuwaiti Dinars / Hour</span>
                                </div>
                             </TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
         <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-3xl flex flex-col h-fit max-h-[90vh]" dir={dir}>
            <div className="bg-primary/5 p-10 text-slate-900 text-start border-b shrink-0 relative">
               <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="h-32 w-32 text-primary" /></div>
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4 relative z-10">
                  <Calculator className="h-9 w-9 text-primary" /> 
                  {isRtl ? 'تجهيز جدول تعرفة جديد' : 'Design New Rate Card'}
               </DialogTitle>
               <p className="text-slate-500 font-bold mt-2 relative z-10">{isRtl ? 'يتم سحب الوظائف آلياً من الهيكل التنظيمي لضمان دقة الربط.' : 'Jobs are synced from Org Structure automatically.'}</p>
            </div>
            
            <div className="p-10 space-y-10 text-start bg-white overflow-y-auto scrollbar-hide">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Card Name</Label>
                     <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50 focus:bg-white transition-all shadow-inner" placeholder={isRtl ? "مثلاً: تعرفة 2026" : "e.g. 2026 Standard Rates"} />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Effective Date</Label>
                     <SmartDateInput value={form.effectiveFrom} onChange={v => setForm({...form, effectiveFrom: v})} />
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b-2 border-slate-50 pb-4">
                     <Label className="text-sm font-black uppercase text-primary flex items-center gap-2">
                        <Users className="h-5 w-5" /> {isRtl ? 'تعرفة الساعة للمسميات المعتمدة' : 'Hourly Rates for Approved Trades'}
                     </Label>
                     <Button variant="outline" size="sm" onClick={addRateRow} className="h-10 rounded-xl font-black text-xs gap-2 border-2 bg-white hover:bg-primary/5 transition-all">
                        <Plus className="h-4 w-4" /> {isRtl ? 'إضافة مهنة مخصصة' : 'Manual Add'}
                     </Button>
                  </div>
                  
                  <div className="space-y-4">
                     {rates.map((r, i) => (
                        <div key={i} className="flex gap-4 animate-in slide-in-from-top-2 duration-300 items-end">
                           <div className="flex-1 space-y-1.5 text-start">
                              <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'الوظيفة' : 'Job Title'}</Label>
                              <Input 
                                value={r.jobTitle} 
                                onChange={e => updateRate(i, 'jobTitle', e.target.value)} 
                                className="h-12 rounded-xl border-2 font-black bg-white" 
                                placeholder={isRtl ? "اسم المهنة..." : "Trade name..."}
                              />
                           </div>
                           <div className="w-40 space-y-1.5 relative text-start">
                              <Label className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'تكلفة الساعة' : 'Rate/hr'}</Label>
                              <div className="relative">
                                 <Input 
                                   type="number" 
                                   step="0.001" 
                                   value={r.hourlyCost === 0 ? "" : r.hourlyCost} 
                                   onChange={e => updateRate(i, 'hourlyCost', e.target.value)} 
                                   className="h-12 rounded-xl border-2 font-black text-center text-emerald-600 bg-white text-lg" 
                                 />
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-300">KWD</span>
                              </div>
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => removeRateRow(i)} className="h-12 w-12 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50">
                              <Trash2 className="h-5 w-5" />
                           </Button>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="p-8 rounded-[2.5rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4">
                  <Info className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                  <p className="text-xs text-amber-800 font-bold leading-relaxed">
                     {isRtl 
                       ? 'تم سحب المسميات الوظيفية آلياً من الهيكل التنظيمي لشركتك. قم فقط بإدخال سعر الساعة لكل تخصص لاعتماد التكاليف الميدانية.' 
                       : 'Job titles have been automatically fetched from your Org Structure. Simply enter the hourly rate for each trade.'}
                  </p>
               </div>
            </div>

            <DialogFooter className="p-10 bg-slate-50 border-t shrink-0">
               <Button onClick={handleCreate} disabled={loading || !form.name} className="w-full h-20 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-[#f57c00]">
                  {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                  {isRtl ? 'حفظ واصدار جدول التعرفة' : 'Confirm & Issue Rates'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
