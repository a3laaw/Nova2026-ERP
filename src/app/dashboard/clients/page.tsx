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
  Phone, MapPin, Filter, MoreHorizontal, FileText,
  ShieldCheck, Activity, TrendingUp
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

  // 1. فحص الصلاحيات الميدانية (CRM View & Create)
  const viewAccess = check('crm', 'view');
  const canCreate = check('crm', 'create').can;

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: rawClients, loading } = useCollection<Client>(clientsQuery);

  // 2. تطبيق منطق عزل البيانات (Data Scoping)
  const clients = useMemo(() => {
    if (!viewAccess.can || !rawClients) return [];

    return rawClients.filter(client => {
      // أ. فلترة البحث النصي
      const term = searchTerm.toLowerCase();
      const matchSearch = client.nameAr?.toLowerCase().includes(term) || 
                          client.mobile?.includes(term) ||
                          client.fileNumber?.toLowerCase().includes(term);
      
      if (!matchSearch) return false;

      // ب. تطبيق نطاق الوصول (Engine Enforcement)
      return canPerformOnRecord(
        viewAccess,
        { uid: user?.uid || '', departmentId: globalUser?.departmentId },
        { createdBy: client.createdBy, departmentId: (client as any).departmentId }
      );
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
    <div className="space-y-8 animate-in fade-in duration-700" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-2">
           <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full w-fit border border-primary/10">
              <ShieldCheck className="h-3 w-3" /> {isRtl ? 'محرك إدارة الأصول التجارية' : 'Commercial Asset Engine'}
           </div>
           <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">
             {isRtl ? 'قاعدة بيانات العملاء' : 'Clients Database'}
           </h1>
           <p className="text-muted-foreground text-sm font-bold opacity-70 italic">
             {viewAccess.scope === 'all' 
               ? (isRtl ? 'عرض شامل لكافة ملفات المنشأة' : 'Full enterprise-wide access') 
               : (isRtl ? 'عرض الملفات المرتبطة بنطاق عملك فقط' : 'Limited to your work scope only')}
           </p>
        </div>

        {canCreate && (
          <Button 
            onClick={() => router.push('/dashboard/clients/new')}
            className="bg-primary text-white font-black rounded-2xl px-8 py-8 text-xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-3 border-b-8 border-orange-700"
          >
            <UserPlus className="h-6 w-6" />
            {isRtl ? 'تسجيل عميل جديد' : 'Register Client'}
          </Button>
        )}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-0 shadow-xl rounded-[2.5rem] p-8 text-start bg-white group hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-slate-100 rounded-2xl text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors">
                  <Users className="h-6 w-6" />
               </div>
               <Badge variant="secondary" className="bg-slate-50 text-slate-400 font-black">Total</Badge>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الملفات' : 'Total Files'}</p>
            <h3 className="text-4xl font-black font-headline text-slate-900">{stats.total}</h3>
         </Card>

         <Card className="border-0 shadow-xl rounded-[2.5rem] p-8 text-start bg-white group hover:shadow-2xl transition-all border-b-8 border-emerald-500">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                  <TrendingUp className="h-6 w-6" />
               </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'عقود نشطة' : 'Contracted'}</p>
            <h3 className="text-4xl font-black font-headline text-emerald-600">{stats.contracted}</h3>
         </Card>

         <Card className="border-0 shadow-xl rounded-[2.5rem] p-8 text-start bg-white group hover:shadow-2xl transition-all border-b-8 border-blue-500">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                  <Activity className="h-6 w-6" />
               </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'فرص قيد التسجيل' : 'Prospective'}</p>
            <h3 className="text-4xl font-black font-headline text-blue-600">{stats.prospective}</h3>
         </Card>

         <Card className="border-0 shadow-xl rounded-[2.5rem] p-8 text-start bg-white group hover:shadow-2xl transition-all border-b-8 border-amber-500">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                  <FileText className="h-6 w-6" />
               </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'المعاملات الفنية' : 'Active Trans'}</p>
            <h3 className="text-4xl font-black font-headline text-amber-600">{stats.activeTrans}</h3>
         </Card>
      </div>

      {/* Main List Table */}
      <Card className="border-0 shadow-3xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="relative w-full max-w-xl">
              <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
              <input 
                placeholder={isRtl ? 'ابحث برقم الملف، اسم العميل، أو الهاتف...' : 'Search by name, file, or phone...'} 
                className="w-full ps-14 pe-6 rounded-2xl h-16 bg-white border-2 border-slate-100 focus:border-primary/40 text-lg font-bold outline-none transition-all shadow-inner" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-4 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-black h-14 border-2 px-8 gap-3 bg-white shadow-sm hover:bg-slate-50 transition-all text-slate-600">
                 <Filter className="h-5 w-5" /> {isRtl ? 'فلترة متقدمة' : 'Advanced Filter'}
              </Button>
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="py-8 ps-10 text-start font-black text-[#1e1b4b] uppercase text-[10px] tracking-widest">{isRtl ? 'رقم الملف / العميل' : 'File / Client'}</TableHead>
                <TableHead className="text-start font-black text-[#1e1b4b] uppercase text-[10px] tracking-widest">{isRtl ? 'الاتصال' : 'Contact'}</TableHead>
                <TableHead className="text-start font-black text-[#1e1b4b] uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-center font-black text-[#1e1b4b] uppercase text-[10px] tracking-widest">{isRtl ? 'المعاملات' : 'Trans'}</TableHead>
                <TableHead className="pe-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-14 w-14 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : clients.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black italic">{isRtl ? 'لا يوجد عملاء مطابقين للبحث.' : 'No matching clients found.'}</TableCell></TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-primary/[0.02] transition-colors group cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                    <TableCell className="py-8 ps-10 text-start">
                       <div className="flex items-center gap-6">
                          <div className="h-16 w-16 rounded-3xl bg-white shadow-xl flex items-center justify-center font-black text-slate-400 group-hover:text-primary border-2 border-slate-50 transition-all transform group-hover:scale-110">
                             {client.fileNumber}
                          </div>
                          <div className="text-start">
                             <p className="font-black text-2xl text-slate-900 tracking-tight">{isRtl ? client.nameAr : client.nameEn || client.nameAr}</p>
                             <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase mt-1">
                                <MapPin className="h-3 w-3 text-primary" /> {client.areaName || '---'}
                             </div>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col gap-1.5">
                          <span className="font-black text-base text-slate-700 flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-500" /> {client.mobile}</span>
                          {client.email && <span className="text-[10px] text-slate-400 font-mono font-bold">{client.email}</span>}
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1.5 rounded-xl border-0 shadow-lg uppercase text-[10px] tracking-widest",
                         client.status === 'contracted' ? 'bg-emerald-500 text-white' :
                         client.status === 'registered' ? 'bg-blue-500 text-white' :
                         client.status === 'prospective' ? 'bg-amber-400 text-white' :
                         'bg-slate-200 text-slate-600'
                       )}>
                          {client.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="h-12 w-12 rounded-2xl bg-slate-50 border-2 border-white shadow-inner inline-flex items-center justify-center font-black text-slate-900 text-lg">
                          {client.transactionCounter || 0}
                       </span>
                    </TableCell>
                    <TableCell className="pe-10 text-end">
                       <Button variant="ghost" size="icon" className="rounded-2xl group-hover:bg-primary group-hover:text-white transition-all h-12 w-12 shadow-sm border border-slate-50">
                          <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-0", isRtl && "rotate-180")} />
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
