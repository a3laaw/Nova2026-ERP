
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Plus, Search, Loader2, ArrowRight,
  Filter, Phone, Mail, Star, Building2,
  HardHat, ShieldCheck, Wallet, Receipt, Save
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';
import { Subcontractor } from '@/types/procurement';

export default function SubcontractorsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', trade: '', phone: '', email: '', civilId: '' });

  const subsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subcontractors(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: subs, loading } = useCollection<Subcontractor>(subsQuery);

  const handleAdd = async () => {
    if (!db || !companyId || !form.name) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, paths.subcontractors(companyId)), {
        ...form,
        status: 'active',
        rating: 5,
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: t('common.saved') });
      setIsAdding(false);
      setForm({ name: '', trade: '', phone: '', email: '', civilId: '' });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setIsAdding(false);
    }
  };

  const filtered = subs?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.trade.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit border border-primary/10">
              <HardHat className="h-3 w-3" /> {isRtl ? 'إدارة القوى العاملة الخارجية' : 'Subcontractor Management'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900">{isRtl ? 'سجل مقاولي الباطن' : 'Subcontractor Registry'}</h1>
           <p className="text-muted-foreground text-sm font-bold opacity-70 italic">{isRtl ? 'إدارة وتتبع مطالبات مقاولي الباطن المربوطة بالمشاريع.' : 'Manage and track subcontractor claims linked to projects.'}</p>
        </div>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="h-14 px-10 font-black rounded-2xl bg-slate-900 text-white shadow-2xl hover:scale-105 transition-all gap-3 border-b-8 border-slate-700">
               <Plus className="h-6 w-6 text-primary" />
               {isRtl ? 'إضافة مقاول باطن' : 'Add Subcontractor'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
             <div className="bg-slate-50 p-10 text-slate-900 text-start border-b">
                <DialogTitle className="text-3xl font-black font-headline flex items-center gap-4">
                   <HardHat className="h-9 w-9 text-primary" />
                   {isRtl ? 'تسجيل مقاول جديد' : 'New Subcontractor'}
                </DialogTitle>
             </div>
             <div className="p-10 space-y-6 text-start">
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">اسم المقاول / الشركة</Label>
                   <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-12 rounded-xl border-2 font-black" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-black uppercase text-slate-400">{isRtl ? 'التخصص الفني' : 'Specialization'}</Label>
                   <Input value={form.trade} onChange={e => setForm({...form, trade: e.target.value})} className="h-12 rounded-xl border-2 font-bold" placeholder="نجارة، حدادة، أصباغ..." />
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'رقم الهاتف' : 'Phone'}</Label>
                      <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الرقم المدني / السجل' : 'Civil ID / Reg'}</Label>
                      <Input value={form.civilId} onChange={e => setForm({...form, civilId: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                   </div>
                </div>
             </div>
             <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleAdd} disabled={isAdding || !form.name} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-xl shadow-xl border-b-8 border-orange-700">
                   {isAdding ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="me-2 h-6 w-6" />}
                   {isRtl ? 'حفظ المقاول' : 'Save Subcontractor'}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="rounded-[3rem] border-0 shadow-2xl overflow-hidden bg-white ring-1 ring-black/5">
        <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/50 border-b">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <Input 
                placeholder={isRtl ? 'بحث باسم المقاول أو التخصص...' : 'Search by name or trade...'} 
                className="ps-14 h-14 border-2 border-slate-100 bg-white font-bold rounded-2xl focus:border-primary/40 transition-all shadow-inner" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow>
                <TableHead className="py-8 ps-12 text-start text-xs font-black uppercase tracking-widest">{isRtl ? 'المقاول / التخصص' : 'Subcontractor / Trade'}</TableHead>
                <TableHead className="text-start text-xs font-black uppercase tracking-widest">{t('clients.table.contact')}</TableHead>
                <TableHead className="text-center text-xs font-black uppercase tracking-widest">{isRtl ? 'المطالبات المالية' : 'Claims'}</TableHead>
                <TableHead className="text-center text-xs font-black uppercase tracking-widest">{t('common.status')}</TableHead>
                <TableHead className="pe-12 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-40"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-40 italic text-slate-300 font-black text-xl">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map((sub) => (
                  <TableRow key={sub.id} className="hover:bg-primary/[0.01] transition-colors group border-b-slate-100">
                    <TableCell className="py-8 ps-12 text-start">
                       <div className="flex items-center gap-6">
                          <div className="h-14 w-14 rounded-3xl bg-primary/5 text-primary flex items-center justify-center font-black text-2xl shadow-inner border-2 border-primary/10 group-hover:scale-110 transition-transform">
                             {sub.name?.charAt(0)}
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-xl block leading-none">{sub.name}</span>
                             <Badge variant="outline" className="bg-white border-slate-100 text-slate-400 font-black text-[9px] uppercase mt-2 px-3">{sub.trade}</Badge>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col gap-2">
                          <span className="flex items-center gap-2 font-mono font-bold text-xs text-slate-500"><Phone className="h-3 w-3 text-primary" /> {sub.phone}</span>
                          <span className="flex items-center gap-2 font-bold text-xs text-slate-400"><Mail className="h-3 w-3" /> {sub.email || '---'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex flex-col items-center">
                          <span className="font-mono font-black text-emerald-600 text-lg">0 <span className="text-[10px] opacity-40">KWD</span></span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge className={cn(
                         "font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[10px] gap-2",
                         sub.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                       )}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {sub.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-12 text-end">
                       <Button variant="ghost" size="icon" className="rounded-2xl h-12 w-12 text-slate-300 group-hover:text-primary transition-all">
                          <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

