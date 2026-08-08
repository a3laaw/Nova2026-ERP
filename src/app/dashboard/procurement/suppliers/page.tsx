'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, ArrowRight,
  Filter, Phone, Mail,
  Star, ShieldCheck, Building2, ShoppingBag, Save
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
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
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
    activeOrders: 12
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Truck className="h-6 w-6 text-primary" />
            {t('suppliers')}
          </h1>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 px-6 font-bold rounded-md shadow-sm">
              <Plus className="h-4 w-4 me-2" />
              {t('common.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-lg p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-lg" dir={dir}>
             <div className="bg-slate-50 p-6 border-b text-start">
                <DialogTitle className="text-lg font-bold">{isRtl ? 'إضافة مورد معتمد' : 'Add New Supplier'}</DialogTitle>
             </div>
             <div className="p-6 space-y-4 text-start">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'الاسم' : 'Name'}</Label>
                   <Input value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="h-9 text-xs font-medium" />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'التصنيف' : 'Category'}</Label>
                   <Input value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} className="h-9 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'الهاتف' : 'Phone'}</Label>
                      <Input value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="h-9 text-xs" />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">{isRtl ? 'البريد' : 'Email'}</Label>
                      <Input value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="h-9 text-xs" />
                   </div>
                </div>
             </div>
             <DialogFooter className="p-6 bg-slate-50 border-t">
                <Button onClick={handleAdd} disabled={isAdding} size="sm" className="w-full h-9 font-bold">
                   {isAdding ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="me-2 h-4 w-4" />}
                   {t('common.save')}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: t('suppliers'), val: stats.total, icon: Building2 },
           { label: isRtl ? 'طلبات نشطة' : 'Active Orders', val: stats.activeOrders, icon: ShoppingBag },
         ].map((stat, i) => (
           <Card key={i} className="border shadow-sm rounded-lg p-4 flex items-center justify-between bg-white">
              <div className="text-start">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                 <h3 className="text-lg font-bold text-slate-900">{stat.val || 0}</h3>
              </div>
              <stat.icon className="h-4 w-4 text-primary/40" />
           </Card>
         ))}
      </div>

      <Card className="rounded-lg border shadow-sm overflow-hidden bg-white">
        <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-9 h-9 border-slate-200 bg-white font-medium text-sm" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" size="sm" className="h-9 px-4 border-slate-200 font-bold text-xs"><Filter className="h-3.5 w-3.5 me-2" /> {t('common.filter')}</Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="py-3 ps-6 text-start text-[10px] font-bold uppercase text-slate-500">{t('suppliers')}</TableHead>
                <TableHead className="text-start text-[10px] font-bold uppercase text-slate-500">{t('category')}</TableHead>
                <TableHead className="text-start text-[10px] font-bold uppercase text-slate-500">{t('common.contact')}</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">{t('common.rating')}</TableHead>
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد نتائج.' : 'No results found.'}</TableCell></TableRow>
              ) : (
                filtered.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-slate-50 transition-colors group border-b-slate-50 cursor-pointer">
                    <TableCell className="py-2.5 ps-6 text-start">
                       <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center font-bold text-primary">
                             {supplier.name?.charAt(0)}
                          </div>
                          <span className="font-bold text-sm text-slate-800">{supplier.name}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="bg-slate-50 text-slate-600 font-bold text-[9px] uppercase px-2 h-5 border-0">
                          {supplier.category}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col text-[10px] text-slate-500">
                          <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {supplier.phone}</span>
                          <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {supplier.email}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-xs text-slate-700">{supplier.rating || '5.0'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="pe-6 text-end">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 group-hover:text-primary">
                          <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
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
