'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
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
  const { lang, dir } = useLanguage();
  const { isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const canRegisterClient = check('crm', 'create').can;

  // استعلام محصن: المثبت الذري يضمن عدم حدوث Loop هنا
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
    <div className="space-y-6 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
             <Users className="h-10 w-10 text-primary" />
             {isRtl ? 'قاعدة بيانات العملاء' : 'Clients Database'}
           </h1>
           {!isAdmin && (
             <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[9px] px-3 py-1 rounded-full gap-1">
                   <ShieldCheck className="h-3 w-3" /> {isRtl ? 'عرض سيادي معزول' : 'Isolated View'}
                </Badge>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   {isRtl ? 'تظهر فقط الملفات المنسوبة لك كمسؤول' : 'Showing your assigned files only'}
                </p>
             </div>
           )}
        </div>
        
        {canRegisterClient && (
          <Button onClick={() => router.push('/dashboard/clients/new')} className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 border-b-4 border-orange-700 hover:scale-105 transition-all gap-2">
            <UserPlus className="h-6 w-6" /> {isRtl ? 'تسجيل عميل جديد' : 'New Registration'}
          </Button>
        )}
      </div>

      {/* شريط البحث الاحترافي (Premium Search) */}
      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/30">
           <div className="relative w-full max-w-xl">
              <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
              <Input 
                placeholder={isRtl ? 'بحث بالاسم، رقم الهاتف، أو رقم الملف الضريبي...' : 'Search names, mobile, or file number...'} 
                className="ps-14 h-16 rounded-[1.5rem] border-2 border-slate-100 focus:border-primary/40 bg-white text-lg font-bold shadow-inner transition-all" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
           </div>
           <div className="flex gap-3 shrink-0">
              <Button variant="outline" className="h-14 px-6 rounded-2xl border-2 border-slate-100 bg-white font-black gap-2">
                 <Filter className="h-5 w-5 text-primary" /> {isRtl ? 'فلترة متقدمة' : 'Filters'}
              </Button>
              <Badge variant="secondary" className="bg-slate-900 text-white font-black h-14 px-6 rounded-2xl text-lg flex items-center">
                 {filtered.length}
              </Badge>
           </div>
        </div>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b">
              <TableRow>
                <TableHead className="py-6 ps-10 text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'العميل المالك' : 'Client Profile'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المسؤول المباشر' : 'Assigned Staff'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الهاتف' : 'Mobile'}</TableHead>
                <TableHead className="text-start font-black uppercase text-[10px] tracking-widest">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-10 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 italic text-slate-300 font-bold text-lg">
                  {isRtl ? 'لا يوجد عملاء مطابقين للبحث.' : 'No matching clients found.'}
                </TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="cursor-pointer group hover:bg-primary/[0.02] transition-colors border-b-slate-100" onClick={() => router.push(`/dashboard/clients/${client.id}`)}>
                  <TableCell className="ps-10 py-6 text-start">
                     <div className="flex flex-col text-start">
                        <span className="font-black text-slate-800 text-lg leading-none">{client.nameAr}</span>
                        <span className="text-[11px] text-slate-400 font-bold mt-2 uppercase tracking-widest font-mono">FILE: {client.fileNumber}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-start">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shadow-sm">
                           <Briefcase className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-black text-slate-700">{client.assignedEngineerName || '---'}</span>
                     </div>
                  </TableCell>
                  <TableCell className="py-6 text-sm font-bold text-slate-600 text-start">{client.mobile}</TableCell>
                  <TableCell className="py-6 text-start">
                     <Badge className={cn(
                       "font-black px-4 py-1.5 rounded-lg border-0 shadow-sm uppercase text-[9px]", 
                       client.status === 'contracted' ? 'bg-emerald-500 text-white' : 'bg-primary text-white'
                     )}>
                        {client.status}
                     </Badge>
                  </TableCell>
                  <TableCell className="pe-10 text-end">
                     <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-11 w-11 shadow-sm">
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
