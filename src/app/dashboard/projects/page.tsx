
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  HardHat, Plus, Search, Loader2, ArrowRight,
  Filter, Building2, Activity, PlayCircle, CheckCircle2,
  DollarSign, TrendingUp, Wallet
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

  const stats = useMemo(() => ({
      total: filteredProjects.length,
      active: filteredProjects.filter(p => p.status !== 'completed').length,
      completed: filteredProjects.filter(p => p.status === 'completed').length
  }), [filteredProjects]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <HardHat className="h-10 w-10 text-primary" />
            {isRtl ? 'رادار المشاريع والفوترة' : 'Projects & Billing Radar'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'تتبع الإنجاز الميداني وتحويله لمطالبات مالية (IPCs) بشكل آلي.' : 'Track field progress and auto-generate IPCs.'}
          </p>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setActiveFilter(activeFilter === 'all' ? 'contracting' : 'all')}
            className={cn("h-12 px-6 rounded-xl font-black border-2", activeFilter === 'contracting' ? "bg-primary/10 border-primary text-primary" : "bg-white")}
          >
            <TrendingUp className="h-4 w-4" />
            {isRtl ? 'المقاولات (فوترة كميات)' : 'Contracting Billing'}
          </Button>
          <Button onClick={() => router.push('/dashboard/clients')} className="h-12 px-8 rounded-xl shadow-xl">
            <Plus className="h-5 w-5" /> {isRtl ? 'بدء مشروع' : 'New Project'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 bg-white flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي المحفظة' : 'Total Portfolio'}</p>
               <h3 className="text-3xl font-black text-slate-900">2.4M <span className="text-xs">KWD</span></h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center"><Wallet className="h-6 w-6" /></div>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 bg-white flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'مطالبات قيد المراجعة' : 'Pending Claims'}</p>
               <h3 className="text-3xl font-black text-blue-600">12</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Activity className="h-6 w-6" /></div>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2rem] p-6 bg-white flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="text-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'نسبة التحصيل' : 'Collection Rate'}</p>
               <h3 className="text-3xl font-black text-emerald-600">88%</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="h-6 w-6" /></div>
         </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#F4F6F9] border-b">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'المشروع / العميل' : 'Project / Client'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الإنجاز الفني' : 'Progress'}</TableHead>
                <TableHead className="text-end">{isRtl ? 'المطالبات المالية' : 'Interim Billing'}</TableHead>
                <TableHead className="text-start">{t('status')}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filteredProjects.map((proj) => (
                <TableRow key={proj.id} className="hover:bg-primary/[0.02] cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/clients/${proj.clientId}/transactions/${proj.id}`)}>
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-5">
                          <div className={cn("h-12 w-12 rounded-2xl shadow-sm flex items-center justify-center font-black", proj.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary")}>
                             <Building2 className="h-6 w-6" />
                          </div>
                          <div className="text-start">
                             <span className="font-black text-slate-800 text-lg block leading-none">{proj.subServiceName}</span>
                             <span className="text-[10px] font-bold text-slate-400 mt-2 block">{proj.clientName}</span>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-blue-50 text-blue-600 font-black text-[9px] uppercase px-3">42% Executed</Badge>
                       </div>
                    </TableCell>
                    <TableCell className="text-end">
                       <div className="flex flex-col text-end">
                          <span className="font-black text-sm text-slate-800">15,400 <span className="text-[8px] opacity-40">KWD</span></span>
                          <span className="text-[8px] font-bold text-emerald-600 uppercase">3 IPCs Issued</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn("font-black px-4 py-1 rounded-xl border-0 shadow-sm uppercase text-[9px]", proj.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{proj.status}</Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                      <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-10 w-10">
                        <ArrowRight className={cn("h-6 w-6", isRtl && "rotate-180")} />
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
