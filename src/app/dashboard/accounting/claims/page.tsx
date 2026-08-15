'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, Search, Loader2, Filter, ArrowUpRight, Clock, CheckCircle2, ShieldCheck } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function GlobalOwnerClaimsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");

  const ipcsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.ipcs(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: ipcs, loading } = useCollection<any>(ipcsQuery);

  const filtered = (ipcs || []).filter(i => 
    i.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.ipcNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 text-start">
        <div className="text-start space-y-1">
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
            <Receipt className="h-3 w-3" /> {isRtl ? 'المطالبات المالية السيادية' : 'Sovereign Financial Claims'}
          </div>
          <h1 className="text-3xl font-black font-headline text-slate-900">{t('ownerClaims')}</h1>
        </div>
      </header>

      <Card className="rounded-2xl border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5 text-start">
        <div className="p-4 bg-slate-50/50 border-b flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="relative w-full max-w-md text-start">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-11 h-11 rounded-xl bg-white border-slate-200 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="py-5 ps-10 text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'المستخلص / العميل' : 'IPC # / Client'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-end">{isRtl ? 'الإجمالي' : 'Gross'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-rose-500 tracking-widest text-end">{isRtl ? 'المحتجزات (5%)' : 'Retention'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-emerald-600 tracking-widest text-end">{isRtl ? 'المستحق الصافي' : 'Net Payable'}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">{t('common.status')}</TableHead>
                <TableHead className="pe-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-24 text-slate-300 font-black italic">{t('common.noResults')}</TableCell></TableRow>
              ) : filtered.map((ipc) => (
                <TableRow key={ipc.id} className="hover:bg-primary/[0.01] border-b-slate-50 cursor-pointer group" onClick={() => router.push(`/dashboard/clients/${ipc.clientId}/transactions/${ipc.transactionId}?tab=documents`)}>
                   <TableCell className="py-6 ps-10">
                      <div className="flex items-center gap-4 text-start">
                         <div className="h-11 w-11 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black shadow-inner border border-primary/10">
                            IPC
                         </div>
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm leading-tight">{ipc.ipcNumber}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{ipc.clientName}</p>
                         </div>
                      </div>
                   </TableCell>
                   <TableCell className="text-end font-mono font-bold text-slate-500">
                      {ipc.grossAmount?.toLocaleString()}
                   </TableCell>
                   <TableCell className="text-end font-mono font-black text-rose-600 bg-rose-50/20">
                      -{ipc.retentionAmount?.toLocaleString()}
                   </TableCell>
                   <TableCell className="text-end font-mono font-black text-emerald-600 text-lg">
                      {ipc.netPayable?.toLocaleString()} <span className="text-[9px] opacity-40">KWD</span>
                   </TableCell>
                   <TableCell className="text-center">
                      <Badge className={cn(
                        "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[8px] gap-1",
                        ipc.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      )}>
                         {ipc.status === 'approved' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                         {ipc.status}
                      </Badge>
                   </TableCell>
                   <TableCell className="pe-10 text-end">
                      <Button variant="ghost" size="icon" className="rounded-xl transition-all group-hover:bg-primary group-hover:text-white">
                         <ArrowUpRight className="h-5 w-5" />
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
