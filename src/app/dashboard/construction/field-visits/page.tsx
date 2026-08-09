
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Search, Loader2, ArrowRight,
  Filter, Calendar
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { paths } from '@/firebase/multi-tenant';

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
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-start">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-bold text-slate-900">
             {t('construction.reports')}
           </h1>
           <p className="text-xs text-muted-foreground font-medium opacity-80">
              {t('construction.reportsDesc')}
           </p>
        </div>
        <Button onClick={() => router.push('/dashboard/construction/field-visits/new')} size="sm" className="h-9 px-4 font-bold rounded-md shadow-sm">
          <Plus className="h-4 w-4 me-2" /> {t('construction.newReport')}
        </Button>
      </div>

      <Card className="rounded-lg shadow-sm border border-slate-100 overflow-hidden bg-white">
        <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t('common.search')} 
              className="ps-9 h-9 rounded-md border-slate-200 bg-white text-sm font-medium" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 px-3 rounded-md font-bold text-xs border-slate-200">
             <Filter className="h-3.5 w-3.5 me-2" /> {t('common.filter')}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center opacity-30 italic font-bold">No reports found.</div>
        ) : (
          filtered.map((visit) => (
            <Card key={visit.id} className="rounded-lg border shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all cursor-pointer" onClick={() => router.push(`/dashboard/construction/field-visits/${visit.id}`)}>
               <CardHeader className="bg-slate-50 p-3 border-b flex flex-row justify-between items-center">
                  <div className="flex items-center gap-2">
                     <Calendar className="h-3 w-3 text-primary" />
                     <span className="font-bold text-[10px] text-slate-600">{visit.visitDate}</span>
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase border-0">{visit.status}</Badge>
               </CardHeader>
               <CardContent className="p-4 space-y-3 text-start">
                  <div className="space-y-0.5">
                     <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{visit.clientName}</p>
                     <h4 className="font-bold text-xs text-slate-800 truncate">{visit.transactionNumber}</h4>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                     <span className="text-[9px] font-bold text-slate-500 truncate">{visit.engineerName}</span>
                     <ArrowRight className={cn("h-3.5 w-3.5 text-slate-300", isRtl && "rotate-180")} />
                  </div>
               </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
