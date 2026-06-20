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
  Phone, MapPin, Filter, MoreHorizontal, FileText
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';

export default function ClientsListPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: clients, loading } = useCollection<Client>(clientsQuery);

  const filtered = clients?.filter(c => 
    c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.mobile.includes(searchTerm) ||
    c.fileNumber.includes(searchTerm)
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-start space-y-1">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Users className="h-10 w-10 text-primary" />
            {isRtl ? 'قاعدة بيانات العملاء' : 'Clients Database'}
          </h1>
          <p className="text-muted-foreground text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة الأصول التجارية والعلاقات مع طالبي الخدمة' : 'Manage commercial assets and client relationships'}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/clients/new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all gap-2"
        >
          <UserPlus className="h-6 w-6" />
          {isRtl ? 'عميل جديد' : 'New Client'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: isRtl ? 'إجمالي الملفات' : 'Total Files', val: clients?.length || 0, color: 'text-slate-900' },
           { label: isRtl ? 'العملاء المتعاقدين' : 'Contracted', val: clients?.filter(c => c.status === 'contracted').length || 0, color: 'text-emerald-600' },
           { label: isRtl ? 'فرص قيد التسجيل' : 'Prospective', val: clients?.filter(c => c.status === 'prospective').length || 0, color: 'text-blue-600' },
           { label: isRtl ? 'المعاملات النشطة' : 'Active Trans', val: clients?.reduce((acc, c) => acc + (c.transactionCounter || 0), 0) || 0, color: 'text-amber-600' },
         ].map((stat, i) => (
           <Card key={i} className="border-0 shadow-lg rounded-[2rem] p-6 text-start bg-white group hover:shadow-xl transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className={cn("text-4xl font-black font-headline", stat.color)}>{stat.val}</h3>
           </Card>
         ))}
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={isRtl ? 'بحث برقم الملف، اسم العميل، أو الهاتف...' : 'Search by name, file, or phone...'} 
                className="ps-12 rounded-2xl h-14 bg-white border-2 border-slate-100 focus:border-primary/30 text-lg font-bold" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl font-bold h-12 border-2 px-6 gap-2"><Filter className="h-4 w-4" /> {isRtl ? 'فلترة' : 'Filter'}</Button>
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'رقم الملف / العميل' : 'File / Client'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الاتصال' : 'Contact'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'المعاملات' : 'Transactions'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-400 font-bold italic">{isRtl ? 'لا يوجد عملاء مطابقين للبحث.' : 'No clients found.'}</TableCell></TableRow>
              ) : (
                filtered.map((client) => (
                  <TableRow key={client.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                    <TableCell className="py-6 ps-8 text-start">
                       <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                             {client.fileNumber}
                          </div>
                          <div className="text-start">
                             <p className="font-black text-xl text-slate-800">{isRtl ? client.nameAr : client.nameEn || client.nameAr}</p>
                             <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase mt-1">
                                <MapPin className="h-3 w-3" /> {client.areaName || '---'}
                             </div>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex flex-col gap-1">
                          <span className="font-bold text-sm text-slate-700 flex items-center gap-2"><Phone className="h-3 w-3 text-primary" /> {client.mobile}</span>
                          {client.email && <span className="text-[10px] text-slate-400 font-mono">{client.email}</span>}
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                         client.status === 'contracted' ? 'bg-emerald-500 text-white' :
                         client.status === 'registered' ? 'bg-blue-500 text-white' :
                         client.status === 'prospective' ? 'bg-amber-500 text-white' :
                         'bg-slate-200 text-slate-600'
                       )}>
                          {client.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="h-10 w-10 rounded-xl bg-slate-50 border inline-flex items-center justify-center font-black text-slate-800">
                          {client.transactionCounter || 0}
                       </span>
                    </TableCell>
                    <TableCell className="pe-8 text-center">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
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
