
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Search, Loader2, ArrowRight,
  TrendingUp, Building2, CheckCircle2,
  Wallet, Activity, Filter
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;
  const isRtl = lang === 'ar';

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'contracting'>('all');

  const transactionsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.transactions(companyId)), orderBy('createdAt', 'desc'));
  }, [db, companyId]);

  const { data: allTransactions, loading } = useCollection<Transaction>(transactionsQuery);

  const filteredProjects = useMemo(() => {
    if (!allTransactions) return [];
    return allTransactions.filter(p => {
      const matchSearch = p.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.subServiceName?.toLowerCase().includes(searchTerm.toLowerCase());
      const isContracting = p.activityTypeName?.includes('مقاولات') || p.activityTypeName?.includes('Construction');
      const matchType = activeFilter === 'all' || isContracting;
      return matchSearch && matchType;
    });
  }, [allTransactions, searchTerm, activeFilter]);

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {t('projects.title')}
          </h1>
        </div>

        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'all' ? 'contracting' : 'all')}
            className={cn(
              "h-9 px-4 rounded-md font-bold text-xs border flex items-center transition-all", 
              activeFilter === 'contracting' ? "bg-primary/10 border-primary text-primary" : "bg-white border-slate-200"
            )}
          >
            <TrendingUp className="h-4 w-4 me-2" />
            {t('projects.contracting')}
          </button>
          <Button onClick={() => router.push('/dashboard/clients')} size="sm" className="h-9 px-4 rounded-md font-bold text-xs shadow-sm">
            <Plus className="h-4 w-4 me-2" /> {t('projects.addNew')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="rounded-lg shadow-sm border p-4 bg-white flex items-center justify-between group hover:shadow-md transition-all">
            <div className="text-start">
               <p className="text-[10px] font-bold text-slate-400 uppercase">{t('projects.stats.portfolio')}</p>
               <h3 className="text-xl font-bold text-slate-900">2.4M <span className="text-xs font-medium text-slate-400">KWD</span></h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0"><Wallet className="h-5 w-5" /></div>
         </Card>
         <Card className="rounded-lg shadow-sm border p-4 bg-white flex items-center justify-between group hover:shadow-md transition-all">
            <div className="text-start">
               <p className="text-[10px] font-bold text-slate-400 uppercase">{t('projects.stats.claims')}</p>
               <h3 className="text-xl font-bold text-blue-600">12</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Activity className="h-5 w-5" /></div>
         </Card>
         <Card className="rounded-lg shadow-sm border p-4 bg-white flex items-center justify-between group hover:shadow-md transition-all">
            <div className="text-start">
               <p className="text-[10px] font-bold text-slate-400 uppercase">{t('projects.stats.collection')}</p>
               <h3 className="text-xl font-bold text-emerald-600">88%</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
         </Card>
      </div>

      <Card className="rounded-lg shadow-sm border overflow-hidden bg-white">
        <div className="p-3 bg-slate-50/30 border-b flex items-center justify-between">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder={t('common.search')} className="ps-9 h-9 rounded-md bg-white border-slate-200 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <Button variant="outline" size="sm" className="h-9 px-4 border-slate-200 font-bold text-xs"><Filter className="h-3.5 w-3.5 me-2" /> {t('common.filter')}</Button>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b-0">
                <TableHead className="py-3 ps-6 text-[10px] font-bold uppercase text-slate-500">{t('projects.table.project')}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{t('projects.table.progress')}</TableHead>
                <TableHead className="text-end text-[10px] font-bold uppercase text-slate-500">{t('projects.table.billing')}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{t('common.status')}</TableHead>
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 text-sm font-bold">{t('projects.noActiveProjects')}</TableCell></TableRow>
              ) : filteredProjects.map((proj) => (
                <TableRow key={proj.id} className="hover:bg-slate-50/50 cursor-pointer border-b-slate-100 group" onClick={() => router.push(`/dashboard/clients/${proj.clientId}/transactions/${proj.id}`)}>
                    <TableCell className="py-2.5 ps-6 text-start">
                       <div className="flex items-center gap-3">
                          <div className={cn("h-10 w-10 rounded-lg shadow-sm flex items-center justify-center shrink-0", proj.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary")}>
                             <Building2 className="h-5 w-5" />
                          </div>
                          <div className="text-start truncate">
                             <span className="font-bold text-slate-800 text-sm block leading-none truncate">{proj.subServiceName}</span>
                             <span className="text-[10px] text-slate-400 font-medium mt-1.5 block truncate">{proj.clientName}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="bg-blue-50/50 text-blue-600 font-bold text-[9px] uppercase px-2 h-5 border-0">42% Done</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                       <div className="flex flex-col text-end">
                          <span className="font-bold text-xs text-slate-900">15,400 <span className="text-[8px] opacity-40">KWD</span></span>
                          <span className="text-[8px] font-bold text-emerald-600">3 IPCs</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn("font-bold px-2 h-5 rounded-md border-0 text-[9px] uppercase", proj.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{proj.status}</Badge>
                    </TableCell>
                    <TableCell className="pe-6 text-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 rounded-md">
                        <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                      </Button>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
