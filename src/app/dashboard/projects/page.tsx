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
  Wallet, Activity, Filter, HardHat
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
      const isContracting = p.activityTypeName?.toLowerCase().includes('مقاولات') || p.activityTypeName?.toLowerCase().includes('construction');
      const matchType = activeFilter === 'all' || isContracting;
      return matchSearch && matchType;
    });
  }, [allTransactions, searchTerm, activeFilter]);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500" dir={dir}>
      {/* Sovereign Header Design (H-14) */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="flex items-center gap-4 text-start">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <HardHat className="h-8 w-8" />
          </div>
          <div className="text-start">
            <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{t('projects')}</h1>
            <p className="text-xs font-bold text-muted-foreground italic mt-0.5 text-start">
               {t('projects.description')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'all' ? 'contracting' : 'all')}
            className={cn(
              "h-11 px-6 rounded-xl font-bold text-xs border flex items-center transition-all", 
              activeFilter === 'contracting' ? "bg-primary/10 border-primary text-primary" : "bg-white border-slate-200"
            )}
          >
            <TrendingUp className="h-4 w-4 me-2" />
            {t('projects.contracting')}
          </button>
          <Button onClick={() => router.push('/dashboard/clients')} size="sm" className="h-11 px-6 rounded-xl font-black shadow-lg shadow-primary/20 transition-all">
            <Plus className="h-4 w-4 me-2" /> {t('common.add')}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="rounded-xl shadow-sm border p-6 bg-white flex items-center justify-between group hover:shadow-md transition-all text-start">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('projects.stats.portfolio')}</p>
               <h3 className="text-2xl font-black text-slate-900 mt-1">2.4M <span className="text-xs font-bold text-slate-400">{t('dashboard.units.kwd')}</span></h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shrink-0"><Wallet className="h-6 w-6" /></div>
         </Card>
         <Card className="rounded-xl shadow-sm border p-6 bg-white flex items-center justify-between group hover:shadow-md transition-all text-start">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dashboard.stats.activeprojects')}</p>
               <h3 className="text-2xl font-black text-blue-600 mt-1">12</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Activity className="h-6 w-6" /></div>
         </Card>
         <Card className="rounded-xl shadow-sm border p-6 bg-white flex items-center justify-between group hover:shadow-md transition-all text-start">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('reports.stats.attendance')}</p>
               <h3 className="text-2xl font-black text-emerald-600 mt-1">88%</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 className="h-6 w-6" /></div>
         </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
        <div className="p-4 bg-slate-50/30 border-b flex items-center justify-between">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input placeholder={t('common.search')} className="ps-11 h-11 border-2 border-slate-100 bg-white font-bold rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs border-2"><Filter className="h-4 w-4 me-2" /> {t('common.filter')}</Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b-0">
                <TableHead className="py-5 ps-8 text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'المشروع' : 'Project'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الإنجاز' : 'Progress'}</TableHead>
                <TableHead className="text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'الفوترة' : 'Billing'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 italic text-slate-300 font-black">{t('common.noresults')}</TableCell></TableRow>
              ) : filteredProjects.map((proj) => (
                <TableRow key={proj.id} className="hover:bg-primary/[0.01] cursor-pointer border-b-slate-100 group" onClick={() => router.push(`/dashboard/clients/${proj.clientId}/transactions/${proj.id}`)}>
                    <TableCell className="py-5 ps-8 text-start">
                       <div className="flex items-center gap-4">
                          <div className={cn("h-11 w-11 rounded-xl shadow-inner border flex items-center justify-center shrink-0", proj.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary border-primary/10")}>
                             <Building2 className="h-6 w-6" />
                          </div>
                          <div className="text-start truncate">
                             <span className="font-black text-slate-800 text-sm block leading-none truncate">{proj.subServiceName}</span>
                             <span className="text-[10px] text-slate-400 font-bold mt-1.5 block truncate uppercase">CLIENT: {proj.clientName}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="bg-blue-50 text-blue-600 font-black text-[9px] uppercase px-4 h-6 border-0 shadow-sm">
                          PROGRESS 42%
                       </Badge>
                    </TableCell>
                    <TableCell className="text-end pe-4">
                       <div className="flex flex-col text-end">
                          <span className="font-black text-sm text-slate-900">15,400 <span className="text-[8px] opacity-40">{t('dashboard.units.kwd')}</span></span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-3 py-1 rounded-lg border-0 shadow-sm text-[9px] uppercase", 
                         proj.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                       )}>
                          {t('common.status')}: {proj.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 group-hover:text-primary transition-all rounded-xl">
                        <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
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
