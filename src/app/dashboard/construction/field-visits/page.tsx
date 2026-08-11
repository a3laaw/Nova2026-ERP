'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, Loader2, ArrowRight,
  Filter, Calendar, FileText
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { paths } from '@/firebase/multi-tenant';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <div className="space-y-6 w-full animate-in fade-in duration-500 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <FileText className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('construction.reports')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">{t('construction.reportsDesc')}</p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/construction/field-visits/new')} className="h-11 px-8 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 gap-2 border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
          <Plus className="h-5 w-5" /> {t('construction.newReport')}
        </Button>
      </header>

      <Card className="rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder={t('common.search')} 
              className="ps-12 h-12 rounded-xl border-slate-200 bg-white text-sm font-bold shadow-inner" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl font-black text-xs border-2">
             <Filter className="h-4 w-4 me-2" /> {t('common.filter')}
          </Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
           {loading ? (
             <div className="py-32 text-center flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary/20" />
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Indexing Reports Hub...</p>
             </div>
           ) : filtered.length === 0 ? (
             <div className="py-32 text-center opacity-30 italic font-black text-xl text-slate-400">
                {t('common.noResults')}
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
               {filtered.map((visit) => (
                 <Card 
                   key={visit.id} 
                   className="rounded-[2rem] border-2 border-slate-50 bg-white overflow-hidden group hover:shadow-2xl hover:border-primary/20 transition-all cursor-pointer"
                   onClick={() => router.push(`/dashboard/construction/field-visits/${visit.id}`)}
                 >
                    <CardHeader className="bg-slate-50/50 p-5 border-b flex flex-row justify-between items-center">
                       <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span className="font-black text-[10px] text-slate-500 uppercase tracking-tighter">{visit.visitDate}</span>
                       </div>
                       <Badge variant="outline" className="text-[8px] font-black uppercase border-2 px-3 h-5 bg-white">{visit.status}</Badge>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-start">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest">{visit.clientName}</p>
                          <h4 className="font-black text-base text-slate-800 line-clamp-1">{visit.activeStageName || 'General Progress'}</h4>
                          <p className="text-[10px] font-bold text-slate-400">REF: {visit.transactionNumber}</p>
                       </div>
                       <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                             <Avatar className="h-7 w-7 rounded-lg border-2 border-white shadow-sm">
                                <AvatarFallback className="bg-primary/5 text-primary font-black text-[9px]">{visit.engineerName?.charAt(0)}</AvatarFallback>
                             </Avatar>
                             <span className="text-[10px] font-black text-slate-600 truncate max-w-[120px]">{visit.engineerName}</span>
                          </div>
                          <ArrowRight className={cn("h-4 w-4 text-slate-200 group-hover:text-primary transition-all", isRtl && "rotate-180")} />
                       </div>
                    </CardContent>
                 </Card>
               ))}
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
