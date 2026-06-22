'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Search, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
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
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-2xl font-black font-headline flex items-center gap-3">
             <Users className="h-7 w-7 text-primary" />
             {isRtl ? 'قاعدة العملاء' : 'Clients Database'}
           </h1>
        </div>
        <Button onClick={() => router.push('/dashboard/clients/new')} className="bg-primary text-white font-black rounded-xl h-10 px-5 shadow-lg shadow-primary/10 gap-2">
          <UserPlus className="h-4 w-4" /> {isRtl ? 'تسجيل عميل' : 'New Client'}
        </Button>
      </div>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
        <CardHeader className="bg-slate-50/50 border-b p-4">
           <div className="relative w-full max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder={isRtl ? 'بحث...' : 'Search...'} className="ps-10 rounded-xl h-9 bg-white border-slate-200 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 ps-8 text-start">{isRtl ? 'الملف / العميل' : 'File / Client'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الهاتف' : 'Mobile'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="hover:bg-primary/[0.01] cursor-pointer group" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-8 py-2">
                     <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-[9px] text-slate-400 group-hover:text-primary transition-colors">
                           {client.fileNumber.split('-')[1]?.split('/')[0] || '??'}
                        </div>
                        <div className="text-start">
                           <p className="font-black text-sm text-slate-800 leading-none">{client.nameAr}</p>
                           <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{client.fileNumber}</p>
                        </div>
                     </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs font-bold text-slate-600">{client.mobile}</TableCell>
                  <TableCell className="py-2">
                     <Badge className={cn("text-[8px] font-black px-2 py-0.5", client.status === 'contracted' ? 'bg-emerald-500' : 'bg-blue-500')}>{client.status}</Badge>
                  </TableCell>
                  <TableCell className="pe-8 text-end">
                     <Button variant="ghost" size="icon" className="rounded-lg group-hover:bg-primary group-hover:text-white h-7 w-7"><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button>
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
