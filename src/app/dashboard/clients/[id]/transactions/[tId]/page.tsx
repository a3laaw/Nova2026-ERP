
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  ArrowRight, Activity, Clock, Loader2, 
  CheckCircle2, AlertCircle, History, 
  ShieldCheck, HardHat, ListChecks, Timer,
  PlayCircle, MoreHorizontal, UserCog, Send
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Transaction, StageInstance, TransactionTimelineEvent } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function TransactionExecutionPage() {
  const params = useParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const transRef = useMemo(() => 
    companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, 
  [db, companyId, transactionId]);
  const { data: transaction, loading: transLoading } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, 
  [db, companyId, transactionId]);
  const { data: stages, loading: stagesLoading } = useCollection<StageInstance>(stagesQuery);

  const timelineQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactionTimeline(companyId, transactionId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, transactionId]);
  const { data: timeline, loading: timelineLoading } = useCollection<TransactionTimelineEvent>(timelineQuery);

  const transService = useMemo(() => 
    db && companyId ? new TransactionService(db, companyId) : null, 
  [db, companyId]);

  const handleStart = async (stage: StageInstance) => {
    if (!transService || !user) return;
    setUpdatingId(stage.id!);
    try {
      await transService.startStage(transactionId, stage.id!, stage.name, user.uid, user.displayName || 'System');
      toast({ title: isRtl ? 'تم بدء المرحلة' : 'Stage Started' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleComplete = async (stage: StageInstance) => {
    if (!transService || !user) return;
    setUpdatingId(stage.id!);
    try {
      await transService.completeStage(transactionId, stage.id!, stage.name, user.uid, user.displayName || 'System');
      toast({ title: isRtl ? 'تم إنجاز المرحلة' : 'Stage Completed' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateNumeric = async (stage: StageInstance, value: number) => {
    if (!transService || !user) return;
    try {
      await transService.updateStageNumeric(transactionId, stage.id!, stage.name, value, user.uid, user.displayName || 'System');
    } catch (e) {}
  };

  if (transLoading || stagesLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!transaction) return <div className="p-20 text-center">{isRtl ? 'المعاملة غير موجودة' : 'Transaction not found'}</div>;

  const progressPercent = stages?.length ? Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20" dir={dir}>
      
      {/* Visual Slime-Down of Header (Matching Request Image Style but smaller) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button 
            variant="ghost" 
            onClick={() => router.push(`/dashboard/clients/${clientId}`)} 
            className="h-9 w-9 p-0 rounded-xl bg-white shadow-sm border border-slate-200 hover:bg-slate-50 transition-all shrink-0"
          >
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-3 flex-wrap">
                <div className="h-10 px-4 w-fit min-w-[3rem] rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border-2 border-primary/20 shadow-inner">
                   {transaction.transactionNumber}
                </div>
                <div className="min-w-[120px]">
                   <h1 className="text-xl font-black font-headline text-slate-900 tracking-tight leading-tight">{transaction.subServiceName}</h1>
                   <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn(
                          "font-black px-2 py-0.5 rounded-lg border-0 shadow-sm uppercase text-[7px]",
                          transaction.status === 'completed' ? 'bg-emerald-500 text-white' : 
                          transaction.status === 'in-progress' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                      )}>
                          {transaction.status}
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 italic">
                          <Activity className="h-2.5 w-2.5 text-primary" /> {transaction.activityTypeName}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
           <Button variant="outline" size="sm" className="flex-1 md:flex-none h-9 px-4 rounded-xl bg-white border-2 font-black text-[10px] gap-2">
              <HardHat className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'الفريق الفني' : 'Staff'}
           </Button>
           <Button size="sm" className="flex-1 md:flex-none h-9 px-5 rounded-xl bg-primary text-white font-black text-[10px] shadow-lg shadow-primary/10 gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> {isRtl ? 'اعتماد نهائي' : 'Final Approve'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
           
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <CardContent className="p-5">
                 <div className="flex justify-between items-end mb-4">
                    <div className="text-start">
                       <h3 className="text-sm font-black font-headline text-slate-800">{isRtl ? 'تقدم المسار الفني' : 'Technical Progress'}</h3>
                       <p className="text-[9px] font-bold text-slate-400">{isRtl ? 'متابعة مراحل التنفيذ الفعلي' : 'Tracking operational stages'}</p>
                    </div>
                    <div className="text-end">
                       <span className="text-2xl font-black font-headline text-primary">{progressPercent}%</span>
                    </div>
                 </div>
                 <Progress value={progressPercent} className="h-2 rounded-full bg-slate-100" />
              </CardContent>
           </Card>

           <div className="space-y-3">
              {stages?.map((stage, idx) => (
                <Card key={stage.id} className={cn(
                  "border-0 shadow-sm rounded-2xl bg-white transition-all overflow-hidden group border-s-4",
                  stage.status === 'completed' ? 'opacity-80 border-s-emerald-500' : 
                  stage.status === 'in-progress' ? 'ring-2 ring-blue-500/10 border-s-blue-500' :
                  stage.status === 'blocked' ? 'grayscale opacity-60 border-s-slate-200' : 'border-s-slate-200'
                )}>
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-center">
                       <div className="p-4 flex items-center gap-4 flex-1 text-start">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner border",
                            stage.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            stage.status === 'in-progress' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'
                          )}>
                             {stage.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : (idx + 1)}
                          </div>
                          <div>
                             <h4 className="text-sm font-black text-slate-800 tracking-tight">{stage.name}</h4>
                             <div className="flex gap-2 mt-1">
                                {stage.isTimed && (
                                  <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                                     <Timer className="h-2.5 w-2.5" /> {stage.timeTargetDays} {isRtl ? 'يوم' : 'Days'}
                                  </span>
                                )}
                                {stage.isNumeric && (
                                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                                     <ListChecks className="h-2.5 w-2.5" /> {isRtl ? 'مستهدف:' : 'Target:'} {stage.numericTarget}
                                  </span>
                                )}
                             </div>
                          </div>
                       </div>

                       <div className="p-4 bg-slate-50/50 md:border-s flex items-center gap-3 min-w-[220px] justify-center">
                          {stage.status === 'pending' && (
                            <Button 
                              size="sm"
                              onClick={() => handleStart(stage)}
                              disabled={updatingId === stage.id}
                              className="bg-primary text-white font-black rounded-lg h-9 px-4 text-[10px] shadow-sm gap-2"
                            >
                               {updatingId === stage.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                               {isRtl ? 'بدء' : 'Start'}
                            </Button>
                          )}

                          {stage.status === 'in-progress' && (
                            <Button 
                              size="sm"
                              onClick={() => handleComplete(stage)}
                              disabled={updatingId === stage.id}
                              className="bg-emerald-600 text-white font-black rounded-lg h-9 px-4 text-[10px] shadow-sm gap-2"
                            >
                               {updatingId === stage.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                               {isRtl ? 'إكمال' : 'Done'}
                            </Button>
                          )}

                          {stage.status === 'completed' && (
                            <div className="text-end px-2">
                               <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">{isRtl ? 'تم الإنجاز' : 'Completed'}</p>
                               <p className="text-[7px] text-slate-400 font-bold">{stage.completedAt?.toDate().toLocaleDateString()}</p>
                            </div>
                          )}
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
           </div>
        </div>

        <div className="space-y-6">
           <Card className="border-0 shadow-lg rounded-2xl bg-slate-900 text-white overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5 p-5 text-start">
                 <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isRtl ? 'ملخص المعاملة' : 'Summary'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-start">
                 <div className="space-y-0.5">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{isRtl ? 'العميل' : 'Client'}</p>
                    <p className="text-sm font-black text-white">{transaction.clientName}</p>
                 </div>
                 <div className="h-[1px] bg-white/5" />
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[8px] font-black text-slate-500 uppercase">{isRtl ? 'المسؤول' : 'Assigned'}</p>
                       <p className="text-[10px] font-bold text-slate-200 mt-0.5">{transaction.assignedEngineerName || '---'}</p>
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-slate-500 uppercase">{isRtl ? 'تاريخ البدء' : 'Started'}</p>
                       <p className="text-[10px] font-mono font-bold text-slate-200 mt-0.5">{transaction.createdAt?.toDate().toLocaleDateString()}</p>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden flex flex-col h-full min-h-[400px]">
              <CardHeader className="bg-slate-50/50 border-b p-4">
                 <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isRtl ? 'السجل الزمني' : 'Timeline'}</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] scrollbar-hide text-start">
                 {timelineLoading ? (
                    <div className="p-20 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/20" /></div>
                 ) : (
                    <div className="relative p-5">
                       <div className={cn("absolute top-0 bottom-0 w-[1.5px] bg-slate-100", isRtl ? "right-8" : "left-8")} />
                       <div className="space-y-5">
                          {timeline?.map((event) => (
                            <div key={event.id} className="relative ps-8">
                               <div className={cn(
                                 "absolute top-1 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm z-10",
                                 event.type === 'stage_complete' ? "bg-emerald-500" : 
                                 event.type === 'stage_start' ? "bg-blue-500" : "bg-slate-300",
                                 isRtl ? "right-0" : "left-0"
                               )} />
                               <div className="space-y-0.5">
                                  <div className="flex justify-between items-start">
                                     <span className="text-[7px] font-mono text-slate-400 font-bold uppercase">
                                        {event.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                     </span>
                                     <Badge variant="outline" className="text-[6px] font-black uppercase h-3 py-0 border-slate-100">
                                        {event.type}
                                     </Badge>
                                  </div>
                                  <p className="text-[11px] font-bold text-slate-700 leading-tight">{event.content}</p>
                                  <p className="text-[7px] text-primary uppercase font-black">{event.userName}</p>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
