'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, CheckCircle2, XCircle,
  Calendar, User, FileText, AlertTriangle,
  History, ShieldCheck, MessageSquare, Hash,
  Scale, Info, PlaneTakeoff, PlaneLanding, Briefcase
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
import { LeaveTiersDisplay } from '@/components/hr/leave-tiers-display';

export default function LeaveDetailsPage() {
  const leaveId = useParams().id as string;
  const { user, globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [processing, setProcessing] = useState(false);
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [editForm, setEditForm] = useState({
    comment: '',
    startDate: '',
    endDate: '',
    workingDays: 0
  });

  const companyId = globalUser?.companyId;
  const leaveService = useMemo(() => 
    db && companyId ? new LeaveService(db, companyId, permissions) : null, 
  [db, companyId, permissions]);

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
        actualReturnDate: actualReturnDate
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

  const isOwner = user?.uid === leave.userId;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/hr/leaves')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {/* Main Info */}
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden text-start">
               <CardHeader className="bg-slate-50/50 border-b p-8">
                  <CardTitle className="text-xl font-black flex items-center gap-3">
                     <User className="h-6 w-6 text-primary" /> {leave.userName}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                     <div className="p-6 rounded-3xl bg-slate-50 border space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'بداية الإجازة' : 'Start Date'}</Label>
                        <p className="text-xl font-black text-slate-800">{leave.startDate}</p>
                     </div>
                     <div className="p-6 rounded-3xl bg-slate-50 border space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'نهاية الإجازة' : 'End Date'}</Label>
                        <p className="text-xl font-black text-slate-800">{leave.endDate}</p>
                     </div>
                  </div>

                  {/* Actions Section */}
                  <div className="pt-8 border-t space-y-6">
                     <h3 className="font-black text-lg flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" /> {isRtl ? 'إجراءات المسار الزمني' : 'Timeline Actions'}
                     </h3>

                     <div className="grid grid-cols-1 gap-4">
                        {/* 1. تأكيد المغادرة */}
                        {leave.status === 'approved' && (
                          <div className="p-6 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-center justify-between animate-in zoom-in-95">
                             <div className="text-start">
                                <h4 className="font-black text-blue-900">{isRtl ? 'تأكيد المغادرة في إجازة' : 'Confirm Departure'}</h4>
                                <p className="text-xs font-bold text-blue-700 opacity-70">{isRtl ? 'يتم الضغط هنا عند بدء الموظف لإجازته فعلياً.' : 'Click when the employee actually starts the leave.'}</p>
                             </div>
                             <Button onClick={() => handleAction('on-leave')} disabled={processing} className="bg-blue-600 text-white font-black rounded-xl h-12 px-8">
                                <PlaneTakeoff className="me-2 h-5 w-5" /> {isRtl ? 'تأكيد المغادرة' : 'Confirm'}
                             </Button>
                          </div>
                        )}

                        {/* 2. تسجيل العودة */}
                        {leave.status === 'on-leave' && (
                          <div className="p-6 rounded-3xl bg-purple-50 border-2 border-purple-100 space-y-4 animate-in zoom-in-95">
                             <div className="text-start">
                                <h4 className="font-black text-purple-900">{isRtl ? 'تسجيل العودة من الإجازة' : 'Record Return'}</h4>
                                <p className="text-xs font-bold text-purple-700 opacity-70">{isRtl ? 'أدخل تاريخ العودة الفعلي للموظف للمنشأة.' : 'Enter the actual date the employee returned.'}</p>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="flex-1">
                                   <SmartDateInput value={actualReturnDate} onChange={setActualReturnDate} />
                                </div>
                                <Button onClick={() => handleAction('returned')} disabled={processing} className="bg-purple-600 text-white font-black rounded-xl h-12 px-8">
                                   <PlaneLanding className="me-2 h-5 w-5" /> {isRtl ? 'تسجيل العودة' : 'Record'}
                                </Button>
                             </div>
                          </div>
                        )}

                        {/* 3. مباشرة العمل */}
                        {leave.status === 'returned' && isAdmin && (
                          <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-between animate-in zoom-in-95">
                             <div className="text-start">
                                <h4 className="font-black text-emerald-900">{isRtl ? 'اعتماد مباشرة العمل' : 'Confirm Work Commencement'}</h4>
                                <p className="text-xs font-bold text-emerald-700 opacity-70">{isRtl ? 'إقرار رسمي بأن الموظف استلم مهامه الميدانية.' : 'Official confirmation that the employee is back on duty.'}</p>
                             </div>
                             <Button onClick={() => handleAction('commenced')} disabled={processing} className="bg-emerald-600 text-white font-black rounded-xl h-12 px-8">
                                <Briefcase className="me-2 h-5 w-5" /> {isRtl ? 'مباشرة عمل' : 'Commence'}
                             </Button>
                          </div>
                        )}

                        {/* الحالة النهائية */}
                        {leave.status === 'commenced' && (
                          <div className="p-10 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-emerald-200">
                             <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                             <h4 className="font-black text-emerald-900">{isRtl ? 'تمت مباشرة العمل' : 'Work Commenced'}</h4>
                             <p className="text-xs font-bold text-slate-400 mt-1">{isRtl ? 'تم إغلاق ملف الإجازة والموظف حالياً "نشط".' : 'Leave file closed, employee is now "Active".'}</p>
                          </div>
                        )}
                     </div>
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="space-y-6">
            <Card className="border-0 shadow-lg rounded-[2.5rem] bg-slate-900 text-white p-8 text-start space-y-6">
               <h3 className="font-black text-sm uppercase tracking-widest text-primary">{isRtl ? 'سجل التدقيق الزمني' : 'Audit Trail'}</h3>
               <div className="space-y-6">
                  {leave.approvedAt && (
                    <div className="flex gap-4 items-start">
                       <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                       <div className="text-start">
                          <p className="text-xs font-black">{isRtl ? 'تم الاعتماد' : 'Approved'}</p>
                          <p className="text-[10px] text-slate-400">{new Date(leave.approvedAt.toDate()).toLocaleString()}</p>
                       </div>
                    </div>
                  )}
                  {leave.departureConfirmedAt && (
                    <div className="flex gap-4 items-start">
                       <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                       <div className="text-start">
                          <p className="text-xs font-black">{isRtl ? 'تأكيد المغادرة' : 'Departure'}</p>
                          <p className="text-[10px] text-slate-400">{new Date(leave.departureConfirmedAt.toDate()).toLocaleString()}</p>
                       </div>
                    </div>
                  )}
                  {leave.returnRecordedAt && (
                    <div className="flex gap-4 items-start">
                       <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                       <div className="text-start">
                          <p className="text-xs font-black">{isRtl ? 'تسجيل العودة' : 'Return'}</p>
                          <p className="text-[10px] text-slate-400">{new Date(leave.returnRecordedAt.toDate()).toLocaleString()}</p>
                       </div>
                    </div>
                  )}
                  {leave.commencementConfirmedAt && (
                    <div className="flex gap-4 items-start">
                       <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                       <div className="text-start">
                          <p className="text-xs font-black">{isRtl ? 'مباشرة العمل' : 'Commencement'}</p>
                          <p className="text-[10px] text-slate-400">{new Date(leave.commencementConfirmedAt.toDate()).toLocaleString()}</p>
                       </div>
                    </div>
                  )}
               </div>
            </Card>
         </div>
      </div>
    </div>
  );
}
