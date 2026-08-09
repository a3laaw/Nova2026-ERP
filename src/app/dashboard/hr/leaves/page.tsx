'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CalendarDays, Plus, Loader2, Search, 
  ArrowRight, Plane, Filter
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { LeaveRequest } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { canPerformOnRecord } from '@/lib/permissions/engine';

export default function LeaveRequestsPage() {
  const { globalUser } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const viewAccess = check('hr', 'view');
  const companyId = globalUser?.companyId;
  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const { data: rawLeaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  const leaves = useMemo(() => {
    if (!viewAccess.can) return [];
    return rawLeaves.filter(leave => canPerformOnRecord(
      viewAccess,
      { uid: globalUser?.uid || '', departmentId: globalUser?.departmentId },
      { createdBy: leave.userId, departmentId: (leave as any).departmentId }
    ));
  }, [rawLeaves, viewAccess, globalUser]);

  const filteredLeaves = leaves.filter(l => 
    l.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Plane className="h-6 w-6 text-primary" />
            {t('hr.leaveRequestsTitle')}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">
            {viewAccess.scope === 'own' ? t('hr.ownRecordsOnly') : t('hr.manageAbsences')}
          </p>
        </div>

        <Button onClick={() => router.push('/dashboard/hr/leaves/new')} size="sm" className="h-9 px-6 font-bold rounded-md shadow-sm">
          <Plus className="me-2 h-4 w-4" />
          {t('common.add')}
        </Button>
      </div>

      <Card className="rounded-lg shadow-sm border overflow-hidden bg-white">
        <div className="p-3 flex flex-row items-center justify-between gap-4 bg-slate-50/30 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t('common.search')} 
              className="ps-9 h-9 border-slate-200 bg-white font-medium text-sm" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 px-4 border-slate-200 font-bold text-xs"><Filter className="h-3.5 w-3.5 me-2" /> {t('common.filter')}</Button>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="py-3 ps-6 text-start text-[10px] font-bold uppercase text-slate-500">{t('common.name')}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{t('hr.type')}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{t('hr.period')}</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase text-slate-500">{t('hr.workDays')}</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-500">{t('common.status')}</TableHead>
                <TableHead className="pe-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
              ) : filteredLeaves.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 italic text-slate-400 font-bold">{t('hr.noRequests')}</TableCell></TableRow>
              ) : (
                filteredLeaves.map((leave) => (
                  <TableRow 
                    key={leave.id} 
                    className="cursor-pointer border-b-slate-100 hover:bg-slate-50/50 group"
                    onClick={() => router.push(`/dashboard/hr/leaves/${leave.id}`)}
                  >
                    <TableCell className="py-2.5 ps-6 text-start">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                           <CalendarDays className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">{leave.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge variant="outline" className="font-bold border-slate-200 px-2 uppercase text-[9px] h-5 bg-white">
                          {leave.type}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                       <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 font-mono">
                          <span>{leave.startDate}</span>
                          <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
                          <span>{leave.endDate}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">{leave.workingDays}</span>
                    </TableCell>
                    <TableCell className="text-start">
                       <Badge className={cn(
                         "font-black px-2 py-0.5 rounded-md border-0 text-[9px] uppercase",
                         ['approved', 'on-leave', 'returned', 'commenced'].includes(leave.status) ? 'bg-emerald-50 text-emerald-600' : 
                         leave.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                         'bg-rose-50 text-rose-600'
                       )}>
                          {t('status.' + leave.status)}
                       </Badge>
                    </TableCell>
                    <TableCell className="pe-6 text-end">
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 group-hover:text-primary">
                          <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
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
