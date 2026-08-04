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
  const [rates, setRates] = useState<LaborRateEntry[]>([]);
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
             
             // التعبئة الآلية الحتمية: لا يوجد زر إضافة يدوية
             if (allJobs.length > 0) {
                const autoRates = allJobs.map(job => ({
                   jobTitle: isRtl ? job.name : (job.nameEn || job.name),
                   hourlyCost: job.hourlyCost || 0
                }));
                setRates(autoRates);
             }
          })
          .catch(() => {
             toast({ variant: "destructive", title: t('error') });
          })
          .finally(() => setLoadingJobs(false));
     }
  }, [isAdding, db, companyId, isRtl, t]);

  const handleCreate = async () => {
    if (!costService || !user || !form.name) return;
    
    setLoading(true);
    try {
      await costService.createCard({ ...form, laborRates: rates }, user.uid);
      toast({ title: t('saved') });
      setIsAdding(false);
      setRates([]);
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
             {isRtl ? 'تحديد تكلفة الساعة للوظائف المعتمدة لاحتساب تكاليف الإنتاج آلياً.' : 'Define hourly rates for jobs to automate COGS.'}
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
             <h3 className="text-2xl font-black text-slate-400">{isRtl ? 'لا يوجد جداول تعرفة مسجلة' : 'No Rate Cards'}</h3>
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
                       "h-20 w-20 rounded-[2rem] flex items-center justify-center shadow-2xl",
                       card.isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                     )}>
                        <History className="h-10 w-10" />
                     </div>
                     <div className="space-y-1">
                        <div className="flex items-center gap-3">
                           <h3 className="text-2xl font-black text-slate-800">{card.name}</h3>
                           {card.isActive && (
                             <Badge className="bg-emerald-500 text-white font-black text-[10px] px-5 py-1 rounded-full shadow-lg shadow-emerald-200 border-0">ACTIVE REFERENCE</Badge>
                           )}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                           <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Effective: {card.effectiveFrom}</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     {!card.isActive && (
                       <Button onClick={() => handleActivate(card.id)} disabled={loading} variant="outline" className="h-14 px-10 rounded-2xl border-2 font-black gap-3 shadow-sm hover:bg-primary hover:text-white transition-all">
                          <ShieldCheck className="h-6 w-6 text-primary" /> {isRtl ? 'تفعيل كمرجع حالي' : 'Activate Card'}
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
                                   <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">KWD / Hour</span>
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
            <div className="bg-primary/5 p-10 text-slate-900 text-start border-b shrink-0">
               <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                  <Calculator className="h-9 w-9 text-primary" /> 
                  {isRtl ? 'تجهيز جدول تعرفة سيادي' : 'Design Master Rate Card'}
               </DialogTitle>
               <p className="text-slate-500 font-bold mt-2">{isRtl ? 'يتم جلب كافة المسميات المعتمدة آلياً لضمان المطابقة.' : 'Auto-syncing trade names for integrity.'}</p>
            </div>
            
            <div className="p-10 space-y-10 text-start bg-white overflow-y-auto scrollbar-hide">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Card Label</Label>
                     <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 rounded-2xl border-2 font-black text-lg bg-slate-50" placeholder="..." />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Start Date</Label>
                     <SmartDateInput value={form.effectiveFrom} onChange={v => setForm({...form, effectiveFrom: v})} />
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b-2 border-slate-50 pb-4">
                     <Label className="text-sm font-black uppercase text-primary flex items-center gap-2">
                        <Users className="h-5 w-5" /> {isRtl ? 'تسعير المهن والمسميات المعتمدة' : 'Official Trade Pricing'}
                     </Label>
                  </div>
                  
                  {loadingJobs ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
                  ) : (
                    <div className="space-y-4">
                       {rates.map((r, i) => (
                          <div key={i} className="flex gap-4 animate-in slide-in-from-top-2 duration-300 items-end bg-slate-50 p-4 rounded-2xl border-2 border-white shadow-sm">
                             <div className="flex-1 space-y-1.5 text-start">
                                <Label className="text-[9px] font-black text-slate-400 uppercase">Trade Name</Label>
                                <p className="font-black text-slate-700 py-2">{r.jobTitle}</p>
                             </div>
                             <div className="w-48 space-y-1.5 relative text-start">
                                <Label className="text-[9px] font-black uppercase text-primary tracking-tighter">Hourly Rate (KWD/hr)</Label>
                                <div className="relative">
                                   <Input 
                                     type="number" 
                                     step="0.001" 
                                     value={r.hourlyCost === 0 ? "" : r.hourlyCost} 
                                     onChange={e => updateRate(i, 'hourlyCost', e.target.value)} 
                                     className="h-12 rounded-xl border-2 font-black text-center text-emerald-600 bg-white text-lg shadow-inner" 
                                   />
                                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-300">KWD</span>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                  )}
               </div>

               <div className="p-8 rounded-[2.5rem] bg-amber-50 border-2 border-dashed border-amber-200 flex items-start gap-4">
                  <Info className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                  <p className="text-xs text-amber-800 font-bold leading-relaxed italic">
                     {isRtl 
                       ? 'تنبيه سيادي: تم إيقاف الإضافة اليدوية لضمان أن كل بند مالي في الموقع مرتبط حصراً بمسمى وظيفي معتمد في هيكل المنشأة.' 
                       : 'Sovereign Note: Manual entries disabled to ensure cost tracking integrity.'}
                  </p>
               </div>
            </div>

            <DialogFooter className="p-10 bg-slate-50 border-t shrink-0">
               <Button onClick={handleCreate} disabled={loading || !form.name || rates.length === 0} className="w-full h-16 rounded-[2.5rem] bg-primary text-white font-black text-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-4 border-b-8 border-orange-700">
                  {loading ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                  {isRtl ? 'حفظ واصدار جدول التعرفة' : 'Commit & Issue Card'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
