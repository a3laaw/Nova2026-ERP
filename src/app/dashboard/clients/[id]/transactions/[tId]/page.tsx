
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowRight, Activity, Clock, Loader2, 
  History, ShieldCheck, HardHat, ListChecks, 
  Timer, LayoutGrid, Info, CheckCircle2,
  AlertCircle, Lock, User
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance, TransactionTimelineEvent } from '@/types/transaction';
import { cn } from '@/lib/utils';

export default function TransactionDetailsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { check } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // 1. فحص الصلاحيات الميدانية
  const viewAccess = check('projects', 'view');

  // 2. جلب بيانات المعاملة الأساسية
  const transRef = useMemo(() => 
    companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, 
  [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  // 3. جلب مراحل العمل التنفيذية (Stage Instances) مرتبة حسب Order
  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, 
  [db, companyId, transactionId]);
  const { data: stages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  // 4. جلب السجل الزمني للأحداث (Timeline)
  const timelineQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionTimeline(companyId, transactionId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, transactionId]);
  const { data: timeline, loading: timelineLoading } = useCollection<TransactionTimelineEvent>(timelineQuery);

  // حماية أمنية: إذا لم تتوفر الصلاحية أو البيانات
  if (!viewAccess.can) return <div className="h-[60vh] flex flex-col items-center justify-center space-y-4"><Lock className="h-12 w-12 text-rose-500" /><p className="font-black">{isRtl ? 'وصول محجوب' : 'Access Denied'}</p></div>;
  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center font-black text-slate-400">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

  const progressPercent = stages?.length ? Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      
      {/* Header - Transaction Identity */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => router.push(`/dashboard/clients/${clientId}`)} 
            className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50 transition-all shrink-0"
          >
            <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-4 flex-wrap">
                <div className="h-12 px-5 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg border-2 border-primary/20 shadow-inner">
                   {transaction.transactionNumber}
                </div>
                <div>
                   <h1 className="text-2xl font-black font-headline text-slate-900 tracking-tight leading-tight">{transaction.subServiceName}</h1>
                   <div className="flex items-center gap-3 mt-1">
                      <Badge className={cn(
                          "font-black px-3 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[9px]",
                          transaction.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                      )}>
                          {transaction.status}
                      </Badge>
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Activity className="h-3 w-3 text-primary" /> {transaction.activityTypeName}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           <Button variant="outline" size="sm" className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-white border-2 font-black text-xs gap-2">
              <Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
           <Button size="sm" className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-primary text-white font-black text-xs shadow-lg shadow-primary/20">
              {isRtl ? 'إرسال تحديث' : 'Send Update'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Column: Technical Path & Pipeline */}
        <div className="lg:col-span-8 space-y-8">
           
           {/* Detailed Information Card */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <div className="bg-slate-50/50 p-8 border-b grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'العميل' : 'Client'}</p>
                    <p className="text-sm font-black text-slate-800">{transaction.clientName}</p>
                 </div>
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'المهندس المسؤول' : 'Engineer'}</p>
                    <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                       <HardHat className="h-4 w-4 text-primary" /> {transaction.assignedEngineerName}
                    </p>
                 </div>
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'تاريخ البدء' : 'Start Date'}</p>
                    <p className="text-sm font-black text-slate-800 font-mono">{transaction.createdAt?.toDate().toLocaleDateString()}</p>
                 </div>
              </div>
              <CardContent className="p-8 text-start">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{isRtl ? 'وصف المتطلبات' : 'Requirements Description'}</p>
                 <p className="text-slate-600 leading-relaxed italic">{transaction.description || (isRtl ? 'لا يوجد وصف.' : 'No description.')}</p>
              </CardContent>
           </Card>

           {/* Progress Section */}
           <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                 <div className="text-start">
                    <h3 className="text-xl font-black font-headline text-slate-800 flex items-center gap-2">
                       <LayoutGrid className="h-6 w-6 text-primary" />
                       {isRtl ? 'مسار التنفيذ الفني' : 'Technical Work Pipeline'}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">{isRtl ? 'تتبع مراحل العمل الميدانية والتحصيلية' : 'Tracking field and billing stages'}</p>
                 </div>
                 <div className="text-end">
                    <span className="text-3xl font-black font-headline text-primary">{progressPercent}%</span>
                 </div>
              </div>
              
              <div className="space-y-4">
                 {stages?.map((stage, idx) => (
                    <Card key={stage.id} className={cn(
                      "border-0 shadow-lg rounded-[2rem] bg-white transition-all overflow-hidden border-s-8",
                      stage.status === 'completed' ? 'border-s-emerald-500 opacity-80' : 
                      stage.status === 'in-progress' ? 'border-s-blue-500 ring-4 ring-blue-500/5' : 'border-s-slate-100'
                    )}>
                      <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                         <div className="flex items-center gap-6 flex-1 text-start">
                            <div className={cn(
                               "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border",
                               stage.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'
                            )}>
                               {stage.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}
                            </div>
                            <div className="space-y-1">
                               <h4 className="font-black text-lg text-slate-900 tracking-tight">{stage.name}</h4>
                               <div className="flex flex-wrap gap-3">
                                  {stage.isNumeric && (
                                     <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] font-black border-emerald-100 border gap-1">
                                        <ListChecks className="h-3 w-3" /> {isRtl ? 'المستهدف:' : 'Target:'} {stage.currentCount} / {stage.numericTarget}
                                     </Badge>
                                  )}
                                  {stage.isTimed && (
                                     <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px] font-black border-blue-100 border gap-1">
                                        <Timer className="h-3 w-3" /> {isRtl ? 'المدة:' : 'Duration:'} {stage.timeTargetDays} {isRtl ? 'يوم' : 'Days'}
                                     </Badge>
                                  )}
                                  {stage.isRequired && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1"><AlertCircle className="h-2 w-2" /> Required</span>}
                               </div>
                            </div>
                         </div>

                         <div className="text-end shrink-0">
                            <Badge className={cn(
                               "font-black px-4 py-1.5 rounded-xl border-0 shadow-inner text-[10px] uppercase",
                               stage.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                               stage.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                            )}>
                               {stage.status}
                            </Badge>
                         </div>
                      </CardContent>
                    </Card>
                 ))}
              </div>
           </div>
        </div>

        {/* Sidebar Column: Timeline & History */}
        <div className="lg:col-span-4 space-y-8">
           
           {/* Quick Stats Summary */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 text-white p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                 <ShieldCheck className="h-24 w-24" />
              </div>
              <div className="text-start relative z-10 space-y-6">
                 <h3 className="text-primary font-black uppercase text-xs tracking-[0.2em]">{isRtl ? 'رادار الإنجاز اللحظي' : 'Completion Radar'}</h3>
                 <div className="space-y-2">
                    <p className="text-5xl font-black font-headline text-white">{progressPercent}%</p>
                    <p className="text-xs font-bold text-slate-400">{isRtl ? 'معدل إنجاز المسار الفني' : 'Pipeline completion rate'}</p>
                 </div>
                 <div className="pt-6 border-t border-white/10 flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                    <span>{isRtl ? 'المراحل:' : 'Stages:'} {stages?.length || 0}</span>
                    <span className="text-emerald-400">{isRtl ? 'مكتمل:' : 'Done:'} {stages?.filter(s => s.status === 'completed').length || 0}</span>
                 </div>
              </div>
           </Card>

           {/* Timeline Log */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col min-h-[500px]">
              <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                 <History className="h-5 w-5 text-primary" />
                 <CardTitle className="text-sm font-black uppercase tracking-widest">{isRtl ? 'السجل الزمني للأحداث' : 'Transaction Timeline'}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide text-start">
                 <div className="relative p-6">
                    {/* Vertical Line */}
                    <div className={cn("absolute top-0 bottom-0 w-[1.5px] bg-slate-100", isRtl ? "right-9" : "left-9")} />
                    
                    <div className="space-y-8">
                       {timelineLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto opacity-20" /></div> : (
                         timeline?.map((event) => (
                           <div key={event.id} className="relative ps-10">
                              {/* Indicator Circle */}
                              <div className={cn(
                                "absolute top-1 h-3 w-3 rounded-full border-2 border-white shadow-md z-10",
                                event.type === 'system' ? 'bg-primary' : 
                                event.type === 'stage_complete' ? 'bg-emerald-500' : 'bg-blue-500',
                                isRtl ? "right-0" : "left-0"
                              )} />
                              
                              <div className="space-y-1">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[8px] font-mono text-slate-400 font-bold uppercase">
                                       {event.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase border-slate-100 h-4 px-2">
                                       {event.type}
                                    </Badge>
                                 </div>
                                 <p className="text-xs font-bold text-slate-700 leading-relaxed">{event.content}</p>
                                 <div className="flex items-center gap-1.5 pt-1 text-[9px] font-black text-primary uppercase">
                                    <User className="h-2.5 w-2.5" /> {event.userName}
                                 </div>
                              </div>
                           </div>
                         ))
                       )}
                       {!timeline?.length && !timelineLoading && (
                         <div className="py-20 text-center text-[10px] text-slate-300 font-bold italic">لا يوجد أحداث مسجلة.</div>
                       )}
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 rounded-[2rem] bg-blue-50 border-2 border-dashed border-blue-200 flex items-start gap-4 text-start">
              <Info className="h-5 w-5 text-blue-600 mt-1 shrink-0" />
              <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                 {isRtl 
                   ? 'ملاحظة: يتم تحديث هذا المسار آلياً عند إكمال المهندس للمراحل الميدانية. أي تأخير في المراحل "الإلزامية" قد يعيق تقدم المعاملة بالكامل.' 
                   : 'Note: This pipeline updates automatically. Delays in "Required" stages may block the entire transaction progress.'}
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
