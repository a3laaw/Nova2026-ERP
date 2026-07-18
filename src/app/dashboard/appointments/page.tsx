'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CalendarDays, Plus, Search, Loader2, ArrowRight,
  Filter, Clock, MapPin, CheckCircle2, XCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function AppointmentsListPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const appQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.appointments(companyId)), orderBy('start', 'desc')) : null, 
  [db, companyId]);

  const { data: appointments, loading } = useCollection<Appointment>(appQuery);

  const filtered = appointments.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <CalendarDays className="h-8 w-8 text-primary" />
             {isRtl ? 'إدارة المواعيد والزيارات' : 'Appointments & Visits'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? 'جدولة اللقاءات مع العملاء والزيارات الميدانية الاستشارية.' : 'Schedule client meetings and consulting site visits.'}
           </p>
        </div>
        <Button onClick={() => router.push('/dashboard/appointments/new')} className="h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2">
          <Plus className="h-5 w-5" /> {isRtl ? 'موعد جديد' : 'New Appointment'}
        </Button>
      </div>

      <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder={isRtl ? 'بحث...' : 'Search...'} 
              className="ps-12 h-11 bg-slate-50/50 border-slate-200 font-bold" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-6 border-slate-200">
             <Filter className="h-4 w-4 me-2" /> {isRtl ? 'تصفية' : 'Filter'}
          </Button>
        </div>
      </Card>

      <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#F4F6F9] border-b">
              <TableRow>
                <TableHead className="py-5 ps-8 text-start">{isRtl ? 'الموعد' : 'Appointment'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'النوع' : 'Type'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'التاريخ والوقت' : 'Schedule'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8 text-end"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-slate-400 font-bold">{isRtl ? 'لا يوجد مواعيد مسجلة.' : 'No appointments found.'}</TableCell></TableRow>
              ) : (
                filtered.map((app) => (
                  <TableRow key={app.id} className="hover:bg-primary/[0.02] transition-colors group cursor-pointer border-b-slate-100" onClick={() => router.push(`/dashboard/appointments/${app.id}`)}>
                    <TableCell className="py-5 ps-8 text-start">
                       <div className="flex flex-col text-start">
                          <span className="font-black text-slate-800 text-sm leading-none">{app.title}</span>
                          <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{app.clientName || '---'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="font-black text-[9px] uppercase border-slate-200">
                          {app.type.replace('_', ' ')}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start font-mono text-xs text-slate-500">
                       <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-primary" />
                          {new Date(app.start).toLocaleString(isRtl ? 'ar-KW' : 'en-US')}
                       </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-3 py-1 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                         app.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                         app.status === 'cancelled' ? 'bg-rose-50 text-rose-600' :
                         'bg-blue-50 text-blue-600'
                       )}>
                          {app.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-8 text-end">
                      <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-9 w-9">
                        <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
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
