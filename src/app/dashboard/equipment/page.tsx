'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Truck, Plus, Search, Loader2, 
  Edit3, Filter, ArrowRight,
  Calculator, ShieldCheck, Building2
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function EquipmentMasterPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");

  const equipQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.equipment(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const { data: equipment, loading } = useCollection<Equipment>(equipQuery);

  const filtered = useMemo(() => {
    return (equipment || []).filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.code.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.code.localeCompare(b.code));
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
            {isRtl ? 'إدارة الأصول المملوكة والمستأجرة وتكاليف التشغيل.' : 'Manage owned/rented assets and operating costs.'}
          </p>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/equipment/new')} 
          className="h-12 px-8 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2 border-b-4 border-orange-700"
        >
           <Plus className="h-5 w-5" /> {isRtl ? 'إضافة معدة جديدة' : 'Register New Asset'}
        </Button>
      </header>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث بالكود أو الاسم...' : 'Search assets...'} 
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
                <TableHead className="py-6 ps-10 text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المعدة / الكود' : 'Asset / Code'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'نوع الملكية' : 'Ownership'}</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-end font-black uppercase text-[10px] tracking-widest">{isRtl ? 'التعرفة (KWD/HR)' : 'Rate/hr'}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-bold italic">{isRtl ? 'لا يوجد معدات مسجلة.' : 'No assets found.'}</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-primary/[0.01] transition-colors border-b-slate-100 cursor-pointer" onClick={() => router.push(`/dashboard/equipment/${item.id}/edit`)}>
                    <TableCell className="ps-10 py-6 text-start">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-11 w-11 rounded-xl flex items-center justify-center shadow-inner border border-primary/10",
                            item.ownershipType === 'owned' ? "bg-primary/5 text-primary" : "bg-orange-50 text-orange-600"
                          )}>
                             <Truck className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-lg leading-none">{item.name}</span>
                             <span className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest font-mono">#{item.code}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className={cn(
                         "font-black text-[9px] uppercase px-3 py-1",
                         item.ownershipType === 'owned' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"
                       )}>
                          {isRtl ? (item.ownershipType === 'owned' ? 'مملوكة' : 'مستأجرة') : item.ownershipType.toUpperCase()}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", item.status === 'available' ? "bg-emerald-500" : "bg-rose-500")} />
                          <span className="text-[10px] font-black uppercase text-slate-600">{item.status}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-emerald-600 text-lg pe-10">
                       {(item.hourlyRentalRate || item.hourlyDepreciationRate || 0).toLocaleString()}
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
    </div>
  );
}
