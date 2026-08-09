'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Gavel, Plus, Search, Loader2, ArrowRight,
  Filter, Calendar, FileText, UserCircle, Wallet,
  ShieldCheck, ArrowUpRight, CheckCircle2, Clock
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Contract } from '@/types/documents';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function GlobalContractsPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");

  const contractsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.contracts(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: contracts, loading } = useCollection<Contract>(contractsQuery);

  const filtered = (contracts || []).filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    return {
      total: contracts?.length || 0,
      paid: contracts?.filter(c => c.status === 'paid' || c.isPaid).length || 0,
      pending: contracts?.filter(c => c.status !== 'paid' && !c.isPaid).length || 0,
      totalValue: contracts?.reduce((acc, c) => acc + (c.totalAmount || 0), 0) || 0
    };
  }, [contracts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Gavel className="h-10 w-10 text-primary" />
            {t('contracts')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {t('procurement.unifiedContractsView')}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/clients')}
          className="bg-primary text-white font-black rounded-xl h-11 px-8 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('procurement.issueContract')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
               <Wallet className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('hr.reports.payroll.individualTitle')}</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {stats.totalValue.toLocaleString()} <span className="text-xs">KWD</span>
            </h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all border-b-4 border-b-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('status.active_paid')}</p>
            <h3 className="text-3xl font-black text-emerald-600">{stats.paid}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all border-b-4 border-b-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('status.pending')}</p>
            <h3 className="text-3xl font-black text-blue-600">{stats.pending}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-xl p-6 text-start bg-white group hover:scale-[1.02] transition-all border-b-4 border-b-slate-900">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('hr.reports.totalLogs')}</p>
            <h3 className="text-3xl font-black text-slate-900">{stats.total}</h3>
         </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={t('procurement.searchContracts')} 
                className="ps-12 rounded-xl h-11 bg-white border-slate-200 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow>
                <TableHead className="py-5 ps-8 text-start">{t('procurement.contractClient')}</TableHead>
                <TableHead className="text-start">{t('common.date')}</TableHead>
                <TableHead className="text-end">{t('hr.reports.totalEntitled')}</TableHead>
                <TableHead className="text-center">{t('procurement.financeStatus')}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-400 font-bold italic">{t('common.noResults')}</TableCell></TableRow>
              ) : (
                filtered.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-primary/[0.02] transition-colors group cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/clients/${contract.clientId}/contracts/${contract.id}`)}>
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-11 w-11 rounded-xl flex items-center justify-center shadow-inner",
                            (contract.status === 'paid' || contract.isPaid) ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                          )}>
                             <Gavel className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <p className="font-black text-slate-800 text-sm leading-tight">{contract.name}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
                                <UserCircle className="h-2.5 w-2.5" /> {contract.clientName}
                             </p>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {contract.createdAt?.toDate().toLocaleDateString()}
                       </div>
                    </TableCell>
                    <TableCell className="text-end font-mono font-black text-slate-900">
                       {contract.totalAmount?.toLocaleString()} <span className="text-[9px] text-slate-400">KWD</span>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge className={cn(
                         "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[8px] gap-1",
                         (contract.status === 'paid' || contract.isPaid) ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                       )}>
                          {(contract.status === 'paid' || contract.isPaid) ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                          {(contract.status === 'paid' || contract.isPaid) ? t('status.paid') : t('status.pending')}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 transition-all group-hover:bg-primary group-hover:text-white">
                          <ArrowUpRight className="h-5 w-5" />
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
