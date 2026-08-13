
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, Loader2, ArrowRight, 
  Handshake, ShieldCheck, 
  Building2, ArrowUpRight, CheckCircle2, Clock,
  Filter, Info
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

export default function SubConContractsListPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");

  const contractsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subconContracts(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: contracts, loading: contractsLoading } = useCollection<any>(contractsQuery);

  const filteredContracts = (contracts || []).filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.subcontractorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 text-start">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {tSafe('subcon.authorizedPortal', 'بوابة العقود المعتمدة', 'Authorized Contracts Portal')}
           </div>
           <h1 className="text-3xl font-black font-headline text-slate-900">{tSafe('subcon.contracts.title', 'عقود مقاولي الباطن', 'SubCon Contracts')}</h1>
           <p className="text-muted-foreground text-xs font-bold opacity-70 italic text-start">
              {tSafe('subcon.contracts.desc', 'إدارة وتتبع كافة الاتفاقيات المبرمة مع القوى العاملة الخارجية والارتباطات المالية للمشاريع.', 'Manage and track all external labor agreements and project financial links.')}
           </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/procurement/subcontractors/contracts/new')}
          className="h-11 px-8 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all gap-2 border-b-4 border-orange-700"
        >
          <Plus className="h-4 w-4" />
          {tSafe('subcon.contracts.issue', 'إصدار اتفاقية باطن', 'Issue SubCon Award')}
        </Button>
      </header>

      <Card className="rounded-[2rem] border-0 shadow-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-6 text-start">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={tSafe('subcon.contracts.search', 'بحث في العقود المبرمة...', 'Search executed contracts...')} 
                className="ps-12 rounded-2xl h-11 bg-white border-2 border-slate-100 font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase tracking-widest">{tSafe('common.name', 'الاسم', 'Name')}</TableHead>
                <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{tSafe('common.vendor', 'المقاول', 'Vendor')}</TableHead>
                <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{tSafe('common.amount', 'المبلغ', 'Amount')}</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('common.status', 'الحالة', 'Status')}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredContracts.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-black italic">{tSafe('subcon.contracts.empty', 'لا توجد عقود باطن مسجلة حالياً.', 'No SubCon contracts found.')}</TableCell></TableRow>
              ) : filteredContracts.map((contract) => (
                <TableRow key={contract.id} className="hover:bg-slate-50 transition-colors group border-b-slate-100 cursor-pointer" onClick={() => router.push(`/dashboard/procurement/subcontractors/contracts/${contract.id}`)}>
                   <TableCell className="py-6 ps-10 text-start">
                      <div className="flex items-center gap-4 text-start">
                         <div className="h-11 w-11 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary border-2 border-primary/5">
                            <Handshake className="h-6 w-6" />
                         </div>
                         <div className="text-start">
                            <p className="font-black text-slate-800 text-sm leading-tight">{contract.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{contract.projectTitle}</p>
                         </div>
                      </div>
                   </TableCell>
                   <TableCell className="text-start">
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-600">
                         <Building2 className="h-3 w-3 opacity-30" /> {contract.subcontractorName}
                      </div>
                   </TableCell>
                   <TableCell className="text-end">
                      <span className="font-mono font-black text-emerald-600">
                         {contract.totalAmount?.toLocaleString()} <span className="text-[10px] opacity-40">KWD</span>
                      </span>
                   </TableCell>
                   <TableCell className="text-center">
                      <Badge className={cn(
                        "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[8px]",
                        contract.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                      )}>
                         {contract.status}
                      </Badge>
                   </TableCell>
                   <TableCell className="pe-10 text-end">
                      <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-300 group-hover:text-primary transition-all">
                         <ArrowUpRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
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
