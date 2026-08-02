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
  ArrowRight, Filter, Briefcase, ShieldCheck,
  AlertCircle
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

  // تبسيط الاستعلام لتجنب أخطاء الفهارس (Indexes)
  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId))) : null, 
  [db, companyId]);

  const { data: rawClients, loading, error } = useCollection<Client>(clientsQuery);

  const filtered = useMemo(() => {
    // الترتيب البرمجي لضمان السيادة المعلوماتية دون فهارس مركبة
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
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="flex items-center gap-3 text-slate-900 font-headline font-black">
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
          <Button onClick={() => router.push('/dashboard/clients/new')} variant="gradient" className="h-12 px-8 shadow-xl shadow-orange-500/20 gap-2">
            <UserPlus className="h-5 w-5" /> {isRtl ? 'تسجيل عميل جديد' : 'New Registration'}
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
           <Button variant="outline" className="h-12 px-6 border-slate-200 font-bold gap-2">
              <Filter className="h-4 w-4 text-primary" /> {isRtl ? 'تصفية النتائج' : 'Filter'}
           </Button>
           <div className="relative w-full max-w-md">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <Input 
                placeholder={isRtl ? 'بحث في الأسماء، الملفات، أو المهندسين...' : 'Search records...'} 
                className="ps-12 h-12 bg-slate-50/50 border-slate-100 focus-visible:ring-primary/10 font-bold text-lg" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
        </div>
      </Card>

      {error ? (
         <div className="py-20 text-center space-y-4 bg-rose-50/50 rounded-3xl border-2 border-dashed border-rose-100 animate-in shake-in duration-500">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <div className="space-y-1">
               <h3 className="text-xl font-black text-rose-900">{isRtl ? 'خطأ في جلب البيانات' : 'Data Sync Error'}</h3>
               <p className="text-sm font-bold text-rose-400">{error.message}</p>
            </div>
         </div>
      ) : (
        <Card className="rounded-2xl overflow-hidden border border-slate-100 shadow-xl bg-white ring-1 ring-black/[0.02]">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-8 py-5 text-slate-500 font-black uppercase text-[10px] tracking-widest">{isRtl ? 'العميل المالك' : 'Client Profile'}</TableHead>
                  <TableHead className="text-slate-500 font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المسؤول المباشر' : 'Assigned Staff'}</TableHead>
                  <TableHead className="text-slate-500 font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الهاتف' : 'Mobile'}</TableHead>
                  <TableHead className="text-slate-500 font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="pe-8 text-end"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32 italic text-slate-400 font-bold">
                    {isRtl ? 'لا يوجد عملاء مطابقين للبحث.' : 'No matching clients found.'}
                  </TableCell></TableRow>
                ) : filtered.map((client) => (
                  <TableRow key={client.id} className="cursor-pointer group hover:bg-primary/[0.01] border-b-slate-50" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                    <TableCell className="ps-8 py-5 text-start">
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-base leading-none">{client.nameAr}</span>
                          <span className="text-[10px] text-slate-400 font-bold mt-2 font-mono uppercase tracking-wider">{client.fileNumber}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shadow-inner">
                             <Briefcase className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{client.assignedEngineerName || '---'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-500 tabular-nums text-start">{client.mobile}</TableCell>
                    <TableCell className="text-start">
                       <Badge variant="secondary" className={cn(
                         "text-[9px] font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase", 
                         client.status === 'contracted' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-primary'
                       )}>
                          {client.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-10 w-10">
                          <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
