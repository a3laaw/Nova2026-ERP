'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Calendar, Clock, User, 
  MapPin, MessageSquare, ShieldCheck, 
  Loader2, Briefcase, Workflow, CheckCircle2,
  AlertTriangle, Timer
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { CommentSection } from '@/components/transactions/comment-section';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { AppointmentService } from '@/services/appointment-service';

export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const apptRef = useMemo(() => 
    companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, 
  [db, companyId, apptId]);

  const { data: appt, loading } = useDoc<Appointment>(apptRef);

  const handleComplete = async () => {
    if (!db || !companyId || !user) return;
    try {
      const service = new AppointmentService(db, companyId);
      await service.updateStatus(apptId, 'completed', user.uid);
      toast({ title: isRtl ? "تم إنجاز الموعد" : "Appointment Completed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">{isRtl ? 'الموعد غير موجود' : 'Appointment not found'}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">
               {appt.clientName} | {appt.type}
             </p>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <Button onClick={handleComplete} className="h-14 px-10 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 gap-3 border-b-8 border-emerald-800 hover:scale-105 transition-all">
              <CheckCircle2 className="h-6 w-6" />
              {isRtl ? 'إغلاق وإنجاز الموعد' : 'Complete Appointment'}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-8 space-y-8">
           {/* البطاقة المعلوماتية للموعد */}
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-primary/5 p-8 border-b">
                 <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                       <ShieldCheck className="h-6 w-6 text-primary" />
                       {isRtl ? 'تفاصيل الارتباط الفني' : 'Technical Link Details'}
                    </CardTitle>
                    <Badge className={cn(
                      "font-black px-4 py-1.5 rounded-xl uppercase text-[10px]",
                      appt.status === 'completed' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white shadow-lg"
                    )}>{appt.status}</Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Calendar className="h-5 w-5" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'التاريخ المجدول' : 'Scheduled Date'}</p>
                             <p className="font-black text-slate-800 text-lg">{new Date(appt.start).toLocaleDateString(isRtl ? 'ar-KW' : 'en-US', { dateStyle: 'full' })}</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Clock className="h-5 w-5" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'الوقت' : 'Time'}</p>
                             <p className="font-black text-slate-800 text-lg">{new Date(appt.start).toLocaleTimeString(isRtl ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><User className="h-5 w-5" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'المهندس المسؤول' : 'Assigned Engineer'}</p>
                             <p className="font-black text-slate-800 text-lg">{appt.engineerName}</p>
                          </div>
                       </div>
                       {appt.transactionId && (
                         <div className="flex items-start gap-4 animate-in slide-in-from-top-2">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Workflow className="h-5 w-5" /></div>
                            <div className="text-start">
                               <p className="text-[10px] font-black text-blue-400 uppercase">{isRtl ? 'المشروع والمرحلة' : 'Project & Stage'}</p>
                               <p className="font-black text-slate-800 text-sm">{appt.transactionNumber}</p>
                               <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0 font-black text-[9px] px-2 mt-1">{appt.stageName || 'Linked Stage'}</Badge>
                            </div>
                         </div>
                       )}
                    </div>
                 </div>

                 {appt.notes && (
                   <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner text-start space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                         <MessageSquare className="h-3 w-3" /> {isRtl ? 'ملاحظات الحجز المسبقة' : 'Booking Notes'}
                      </p>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed italic">"{appt.notes}"</p>
                   </div>
                 )}
              </CardContent>
           </Card>

           {/* غرفة العمليات المخصصة للموعد */}
           <div className="pt-4">
              <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden min-h-[500px]">
                 <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg border border-primary/20">
                          <Timer className="h-6 w-6 animate-pulse" />
                       </div>
                       <div className="text-start">
                          <h3 className="text-xl font-black font-headline">{isRtl ? 'غرفة عمليات الموعد' : 'Appointment War Room'}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time meeting logs</p>
                       </div>
                    </div>
                    <Badge className="bg-primary text-white border-0 font-black px-4 h-7 rounded-full text-[10px]">LIVE SYNC</Badge>
                 </div>
                 <div className="p-2 h-[600px]">
                    <CommentSection 
                       transactionId={appt.transactionId || apptId} 
                       path={`companies/${companyId}/appointments/${apptId}/comments`} 
                       title={isRtl ? 'سجل نقاش الموعد' : 'Meeting Interaction Log'}
                    />
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6 text-start">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">{isRtl ? 'عن العميل' : 'Client Snapshot'}</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white">{appt.clientName.charAt(0)}</div>
                    <div className="text-start">
                       <h4 className="font-black text-slate-900 leading-tight">{appt.clientName}</h4>
                       <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Sovereign Client</p>
                    </div>
                 </div>
                 <Button onClick={() => router.push(`/dashboard/clients/${appt.clientId}`)} variant="outline" className="w-full rounded-xl font-black text-[10px] h-11 gap-2 border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                    {isRtl ? 'عرض ملف العميل الكامل' : 'View Full Client File'}
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                 </Button>
              </CardContent>
           </Card>

           <div className="p-8 rounded-[2.5rem] bg-blue-50/50 border-2 border-dashed border-blue-200 flex items-start gap-4">
              <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
              <p className="text-xs text-blue-800 font-bold leading-relaxed">
                 {isRtl 
                   ? 'تنبيه: كافة التعليقات المسجلة هنا تعتبر جزءاً من السجل التاريخي للموعد. إذا كان الموعد مرتبطاً بمشروع، سيتم إدراج ملخص الاجتماع في تقارير المشروع آلياً.' 
                   : 'Note: All comments are part of the permanent log. If linked to a project, these will be synced with project reports automatically.'}
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
