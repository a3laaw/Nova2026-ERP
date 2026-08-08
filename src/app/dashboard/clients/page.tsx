'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  UserPlus, Search, Loader2, 
  ArrowRight, Filter
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';

export default function ClientsListPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const canRegisterClient = check('crm', 'create').can;

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const { data: rawClients, loading } = useCollection<Client>(clientsQuery);

  const filtered = useMemo(() => {
    let list = [...(rawClients || [])].sort((a, b) => {
       const dateA = a.createdAt?.toMillis?.() || 0;
       const dateB = b.createdAt?.toMillis?.() || 0;
       return dateB - dateA;
    });
    
    if (!isAdmin && globalUser?.employeeId) {
      list = list.filter(c => c.assignedEngineerId === globalUser.employeeId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => 
        c.nameAr?.toLowerCase().includes(term) || 
        c.fileNumber?.toLowerCase().includes(term) ||
        c.assignedEngineerName?.toLowerCase().includes(term)
      );
    }
    
    return list;
  }, [rawClients, searchTerm, isAdmin, globalUser?.employeeId]);

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-xl md:text-2xl font-black text-slate-900">
             {t('clients.title')}
           </h1>
           {!isAdmin && (
             <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[9px] px-2 h-4 rounded-md">
                   {isRtl ? 'عرض معزول' : 'Isolated View'}
                </Badge>
                <p className="text-[10px] font-medium text-slate-400 uppercase">
                   {isRtl ? 'تظهر ملفاتك المنسوبة فقط' : 'Your assigned files only'}
                </p>
             </div>
           )}
        </div>
        
        {canRegisterClient && (
          <Button onClick={() => router.push('/dashboard/clients/new')} size="sm" className="h-9 px-4 font-black rounded-xl shadow-lg shadow-primary/20">
            <UserPlus className="h-4 w-4 me-2" /> {t('clients.addNew')}
          </Button>
        )}
      </div>

      <Card className="rounded-2xl shadow-sm border border-slate-100 overflow-hidden bg-white">
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
           <div className="relative w-full max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder={t('common.search')} 
                className="ps-10 h-11 rounded-xl border-slate-200 bg-white text-sm font-bold shadow-inner" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-11 px-4 rounded-xl font-black text-xs border-2">
                 <Filter className="h-4 w-4 me-2" /> {t('common.filter')}
              </Button>
              <Badge variant="secondary" className="bg-slate-900 text-white font-black h-11 px-4 rounded-xl text-xs">
                 {filtered.length}
              </Badge>
           </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b-0">
                <TableHead className="py-5 ps-10 text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clients.table.profile')}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clients.table.staff')}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clients.table.contact')}</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('clients.table.status')}</TableHead>
                <TableHead className="pe-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-black italic">
                  {isRtl ? 'لا يوجد عملاء مطابقين للبحث.' : 'No matching clients found.'}
                </TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="cursor-pointer group hover:bg-slate-50 transition-colors border-b-slate-100" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-10 py-5 text-start">
                     <div className="flex flex-col text-start">
                        <span className="font-black text-slate-900 text-sm">{client.nameAr}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold mt-1">FILE: {client.fileNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <span className="text-xs font-bold text-slate-600">{client.assignedEngineerName || '---'}</span>
                  </TableCell>
                  <TableCell className="py-5 text-xs font-mono font-bold text-slate-500 text-start">{client.mobile}</TableCell>
                  <TableCell className="py-5 text-start">
                     <Badge className={cn(
                       "font-black px-3 py-1 rounded-lg border-0 shadow-sm text-[9px] uppercase", 
                       client.status === 'contracted' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
                     )}>
                        {client.status}
                     </Badge>
                  </TableCell>
                  <TableCell className="pe-10 text-end">
                     <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 group-hover:text-primary group-hover:bg-primary/5 rounded-xl transition-all">
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
