'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, ArrowRight,
  Filter, Phone, Mail,
  Star, Building2, ShoppingBag, Save
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
import { useRouter } from 'next/navigation';

export default function SuppliersPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', category: '', phone: '', email: '', rating: 5 });

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: suppliers, loading } = useCollection<any>(suppliersQuery);

  const stats = useMemo(() => ({
    total: suppliers?.length || 0,
    activeOrders: 0 
  }), [suppliers]);

  const handleAdd = async () => {
    if (!db || !companyId || !newSupplier.name) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, paths.suppliers(companyId)), {
        ...newSupplier,
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: t('common.saved') });
      setNewSupplier({ name: '', category: '', phone: '', email: '', rating: 5 });
      setIsAdding(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setIsAdding(false);
    }
  };

  const filtered = suppliers?.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Truck className="h-8 w-8 text-primary" />
            {t('suppliers')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {t('procurement.supplierDatabase')}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-10 px-6 font-black rounded-xl shadow-lg">
              <Plus className="h-4 w-4 me-2" />
              {t('common.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
             <div className="bg-slate-50 p-8 text-slate-900 text-start border-b">
                <DialogTitle className="text-2xl font-black font-headline">{t('procurement.addSupplier')}</DialogTitle>
             </div>
             <div className="p-8 space-y-6 text-start">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.name')}</Label>
                   <Input value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="h-12 rounded-xl border-2 font-black" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('category')}</Label>
                   <Input value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('clients.form.mobile')}</Label>
                      <Input value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.email')}</Label>
                      <Input value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="h-12 rounded-xl border-2 font-mono" />
                   </div>
                </div>
             </div>
             <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button onClick={handleAdd} disabled={isAdding} className="w-full h-16 rounded-2xl font-black text-xl shadow-xl">
                   {isAdding ? <Loader2 className="animate-spin" /> : <Save className="me-2 h-6 w-6" />}
                   {t('procurement.registerSupplier')}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <Card className="border-0 shadow-lg rounded-xl p-6 flex items-center justify-between bg-white border-b-4 border-primary">
            <div className="text-start">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('suppliers')}</p>
               <h3 className="text-2xl font-black text-slate-900">{stats.total}</h3>
            </div>
            <Building2 className="h-6 w-6 text-primary/30" />
         </Card>
      </div>

      <Card className="rounded-[2rem] border-0 shadow-2xl overflow-hidden bg-white ring-1 ring-black/5">
        <div className="p-6 flex flex-row items-center justify-between gap-4 bg-slate-50/50 border-b">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-12 h-11 border-2 border-slate-100 bg-white font-bold rounded-xl" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" className="h-11 px-6 rounded-xl border-2 font-black text-xs"><Filter className="h-4 w-4 me-2" /> {t('common.filter')}</Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('suppliers')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('category')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clients.table.contact')}</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('suppliers.rating')}</TableHead>
                <TableHead className="pe-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 italic text-slate-400 font-black">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-primary/[0.01] transition-colors group border-b-slate-50">
                    <TableCell className="py-6 ps-10 text-start">
                       <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-2xl bg-primary/5 text-primary flex items-center justify-center font-black text-xl shadow-inner border border-primary/10">
                             {supplier.name?.charAt(0)}
                          </div>
                          <span className="font-black text-slate-800 text-lg">{supplier.name}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="bg-slate-50 text-slate-600 font-black text-[9px] uppercase px-4 h-6 border-2">
                          {supplier.category}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col text-[10px] font-bold text-slate-500">
                          <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 opacity-30" /> {supplier.phone}</span>
                          <span className="flex items-center gap-1.5 mt-1"><Mail className="h-3 w-3 opacity-30" /> {supplier.email}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-1.5">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-black text-sm text-slate-700">{supplier.rating || '5.0'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="pe-10 text-end">
                       <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-300 group-hover:text-primary group-hover:bg-primary/5">
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
    </div>
  );
}