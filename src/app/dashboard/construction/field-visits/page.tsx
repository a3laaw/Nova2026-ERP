'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, Loader2, ArrowRight,
  Filter, Calendar, FileText, User, 
  MapPin, Clock, Hammer, ExternalLink
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { paths } from '@/firebase/multi-tenant';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function FieldVisitsListPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage(); 
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
      v.engineerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rawVisits, searchTerm]);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 text-start" dir={dir}>
      {/* Unified Header Design */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <FileText className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('fieldLogs')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">
              {isRtl ? 'الأرشيف المركزي لتقارير الإنجاز اليومية والزيارات الميدانية الموثقة.' : 'Central archive for daily progress reports and documented site visits.'}
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/construction/field-visits/new')} className="h-11 px-8 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 gap-2 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
          <Plus className="h-5 w-5" /> {isRtl ? 'تقرير ميداني جديد' : 'New Site Report'}
        </Button>
      </header>

      <Card className="rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
        {/* Search & Filter Bar */}
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
          <div className="relative w-full max-w-xl">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={isRtl ? 'بحث باسم العميل، المهندس، أو رقم المعاملة...' : 'Search client, engineer, or ref...'} 
              className="ps-11 h-11 rounded-xl border-slate-200 bg-white text-sm font-bold shadow-inner" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs border-2 bg-white">
               <Filter className="h-4 w-4 me-2 text-primary" /> {t('common.filter')}
            </Button>
            <Badge variant="secondary" className="bg-slate-900 text-white font-black h-11 px-5 rounded-xl text-sm shadow-lg">
               {filtered.length}
            </Badge>
          </div>
        </div>

        <CardContent className="p-0 overflow-x-auto">
           {loading ? (
             <div className="py-40 text-center flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary/20" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                  {isRtl ? 'جاري استدعاء السجلات الميدانية...' : 'Retrieving field records...'}
                </p>
             </div>
           ) : filtered.length === 0 ? (
             <div className="py-40 text-center opacity-30 italic font-black text-xl text-slate-400 flex flex-col items-center gap-6">
                <FileText className="h-20 w-20 text-slate-200" />
                {t('common.noResults')}
             </div>
           ) : (
             <Table>
               <TableHeader className="bg-slate-50/50">
                 <TableRow className="border-b-2 border-slate-100">
                   <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest w-[160px]">{t('common.date')}</TableHead>
                   <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-start">{isRtl ? 'العميل / المعاملة' : 'Client / Ref'}</TableHead>
                   <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-start">{isRtl ? 'مرحلة الإنجاز' : 'Work Stage'}</TableHead>
                   <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-start">{isRtl ? 'المهندس الموثق' : 'Engineer'}</TableHead>
                   <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center w-[120px]">{t('common.status')}</TableHead>
                   <TableHead className="pe-10 w-[80px]"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filtered.map((visit) => (
                   <TableRow 
                     key={visit.id} 
                     className="cursor-pointer group hover:bg-primary/[0.02] transition-all border-b-slate-100"
                     onClick={() => router.push(`/dashboard/construction/field-visits/${visit.id}`)}
                   >
                     <TableCell className="ps-10 py-5 text-start">
                        <div className="flex flex-col gap-1">
                           <span className="font-black text-slate-800 text-sm flex items-center gap-2">
                             <Calendar className="h-3 w-3 text-primary opacity-40" />
                             {visit.visitDate}
                           </span>
                           <span className="text-[8px] font-mono font-black text-slate-400 uppercase">ID: {visit.id.slice(-6).toUpperCase()}</span>
                        </div>
                     </TableCell>
                     <TableCell className="text-start">
                        <div className="flex flex-col text-start">
                           <span className="font-bold text-slate-800 text-sm leading-none">{visit.clientName}</span>
                           <span className="text-[9px] font-bold text-primary mt-1.5 uppercase tracking-tighter opacity-60">#{visit.transactionNumber}</span>
                        </div>
                     </TableCell>
                     <TableCell className="text-start">
                        <Badge variant="outline" className="bg-white border-2 border-slate-100 text-slate-600 font-black text-[9px] uppercase px-3 h-6 rounded-lg gap-2 shadow-sm">
                           <Hammer className="h-2.5 w-2.5 text-primary" />
                           {visit.activeStageName || tSafe('general.progress', 'التقدم العام', 'General Progress')}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-start">
                        <div className="flex items-center gap-3">
                           <Avatar className="h-8 w-8 rounded-xl border-2 border-white shadow-sm ring-1 ring-slate-100">
                              <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{visit.engineerName?.charAt(0)}</AvatarFallback>
                           </Avatar>
                           <span className="text-xs font-black text-slate-600">{visit.engineerName}</span>
                        </div>
                     </TableCell>
                     <TableCell className="text-center">
                        <Badge className={cn(
                          "font-black px-3 py-1 rounded-lg border-0 shadow-sm text-[8px] uppercase",
                          visit.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        )}>
                           {tSafe('status.' + visit.status, visit.status, visit.status)}
                        </Badge>
                     </TableCell>
                     <TableCell className="pe-10 text-end">
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-300 group-hover:text-primary group-hover:bg-primary/5 transition-all">
                           <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                        </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
