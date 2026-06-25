
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, CheckCircle2, XCircle,
  User, History, Printer, PlaneTakeoff, PlaneLanding, Scale,
  Clock, ShieldAlert
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { LeaveService } from '@/services/leave-service';
import { LeaveRequest } from '@/types/hr';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function LeaveDetailsPage() {
  const leaveId = useParams().id as string;
  const { user, globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { isAdmin, check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [processing, setProcessing] = useState(false);
  const [actualDepartureDate, setActualDepartureDate] = useState('');
  const [actualReturnDate, setActualReturnDate] = useState('');
  
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0
  });

  const companyId = globalUser?.companyId;
  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId) : null, 
  [db, companyId]);

  const leaveRef = useMemo(() => 
    companyId && db ? doc(db, paths.leaveRequests(companyId), leaveId) : null, 
  [db, companyId, leaveId]);

  const { data: leave, loading } = useDoc<LeaveRequest>(leaveRef);

  useEffect(() => {
    if (leave) {
      setEditForm({
        comment: leave.comment || '',
        startDate: leave.startDate,
        endDate: leave.endDate,
        workingDays: leave.workingDays
      });
      setActualDepartureDate(leave.actualDepartureDate || leave.startDate);
      setActualReturnDate(leave.actualReturnDate || leave.endDate);
    }
  }, [leave]);

  const handleAction = async (status: LeaveRequest['status']) => {
    if (!leaveService || !user) return;
    setProcessing(true);
    try {
      await leaveService.updateRequestStatus(leaveId, status, user.uid, {
        comment: editForm.comment,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        workingDays: editForm.workingDays,
        actualReturnDate: actualReturnDate,
        actualDepartureDate: actualDepartureDate
      });
      toast({ title: t('saved') });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{isRtl ? 'الطلب غير موجود' : 'Request not found'}</div>;

  const isOwner = user?.uid === leave.userId || user?.uid === (leave as any).createdBy;
  const canPrint = check('hr', 'print').can;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <div className="text-start">
             <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'حالة طلب الإجازة' : 'Leave Request Status'}</h1>
                <Badge className={cn(
                  "font-black px-4 py-1 rounded-xl shadow-sm uppercase",
                  leave.status === 'approved' ? 'bg-blue-500 text-white' : 
                  leave.status === 'on-leave' ? 'bg-amber-500 text-white' :
                  leave.status === 'returned' ? 'bg-purple-500 text-white' :
                  leave.status === 'commenced' ? 'bg-emerald-500 text-white' :
                  leave.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 border' : 
                  'bg-rose-500 text-white'
                )}>
                   {leave.status}
                </Badge>
             </div>
          </div>
        </div>
        {canPrint && (
           <Button onClick={() => window.print()} className="h-12 px-6 rounded-xl bg-white border-2 text-slate-900 font-black gap-2 hover:bg-slate-50 shadow-sm">
              <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'طباعة المستند' : 'Print'}
           </Button>
        )}
      </div>

      <PrintWrapper title={isRtl ? "إقرار إجازة رسمية" : "Official Leave Authorization"}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              {isAdmin && leave.status === 'pending' && (
                <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-2 ring-primary/20 print:hidden">
                   <div className="bg-slate-900 p-8 text-white text-start">
                      <h3 className="text-2xl font-black font-headline flex items-center gap-3"><Clock className="h-7 w-7 text-primary" /> {isRtl ? 'قرار الإدارة وتصحيح البيانات' : 'Admin Decision'}</h3>
                   </div>
                   <CardContent className="p-8 space-y-8 text-start">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-primary/10">
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ البدء المعتمد' : 'Approve Start'}</Label><SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ العودة المعتمد' : 'Approve Return'}</Label><SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} /></div>
                         <div className="space-y-2 md:col-span-2"><Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'أيام الخصم الفعلي (للمحاسبة)' : 'Deduction Days'}</Label><Input type="number" value={editForm.workingDays} onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})} className="h-14 rounded-2xl border-2 font-black text-primary text-xl" /></div>
                      </div>
                      <div className="flex gap-4">
                         <Button onClick={() => handleAction('rejected')} disabled={processing} variant="outline" className="flex-1 h-16 rounded-2xl border-2 text-rose-600 font-black">{isRtl ? 'رفض الطلب' : 'Reject'}</Button>
                         <Button onClick={() => handleAction('approved')} disabled={processing} className="flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black">{isRtl ? 'اعتماد وصرف' : 'Approve'}</Button>
                      </div>
                   </CardContent>
                </Card>
              )}
           </div>
        </div>
      </PrintWrapper>
    </div>
  );
}
