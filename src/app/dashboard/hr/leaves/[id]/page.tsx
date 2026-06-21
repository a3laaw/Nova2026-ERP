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
  Scale, Info
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
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';

  const [processing, setProcessing] = useState(false);
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

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!leaveService || !user) return;
    setProcessing(true);
    try {
      await leaveService.updateRequestStatus(leaveId, status, user.uid, {
        comment: editForm.comment,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        workingDays: editForm.workingDays
      });
      toast({ title: t('saved') });
      router.push('/dashboard/hr/leaves');
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!leave) return <div className="p-20 text-center text-slate-400 font-bold">{isRtl ? 'الطلب غير موجود' : 'Request not found'}</div>;

  const isAdmin = globalUser?.role === 'admin' || globalUser?.role === 'Admin';

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500" dir={dir}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/hr/leaves')} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
          <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
        </Button>
        <div className="text-start">
           <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تفاصيل طلب الإجازة' : 'Leave Details'}</h1>
              <Badge className={cn(
                "font-black px-4 py-1 rounded-xl shadow-sm",
                leave.status === 'approved' ? 'bg-emerald-500 text-white' : 
                leave.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 border' : 
                'bg-rose-500 text-white'
              )}>
                 {leave.status.toUpperCase()}
              </Badge>
           </div>
           <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> {isRtl ? 'طلب رسمي معتمد' : 'Official Authorized Request'}
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-hidden text-start">
               <CardHeader className="bg-slate-50/50 border-b p-8">
                  <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-800">
                     <User className="h-6 w-6 text-primary" />
                     {isRtl ? 'بيانات الموظف والفترة' : 'Employee & Period Info'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اسم الموظف' : 'Employee Name'}</Label>
                        <p className="text-xl font-black text-slate-900">{leave.userName}</p>
                     </div>
                     <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'تصنيف الإجازة' : 'Leave Type'}</Label>
                        <Badge variant="secondary" className="block w-fit text-lg px-4 py-1 rounded-xl font-black bg-slate-100 uppercase">
                           {leave.type}
                        </Badge>
                     </div>
                  </div>

                  {isAdmin && leave.status === 'pending' ? (
                     <div className="p-8 rounded-[2rem] bg-primary/5 border-2 border-dashed border-primary/20 space-y-6">
                        <h4 className="font-black text-sm text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                           <Scale className="h-4 w-4" /> {isRtl ? 'معالجة الفترة (قانون العمل الكويتي)' : 'Legal Period Processing'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-500 uppercase">{isRtl ? 'تاريخ البداية' : 'Start Date'}</Label>
                              <SmartDateInput value={editForm.startDate} onChange={v => setEditForm({...editForm, startDate: v})} />
                           </div>
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-slate-500 uppercase">{isRtl ? 'تاريخ النهاية' : 'End Date'}</Label>
                              <SmartDateInput value={editForm.endDate} onChange={v => setEditForm({...editForm, endDate: v})} />
                           </div>
                           <div className="space-y-2 md:col-span-2">
                              <Label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                                 <Hash className="h-3 w-3" /> {isRtl ? 'أيام العمل الصافية المستحقة للخصم' : 'Actual Net Working Days'}
                              </Label>
                              <Input 
                                type="number" 
                                value={editForm.workingDays} 
                                onChange={e => setEditForm({...editForm, workingDays: Number(e.target.value)})}
                                className="h-12 rounded-xl border-2 font-black text-lg bg-white"
                              />
                           </div>
                        </div>
                     </div>
                  ) : (
                     <div className="p-8 rounded-[2rem] bg-slate-50/50 border-2 border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="text-center md:text-start space-y-1">
                           <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ البداية' : 'Start Date'}</Label>
                           <p className="text-2xl font-black text-slate-900">{leave.startDate}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-300">
                           <ArrowRight className={cn("h-5 w-5", isRtl && "rotate-180")} />
                        </div>
                        <div className="text-center md:text-end space-y-1">
                           <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'تاريخ النهاية' : 'End Date'}</Label>
                           <p className="text-2xl font-black text-slate-900">{leave.endDate}</p>
                        </div>
                        <div className="px-8 border-s-2 border-slate-200 hidden md:block">
                           <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'أيام العمل المخصومة' : 'Work Days'}</Label>
                           <p className="text-4xl font-black text-primary">{leave.workingDays}</p>
                        </div>
                     </div>
                  )}

                  {leave.type === 'sick' && leave.sickLeaveTiers && (
                    <div className="animate-in slide-in-from-top-4 duration-500">
                      <LeaveTiersDisplay tiers={leave.sickLeaveTiers} />
                    </div>
                  )}

                  <div className="space-y-4 pt-6 border-t border-slate-100">
                     <div className="flex items-center gap-2 text-slate-800">
                        <FileText className="h-5 w-5 text-primary" />
                        <h4 className="font-black text-lg">{isRtl ? 'سبب الإجازة (من الموظف)' : 'Employee Reason'}</h4>
                     </div>
                     <p className="text-lg text-slate-600 bg-slate-50 p-6 rounded-2xl leading-relaxed italic border">
                        {leave.reason || (isRtl ? 'لا يوجد تفاصيل إضافية.' : 'No details provided.')}
                     </p>
                  </div>
               </CardContent>
            </Card>

            {isAdmin && leave.status === 'pending' && (
               <div className="flex gap-4">
                  <Button 
                    onClick={() => handleAction('approved')}
                    disabled={processing}
                    className="flex-1 h-20 rounded-[2rem] bg-emerald-600 text-white font-black text-2xl shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-[0.98] transition-all gap-4 border-b-8 border-emerald-800"
                  >
                     {processing ? <Loader2 className="h-8 w-8 animate-spin" /> : <CheckCircle2 className="h-8 w-8" />}
                     {isRtl ? 'اعتماد الإجازة' : 'Approve Leave'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleAction('rejected')}
                    disabled={processing}
                    className="flex-1 h-20 rounded-[2rem] border-2 border-rose-100 bg-white text-rose-600 font-black text-2xl hover:bg-rose-50 transition-all gap-4"
                  >
                     {processing ? <Loader2 className="animate-spin" /> : <XCircle className="h-8 w-8" />}
                     {isRtl ? 'رفض الطلب' : 'Reject Request'}
                  </Button>
               </div>
            )}
         </div>

         <div className="space-y-6">
            <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-6">
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                     <History className="h-4 w-4 text-primary" /> {isRtl ? 'سجل العمليات' : 'Audit Trail'}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                     <span className="font-bold text-slate-400">{isRtl ? 'تاريخ التقديم' : 'Submitted At'}</span>
                     <span className="font-black text-slate-800">{leave.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                  {leave.approvedAt && (
                     <div className="flex justify-between items-center text-xs border-t pt-4">
                        <span className="font-bold text-slate-400">{isRtl ? 'تاريخ المعالجة' : 'Processed At'}</span>
                        <span className="font-black text-emerald-600">{leave.approvedAt?.toDate().toLocaleDateString()}</span>
                     </div>
                  )}
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}