'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, ArrowRight,
  Filter, MoreHorizontal, Phone, Mail,
  Star, ShieldCheck, ExternalLink, MapPin,
  Building2, ShoppingBag, Send
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

export default function SuppliersPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', category: '', phone: '', email: '', rating: 5 });

  const suppliersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.suppliers(companyId)), orderBy('name')) : null, 
  [db, companyId]);

  const { data: suppliers, loading } = useCollection(suppliersQuery);

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
      toast({ title: t('saved') });
      setNewSupplier({ name: '', category: '', phone: '', email: '', rating: 5 });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setIsAdding(false);
    }
  };

  const filtered = suppliers?.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-12" dir={dir}>
      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="text-start space-y-3">
          <div className="flex items-center gap-3 bg-orange-50 text-[#e87c24] px-4 py-1.5 rounded-full w-fit border border-orange-100/50">
             <ShieldCheck className="h-4 w-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isRtl ? 'سلسلة التوريد المعتمدة' : 'Verified Supply Chain'}</span>
          </div>
          <h1 className="text-5xl font-black font-headline text-[#1e1b4b] tracking-tight flex items-center gap-4">
            <Truck className="h-12 w-12 text-[#e87c24]" />
            {t('suppliers')}
          </h1>
          <p className="text-slate-500 font-bold text-lg max-w-xl leading-relaxed italic opacity-80">
            {isRtl ? 'إدارة قاعدة بيانات الموردين، تقييم الأداء، وتتبع أوامر التوريد الميدانية.' : 'Manage supplier database, performance rating, and field supply orders.'}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-20 px-10 rounded-[2rem] bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white font-black text-xl shadow-2xl shadow-orange-500/20 hover:scale-105 transition-all gap-4">
              <Plus className="h-7 w-7" />
              {isRtl ? 'مورد جديد' : 'New Supplier'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[3rem] border-0 shadow-3xl max-w-lg p-0 overflow-hidden bg-white/95 backdrop-blur-xl" dir={dir}>
             <div className="bg-gradient-to-r from-[#e87c24] to-[#FFB000] p-10 text-white">
                <DialogTitle className="text-3xl font-black font-headline">{isRtl ? 'إضافة مورد معتمد' : 'Add New Supplier'}</DialogTitle>
                <p className="text-white/80 font-bold mt-2">{isRtl ? 'أدخل بيانات المورد لإضافته في سلسلة التوريد.' : 'Enter supplier details to add them to chain.'}</p>
             </div>
             <div className="p-10 space-y-6 text-start">
                <div className="space-y-2">
                   <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{t('name')}</Label>
                   <Input value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="h-14 rounded-2xl border-2" />
                </div>
                <div className="space-y-2">
                   <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{isRtl ? 'التصنيف' : 'Category'}</Label>
                   <Input value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} placeholder={isRtl ? "مثلاً: مواد بناء، حديد" : "e.g. Construction Materials"} className="h-14 rounded-2xl border-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{t('phone')}</Label>
                      <Input value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="h-14 rounded-2xl border-2" />
                   </div>
                   <div className="space-y-2">
                      <Label className="font-black text-xs uppercase tracking-widest text-slate-400">{t('email')}</Label>
                      <Input value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="h-14 rounded-2xl border-2" />
                   </div>
                </div>
             </div>
             <DialogFooter className="p-10 bg-slate-50 border-t">
                <Button onClick={handleAdd} disabled={isAdding} className="w-full h-16 rounded-2xl bg-gradient-to-r from-[#e87c24] to-[#FFB000] text-white font-black text-xl shadow-xl shadow-orange-500/20">
                   {isAdding ? <Loader2 className="animate-spin" /> : <Save className="me-2 h-6 w-6" />}
                   {isRtl ? 'اعتماد المورد' : 'Register Supplier'}
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي الموردين' : 'Total Suppliers', val: suppliers?.length || 0, icon: Building2, color: 'text-orange-600', bg: 'bg-orange-50' },
           { label: isRtl ? 'طلبات نشطة' : 'Active Orders', val: 12, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'تقييم الجودة' : 'Quality Rate', val: '4.8/5', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
           { label: isRtl ? 'عروض معالجة' : 'Quotes Processed', val: 84, icon: FileSearch, color: 'text-emerald-600', bg: 'bg-emerald-50' },
         ].map((stat, i) => (
           <Card key={i} className="border-0 shadow-xl rounded-[2rem] p-8 text-start bg-white/95 group hover:scale-[1.03] transition-all">
              <div className={cn("p-4 rounded-2xl w-fit mb-6 transition-transform group-hover:rotate-6", stat.bg, stat.color)}>
                 <stat.icon className="h-8 w-8" />
              </div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-4xl font-black font-headline text-[#1e1b4b]">{stat.val}</h3>
           </Card>
         ))}
      </div>

      {/* Main Content Card */}
      <Card className="border-0 shadow-3xl rounded-[3rem] bg-white/95 overflow-hidden ring-1 ring-black/[0.02]">
        <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-row items-center justify-between">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={isRtl ? 'ابحث عن مورد، تصنيف، أو منتج...' : 'Search suppliers...'} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-orange-100/50 focus:border-[#e87c24] text-lg font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-4">
              <Button variant="outline" className="rounded-xl font-bold h-12 gap-2 border-2 px-6"><Filter className="h-4 w-4" /> {isRtl ? 'فلترة متقدمة' : 'Advanced Filter'}</Button>
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-orange-50/30">
              <TableRow>
                <TableHead className="py-8 ps-10 text-start font-black text-[#1e1b4b] uppercase text-xs tracking-widest">{isRtl ? 'اسم المورد / الشركة' : 'Supplier Name'}</TableHead>
                <TableHead className="text-start font-black text-[#1e1b4b] uppercase text-xs tracking-widest">{isRtl ? 'التصنيف الرئيسي' : 'Category'}</TableHead>
                <TableHead className="text-start font-black text-[#1e1b4b] uppercase text-xs tracking-widest">{isRtl ? 'الاتصال' : 'Contact'}</TableHead>
                <TableHead className="text-center font-black text-[#1e1b4b] uppercase text-xs tracking-widest">{isRtl ? 'التقييم' : 'Rating'}</TableHead>
                <TableHead className="text-start font-black text-[#1e1b4b] uppercase text-xs tracking-widest">{t('status')}</TableHead>
                <TableHead className="pe-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-[#e87c24] opacity-20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-black italic">{isRtl ? 'لا يوجد موردين في القاعدة حالياً.' : 'No suppliers found in database.'}</TableCell></TableRow>
              ) : (
                filtered.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-orange-50/20 transition-colors group cursor-pointer border-b-slate-100">
                    <TableCell className="py-8 ps-10 text-start">
                       <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-[#e87c24] font-black border-2 border-orange-50 group-hover:scale-110 transition-transform">
                             {supplier.name?.charAt(0)}
                          </div>
                          <div className="text-start">
                             <p className="font-black text-xl text-[#1e1b4b] tracking-tight">{supplier.name}</p>
                             <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase mt-1">
                                <MapPin className="h-2.5 w-2.5" /> {isRtl ? 'مدينة الكويت' : 'Kuwait City'}
                             </div>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="secondary" className="bg-orange-100/50 text-[#e87c24] font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px] tracking-widest">
                          {supplier.category}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><Phone className="h-3 w-3 text-orange-400" /> {supplier.phone}</div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Mail className="h-3 w-3 text-orange-400" /> {supplier.email}</div>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-black text-lg text-[#1e1b4b]">{supplier.rating || '5.0'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
                          <span className="text-xs font-black uppercase text-emerald-600">{isRtl ? 'نشط' : 'Active'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="pe-10 text-center">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-[#e87c24] group-hover:text-white transition-all h-12 w-12">
                          <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Procurement Assistant Hook */}
      <div className="bg-gradient-to-r from-[#1e1b4b] to-[#2d2a6e] rounded-[3rem] p-12 text-white flex flex-col md:flex-row justify-between items-center gap-10 shadow-3xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform">
            <Sparkles className="h-48 w-48" />
         </div>
         <div className="text-start space-y-4 relative z-10">
            <h2 className="text-4xl font-black font-headline tracking-tight">{isRtl ? 'ذكاء المشتريات (AI Procurement)' : 'AI Procurement Assistant'}</h2>
            <p className="text-white/60 text-lg font-bold max-w-xl leading-relaxed">
               {isRtl ? 'قم برفع عروض أسعار الموردين وسنقوم آلياً باستخراج البنود ومقارنتها واقتراح المورد الأفضل بناءً على معاييرك.' : 'Upload supplier quotes and let AI extract items, compare prices, and recommend the best option.'}
            </p>
         </div>
         <Button 
            className="h-20 px-12 rounded-[2.5rem] bg-white text-[#1e1b4b] font-black text-2xl shadow-2xl hover:scale-105 transition-all gap-4 relative z-10"
            onClick={() => router.push('/dashboard/ai')}
         >
            <Send className="h-8 w-8" />
            {isRtl ? 'تحليل العروض بالـ AI' : 'Start AI Analysis'}
         </Button>
      </div>
    </div>
  );
}

// Re-using the same types and paths from previous modules
