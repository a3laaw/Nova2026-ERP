'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, Plus, Loader2, CheckCircle2, 
  XCircle, ArrowRight
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { LeaveService } from '@/services/leave-service';
import { LeaveRequest } from '@/types/hr';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { paths } from '@/firebase/multi-tenant';

export function LeavesManager() {
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

  const leavesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.leaveRequests(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);
  const { data: leaves, loading } = useCollection<LeaveRequest>(leavesQuery);

  const handleAction = async (leaveId: string, status: 'approved' | 'rejected') => {
    if (!leaveService || !user) return;
    try {
      await leaveService.updateRequestStatus(leaveId, status, user.uid);
      toast({ title: t('saved') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-start">
           <h3 className="text-xl font-black flex items-center gap-2">
             <CalendarDays className="h-6 w-6 text-primary" />
             {isRtl ? 'إجازات الموظفين' : 'Employee Leaves'}
           </h3>
           <p className="text-xs font-bold text-muted-foreground mt-1 opacity-70">
             {isRtl ? 'نظام الحساب الآلي للإجازات والغياب' : 'Automated leave and absence calculation system'}
           </p>
        </div>

        <Button 
          onClick={() => router.push('/dashboard/hr/leaves/new')}
          className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 h-12 px-6 hover:scale-[1.02] transition-transform"
        >
          <Plus className="me-2 h-4 w-4" /> {isRtl ? 'تقديم إجازة' : 'Apply for Leave'}
        </Button>
      </div>

      <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5" dir={dir}>
         <CardContent className="p-0 overflow-x-auto">
            <Table>
               <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="py-6 ps-8 text-start">{isRtl ? 'الموظف' : 'Employee'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'النوع' : 'Type'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الفترة' : 'Period'}</TableHead>
                     <TableHead className="text-center">{isRtl ? 'أيام العمل' : 'Work Days'}</TableHead>
                     <TableHead className="text-start">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                     <TableHead className="pe-8"></TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/30" /></TableCell></TableRow>
                  ) : leaves?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 italic text-muted-foreground font-bold">{isRtl ? 'لا توجد طلبات إجازة مسجلة.' : 'No leave requests found.'}</TableCell></TableRow>
                  ) : (
                    leaves?.map((leave) => (
                      <TableRow key={leave.id} className="hover:bg-slate-50 transition-colors group">
                         <TableCell className="py-6 ps-8 text-start">
                            <span className="font-black text-slate-800">{leave.userName}</span>
                         </TableCell>
                         <TableCell className="text-start">
                            <Badge variant="outline" className="bg-white font-black uppercase text-[9px] px-3 border-slate-200">
                               {leave.type}
                            </Badge>
                         </TableCell>
                         <TableCell className="text-start">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                               <span>{leave.startDate}</span>
                               <ArrowRight className={cn("h-2 w-2 opacity-30", isRtl && "rotate-180")} />
                               <span>{leave.endDate}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-center">
                            <span className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-xs">{leave.workingDays}</span>
                         </TableCell>
                         <TableCell className="text-start">
                            <Badge className={cn(
                              "font-black px-3 py-1 border-0 shadow-sm",
                              leave.status === 'approved' ? 'bg-emerald-500 text-white' :
                              leave.status === 'rejected' ? 'bg-destructive text-white' :
                              'bg-amber-50 text-amber-600'
                            )}>
                               {leave.status.toUpperCase()}
                            </Badge>
                         </TableCell>
                         <TableCell className="pe-8">
                            {leave.status === 'pending' && (globalUser?.role === 'admin' || globalUser?.role === 'Admin') ? (
                               <div className="flex justify-end gap-2">
                                  <Button onClick={() => handleAction(leave.id!, 'approved')} size="sm" variant="ghost" className="h-10 w-10 p-0 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-100"><CheckCircle2 className="h-5 w-5" /></Button>
                                  <Button onClick={() => handleAction(leave.id!, 'rejected')} size="sm" variant="ghost" className="h-10 w-10 p-0 rounded-xl text-destructive hover:bg-destructive/5 border border-rose-100"><XCircle className="h-5 w-5" /></Button>
                                </div>
                            ) : null}
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
