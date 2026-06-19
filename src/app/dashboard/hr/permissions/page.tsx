'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Clock, Plus, Loader2, Search, 
  ArrowRight, CheckCircle2, XCircle,
  Timer, Calendar, AlertCircle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { PermissionRequest } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function PermissionRequestsPage() {
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isRtl = lang === 'ar';

  const companyId = globalUser?.companyId;
  const permsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.permissionRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: permissions, loading } = useCollection<PermissionRequest>(permsQuery);

  const filtered = permissions?.filter(p => 
    p.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.type?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Clock className="h-10 w-10 text-primary" />
            {isRtl ? 'طلبات الاستئذان' : 'Permission Requests'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
            {isRtl ? 'إدارة التأخيرات والانصراف المبكر' : 'Manage late arrivals and early departures'}
          </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/permissions/new')}
          className="bg-primary text-white font-black rounded-2xl px-8 py-7 text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="me-2 h-6 w-6" />
          {isRtl ? 'طلب استئذان جديد' : 'New Request'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={isRtl ? 'بحث باسم الموظف...' : 'Search by employee name...'} 
              className="ps-12 rounded-2xl h-14 bg-white text-start border-2 border-slate-100" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'النوع' : 'Type'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'الوقت' : 'Time'}</TableHead>
                <TableHead className="text-center">{isRtl ? 'المدة' : 'Duration'}</TableHead>
                <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="pe-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-24"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary/30" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-24 text-muted-foreground font-bold italic">{isRtl ? 'لا توجد طلبات مسجلة.' : 'No requests found.'}</TableCell></TableRow>
              ) : (
                filtered.map((req) => (
                  <TableRow 
                    key={req.id} 
                    className="hover:bg-primary/5 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/hr/permissions/${req.id}`)}
                  >
                    <TableCell className="py-6 ps-8 text-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                           <Timer className="h-5 w-5" />
                        </div>
                        <span className="font-black text-slate-800">{req.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="font-black border-2 px-3 uppercase text-[9px] border-slate-200">
                          {isRtl ? (req.type === 'late_arrival' ? 'حضور متأخر' : 'انصراف مبكر') : req.type.replace('_', ' ')}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <span className="font-mono text-xs font-bold text-slate-500">{req.date}</span>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-700">
                          <span>{req.startTime}</span>
                          <span className="opacity-20">-</span>
                          <span>{req.endTime}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="font-black text-primary bg-primary/5 px-3 py-1 rounded-lg text-xs">{req.durationHours}h</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-4 py-1 rounded-lg border-0 shadow-sm",
                         req.status === 'approved' ? 'bg-emerald-500 text-white' : 
                         req.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                         'bg-rose-500 text-white'
                       )}>
                          {req.status.toUpperCase()}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center pe-8">
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white">
                          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-0", isRtl && "rotate-180")} />
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
