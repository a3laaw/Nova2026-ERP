'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Search, Loader2, ArrowRight, Filter } from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';

export default function ClientsListPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: clients, loading } = useCollection<Client>(clientsQuery);

  const filtered = clients.filter(c => 
    c.nameAr?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.fileNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Users className="h-8 w-8 text-primary" />
             {isRtl ? 'قاعدة العملاء' : 'Clients Database'}
           </h1>
        </div>
        <Button onClick={() => router.push('/dashboard/clients/new')} variant="default" className="h-11 px-8">
          <UserPlus className="h-4 w-4 me-2" /> {isRtl ? 'تسجيل عميل' : 'New Client'}
        </Button>
      </div>

      {/* Independent Filter Card */}
      <Card className="border-0 shadow-sm rounded-xl bg-white mb-4 overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
              <Input 
                placeholder={isRtl ? 'بحث في قاعدة العملاء...' : 'Search database...'} 
                className="ps-12 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-bold" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
           <Button variant="outline" className="h-11 px-6 border-primary/20">
              <Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية النتائج' : 'Filter Results'}
           </Button>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-5 ps-8">{isRtl ? 'العميل' : 'Client'}</TableHead>
                <TableHead>{isRtl ? 'الهاتف' : 'Mobile'}</TableHead>
                <TableHead>{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد عملاء.' : 'No clients found.'}</TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="cursor-pointer group" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-8 py-5">
                     <div className="flex flex-col text-start">
                        <span className="font-black text-slate-800 text-sm leading-none">{client.nameAr}</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{client.fileNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell className="py-5 text-xs font-bold text-slate-600">{client.mobile}</TableCell>
                  <TableCell className="py-5">
                     <Badge variant="outline" className={cn(
                       "text-[9px] font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase", 
                       client.status === 'contracted' ? 'bg-[#039BE5]/10 text-[#039BE5]' : 'bg-[#FFA000]/10 text-[#FFA000]'
                     )}>
                        {client.status}
                     </Badge>
                  </TableCell>
                  <TableCell className="pe-8 text-end">
                     <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-9 w-9">
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