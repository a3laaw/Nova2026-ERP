'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  HardHat, Plus, Search, Loader2, ArrowRight,
  Filter, Calendar, Camera,
  UserCircle, LayoutGrid, Copy, Edit3
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { paths } from '@/firebase/multi-tenant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export default function FieldVisitsListPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const visitsQuery = useMemo(() => 
    companyId && db ? query(
      collection(db, paths.fieldVisits(companyId)),
      orderBy('visitDate', 'desc')
    ) : null, 
  [db, companyId]);

  const { data: rawVisits, loading } = useCollection<any>(visitsQuery);

  const filtered = useMemo(() => {
    return (rawVisits || []).filter(v => 
      v.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.engineerName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rawVisits, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <HardHat className="h-8 w-8 text-primary" />
             {isRtl ? 'سجل الزيارات الميدانية المعتمد' : 'Official Field Visits Log'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? 'أرشيف تقارير الإنجاز اليومية الموثقة بالصور والموارد.' : 'Archive of daily progress reports with evidence and resources.'}
           </p>
        </div>
        <Button onClick={() => router.push('/dashboard/construction/field-visits/new')} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2">
          <Plus className="h-5 w-5" /> {isRtl ? 'تقرير زيارة جديد' : 'New Site Report'}
        </Button>
      </div>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder={isRtl ? 'بحث باسم العميل أو المهندس...' : 'Search clients or engineers...'} 
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-40 text-center flex flex-col items-center gap-6 opacity-30">
             <Calendar className="h-16 w-16 text-slate-200" />
             <p className="text-xl font-black text-slate-400">{isRtl ? 'لا يوجد تقارير زيارات مسجلة حالياً.' : 'No site reports found.'}</p>
          </div>
        ) : (
          filtered.map((visit) => (
            <Card key={visit.id} className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden group hover:ring-2 hover:ring-primary/20 transition-all">
               <CardHeader className="bg-slate-50/50 p-6 border-b flex flex-row justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="h-9 w-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary border border-primary/10">
                        <Calendar className="h-4 w-4" />
                     </div>
                     <span className="font-black text-xs text-slate-600">{visit.visitDate}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-2 shadow-2xl">
                       <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => router.push(`/dashboard/construction/field-visits/${visit.id}`)}>
                          <ArrowRight className="h-3.5 w-3.5" /> عرض التقرير
                       </DropdownMenuItem>
                       <DropdownMenuItem className="font-bold text-xs gap-2" onClick={() => router.push(`/dashboard/construction/field-visits/new?cloneId=${visit.id}`)}>
                          <Copy className="h-3.5 w-3.5" /> استنساخ للنسخ
                       </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
               </CardHeader>
               <CardContent className="p-6 space-y-4 text-start cursor-pointer" onClick={() => router.push(`/dashboard/construction/field-visits/${visit.id}`)}>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'العميل المالك' : 'Client Name'}</p>
                     <h4 className="font-black text-base text-slate-800 truncate">{visit.clientName}</h4>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                     <UserCircle className="h-3.5 w-3.5 text-primary" />
                     <span className="text-[10px] font-bold text-slate-500">{visit.engineerName}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 py-2 bg-slate-50/50 rounded-xl px-4">
                     <div className="flex items-center gap-2">
                        <LayoutGrid className="h-3 w-3 text-blue-500" />
                        <span className="text-[10px] font-black text-slate-700">{visit.items?.length || 0} {isRtl ? 'بنود' : 'Items'}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Camera className="h-3 w-3 text-orange-500" />
                        <span className="text-[10px] font-black text-slate-700">{visit.items?.reduce((acc: number, i: any) => acc + (i.photoUrls?.length || 0), 0)} {isRtl ? 'صور' : 'Photos'}</span>
                     </div>
                  </div>
               </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
