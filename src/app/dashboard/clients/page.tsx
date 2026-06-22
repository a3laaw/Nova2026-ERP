'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, UserPlus, Search, Loader2, ArrowRight, 
  Phone, MapPin, Filter, ShieldCheck, Activity, TrendingUp
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';
import { canPerformOnRecord } from '@/lib/permissions/engine';

export default function ClientsListPage() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const viewAccess = check('crm', 'view');
  const canCreate = check('crm', 'create').can;

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: rawClients, loading } = useCollection<Client>(clientsQuery);

  const clients = useMemo(() => {
    if (!viewAccess.can || !rawClients) return [];
    return rawClients.filter(client => {
      const term = searchTerm.toLowerCase();
      const matchSearch = client.nameAr?.toLowerCase().includes(term) || 
                          client.mobile?.includes(term) ||
                          client.fileNumber?.toLowerCase().includes(term);
      if (!matchSearch) return false;
      return canPerformOnRecord(viewAccess, { uid: user?.uid || '', departmentId: globalUser?.departmentId }, { createdBy: client.createdBy, departmentId: (client as any).departmentId });
    });
  }, [rawClients, viewAccess, globalUser, user, searchTerm]);

  const stats = useMemo(() => {
    if (!clients) return { total: 0, contracted: 0, prospective: 0, activeTrans: 0 };
    return {
      total: clients.length,
      contracted: clients.filter(c => c.status === 'contracted').length,
      prospective: clients.filter(c => c.status === 'prospective').length,
      activeTrans: clients.reduce((acc, c) => acc + (c.transactionCounter || 0), 0)
    };
  }, [clients]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start space-y-1">
           <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full w-fit">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'إدارة الأصول التجارية' : 'CRM Engine'}
           </div>
           <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight">
             {isRtl ? 'قاعدة بيانات العملاء' : 'Clients Database'}
           </h1>
        </div>

        {canCreate && (
          <Button 
            onClick={() => router.push('/dashboard/clients/new')}
            className="bg-primary text-white font-black rounded-xl h-12 px-6 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {isRtl ? 'تسجيل عميل جديد' : 'Register'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: isRtl ? 'إجمالي الملفات' : 'Total', val: stats.total, icon: Users, color: 'text-slate-500', bg: 'bg-slate-50' },
           { label: isRtl ? 'عقود نشطة' : 'Contracted', val: stats.contracted, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: isRtl ? 'فرص تسجيل' : 'Prospective', val: stats.prospective, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: isRtl ? 'معاملات' : 'Transactions', val: stats.activeTrans, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' }
         ].map((s, i) => (
           <Card key={i} className="border-0 shadow-sm rounded-2xl p-4 text-start bg-white">
              <div className={cn("p-2 rounded-lg w-fit mb-2", s.bg, s.color)}>
                 <s.icon className="h-4 w-4" />
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <h3 className={cn("text-xl font-black font-headline", s.color)}>{s.val}</h3>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-xl rounded-3xl bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <CardHeader className="bg-slate-50/50 border-b p-4 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                placeholder={isRtl ? 'بحث باسم العميل، الهاتف...' : 'Search...'} 
                className="w-full ps-11 pe-4 rounded-xl h-10 bg-white border border-slate-200 focus:border-primary/40 text-sm font-bold outline-none transition-all" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <Button variant="outline" size="sm" className="rounded-lg h-9 border-slate-200 gap-2 text-xs font-bold">
              <Filter className="h-3.5 w-3.5" /> {isRtl ? 'فلترة' : 'Filter'}
           </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">{isRtl ? 'رقم الملف / العميل' : 'File / Client'}</TableHead>
                <TableHead>{isRtl ? 'الاتصال' : 'Contact'}</TableHead>
                <TableHead>{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'المعاملات' : 'Trans'}</TableHead>
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : clients.map((client) => (
                <TableRow key={client.id} className="hover:bg-primary/[0.02] transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-6">
                     <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                           {client.fileNumber.split('-')[1]?.split('/')[0] || '??'}
                        </div>
                        <div className="text-start">
                           <p className="font-black text-sm text-slate-900">{isRtl ? client.nameAr : client.nameEn || client.nameAr}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase">{client.fileNumber}</p>
                        </div>
                     </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex flex-col">
                        <span className="font-bold text-xs text-slate-700">{client.mobile}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{client.areaName || '---'}</span>
                     </div>
                  </TableCell>
                  <TableCell>
                     <Badge className={cn(
                       "font-black px-2 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[8px]",
                       client.status === 'contracted' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                     )}>{client.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                     <span className="h-7 w-7 rounded-lg bg-slate-50 border border-white shadow-inner inline-flex items-center justify-center font-black text-slate-900 text-xs">
                        {client.transactionCounter || 0}
                     </span>
                  </TableCell>
                  <TableCell className="pe-6 text-end">
                     <Button variant="ghost" size="icon" className="rounded-lg group-hover:bg-primary group-hover:text-white transition-all h-8 w-8">
                        <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-0", isRtl && "rotate-180")} />
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
