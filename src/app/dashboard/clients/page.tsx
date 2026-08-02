'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, UserPlus, Search, Loader2, 
  ArrowRight, Filter, Briefcase, ShieldCheck 
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: rawClients, loading } = useCollection<Client>(clientsQuery);

  const filtered = useMemo(() => {
    let list = rawClients || [];
    
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
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="flex items-center gap-3">
             <Users className="h-8 w-8 text-primary" />
             {isRtl ? 'قاعدة العملاء' : 'Clients Database'}
           </h1>
           {!isAdmin && (
             <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-emerald-50 text-emerald-600 border-0 font-bold text-[10px] px-3 py-1 rounded-full gap-1">
                   <ShieldCheck className="h-3 w-3" /> {isRtl ? 'عرض سيادي معزول' : 'Isolated View'}
                </Badge>
                <p className="text-xs font-medium text-muted-foreground italic">
                   {isRtl ? 'تظهر فقط الملفات المنسوبة لك' : 'Showing your assigned files only'}
                </p>
             </div>
           )}
        </div>
        
        {canRegisterClient && (
          <Button onClick={() => router.push('/dashboard/clients/new')} variant="gradient" size="lg" className="shadow-orange-500/20">
            <UserPlus className="h-4 w-4" /> {isRtl ? 'تسجيل عميل جديد' : 'New Registration'}
          </Button>
        )}
      </div>

      <Card className="nano-edge bg-white">
        <div className="p-4 flex flex-row items-center justify-between gap-4">
           <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4 text-primary" /> {isRtl ? 'تصفية النتائج' : 'Filter'}
           </Button>
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder={isRtl ? 'بحث في الأسماء، الملفات، أو المهندسين...' : 'Search records...'} 
                className="ps-12 h-12 bg-slate-50/50 border-border focus-visible:ring-primary/10 font-medium text-lg" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
        </div>
      </Card>

      <Card className="rounded-2xl overflow-hidden border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-8">{isRtl ? 'العميل المالك' : 'Client Profile'}</TableHead>
                <TableHead>{isRtl ? 'المسؤول المباشر' : 'Assigned Staff'}</TableHead>
                <TableHead>{isRtl ? 'الهاتف' : 'Mobile'}</TableHead>
                <TableHead>{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-muted-foreground font-medium">
                  {isRtl ? 'لا يوجد عملاء مطابقين للبحث.' : 'No matching clients found.'}
                </TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="cursor-pointer group" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-8 py-4">
                     <div className="flex flex-col text-start">
                        <span className="font-bold text-foreground text-sm leading-none">{client.nameAr}</span>
                        <span className="text-[11px] text-muted-foreground font-medium mt-2 font-mono uppercase tracking-wider">{client.fileNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                           <Briefcase className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{client.assignedEngineerName || '---'}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">{client.mobile}</TableCell>
                  <TableCell>
                     <Badge variant="secondary" className={cn(
                       "text-[10px] font-bold px-3 py-0.5 rounded-lg border-0 shadow-sm uppercase", 
                       client.status === 'contracted' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FFA000]'
                     )}>
                        {client.status}
                     </Badge>
                  </TableCell>
                  <TableCell className="pe-8 text-end">
                     <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
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
