'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Search, Loader2, ArrowRight } from "lucide-react";
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
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Users className="h-8 w-8 text-primary" />
             {isRtl ? 'قاعدة العملاء' : 'Clients Database'}
           </h1>
        </div>
        <Button onClick={() => router.push('/dashboard/clients/new')} variant="default" className="h-11 px-6 shadow-lg shadow-primary/20 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> {isRtl ? 'تسجيل عميل' : 'New Client'}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-4">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input placeholder={isRtl ? 'بحث...' : 'Search...'} className="ps-12 h-11 bg-white border-slate-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'العميل' : 'Client'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الهاتف' : 'Mobile'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-8 py-6">
                     <div className="flex flex-col text-start">
                        <span className="font-black text-slate-800 text-sm leading-none">{client.nameAr}</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{client.fileNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell className="py-6 text-xs font-bold text-slate-600">{client.mobile}</TableCell>
                  <TableCell className="py-6">
                     <Badge className={cn("text-[9px] font-black px-3 py-1 rounded-lg border-0 shadow-sm", client.status === 'contracted' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white')}>
                        {client.status.toUpperCase()}
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
