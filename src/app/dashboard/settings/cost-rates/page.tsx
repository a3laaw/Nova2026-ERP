'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, Plus, Loader2, Save, Trash2, 
  CheckCircle2, AlertTriangle, ShieldCheck,
  TrendingUp, History
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { CostRateCard, LaborRateEntry } from '@/types/cost-rate';
import { CostRateService } from '@/services/cost-rate-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

  const cardsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.costRateCards(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: cards, loading: cardsLoading } = useCollection<CostRateCard>(cardsQuery);
  const costService = useMemo(() => db && companyId ? new CostRateService(db, companyId) : null, [db, companyId]);

  const handleCreate = async () => {
    if (!costService || !user || !form.name) return;
    setLoading(true);
    try {
      await costService.createCard({ ...form, laborRates: rates }, user.uid);
      toast({ title: t('saved') });
      setIsAdding(false);
      setRates([{ jobTitle: '', hourlyCost: 0 }]);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!costService) return;
    setLoading(true);
    try {
      await costService.activateCard(id);
      toast({ title: isRtl ? "تم تفعيل جدول التعرفة" : "Card Activated" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Calculator className="h-8 w-8 text-primary" />
            {isRtl ? 'جداول تكلفة العمالة' : 'Labor Cost Rates'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'تحديد تعرفة الساعة لكل مسمى وظيفي لاحتساب تكاليف الإنتاج.' : 'Define hourly rates for each job title to calculate COGS.'}
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2 border-b-4 border-orange-700">
           <Plus className="h-5 w-5" /> {isRtl ? 'إنشاء جدول تعرفة' : 'New Rate Card'}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {cardsLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div> : cards.map(card => (
          <Card key={card.id} className={cn("border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden transition-all", card.isActive ? "ring-2 ring-primary" : "opacity-70")}>
             <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 text-start">
                   <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg", card.isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                      <History className="h-7 w-7" />
                   </div>
                   <div>
                      <div className="flex items-center gap-3">
                         <h3 className="text-xl font-black text-slate-800">{card.name}</h3>
                         {card.isActive && <Badge className="bg-emerald-500 text-white font-black text-[9px] px-3">ACTIVE</Badge>}
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Effective: {card.effectiveFrom}</p>
                   </div>
                </div>
                <div className="flex gap-3">
                   {!card.isActive && (
                     <Button onClick={() => handleActivate(card.id)} variant="outline" className="rounded-xl border-2 font-black gap-2 hover:bg-primary hover:text-white transition-all">
                        <ShieldCheck className="h-4 w-4" /> {isRtl ? 'تفعيل الآن' : 'Set as Active'}
                     </Button>
                   )}
                </div>
             </div>
             <CardContent className="p-0 border-t bg-slate-50/30">
                <Table>
                   <TableBody>
                      {card.laborRates.map((r, i) => (
                        <TableRow key={i} className="border-b-white/50">
                           <TableCell className="ps-10 py-3 font-bold text-slate-600">{r.jobTitle}</TableCell>
                           <TableCell className="text-end pe-10 font-mono font-black text-emerald-600">{r.hourlyCost} KWD/hr</TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
         <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl" dir={dir}>
            <div className="bg-primary/5 p-8 text-slate-900 text-start border-b shrink-0">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-primary" /> {isRtl ? 'تجهيز جدول تعرفة جديد' : 'New Rate Card'}
               </DialogTitle>
            </div>
            <div className="p-8 space-y-8 text-start bg-white max-h-[60vh] overflow-y-auto scrollbar-hide">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Card Name</Label>
                     <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-12 border-2 font-bold" placeholder="e.g. Q1 2026 Rates" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Effective Date</Label>
                     <Input type="date" value={form.effectiveFrom} onChange={e => setForm({...form, effectiveFrom: e.target.value})} className="h-12 border-2 font-black text-center" />
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                     <Label className="text-[12px] font-black uppercase text-primary">Job Titles Pricing</Label>
                     <Button variant="ghost" size="sm" onClick={() => setRates([...rates, { jobTitle: '', hourlyCost: 0 }])} className="h-8 text-[10px] font-black gap-1.5"><Plus className="h-3 w-3" /> Add Row</Button>
                  </div>
                  <div className="space-y-3">
                     {rates.map((r, i) => (
                        <div key={i} className="flex gap-3 animate-in slide-in-from-top-1">
                           <Input value={r.jobTitle} onChange={e => { const nr = [...rates]; nr[i].jobTitle = e.target.value; setRates(nr); }} placeholder="Job Title" className="h-10 border-2 font-bold flex-1" />
                           <Input type="number" step="0.001" value={r.hourlyCost} onChange={e => { const nr = [...rates]; nr[i].hourlyCost = Number(e.target.value); setRates(nr); }} placeholder="Cost" className="h-10 border-2 font-black w-32 text-center text-emerald-600" />
                           <Button variant="ghost" size="icon" onClick={() => setRates(rates.filter((_, idx) => idx !== i))} className="h-10 w-10 text-rose-300"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
               <Button onClick={handleCreate} disabled={loading || !form.name} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 border-b-8 border-orange-700">
                  {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6 me-2" />}
                  {isRtl ? 'حفظ مسودة التعرفة' : 'Save Draft Card'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
