'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, Workflow, CheckCircle2,
  AlertTriangle, Hammer, Check, Layers, Save,
  Target, X, RotateCcw, Lock, Info, AlertCircle, Play,
  Users, Truck, Plus, Trash2, HardHat, Link as LinkIcon,
  ShieldAlert, Settings2, History, ShieldX, Sparkles
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem, BOQItemExecutionEntry, LaborDetail, EquipmentUsed } from '@/types/documents';
import { CommentSection } from '@/components/transactions/comment-section';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
import { AppointmentService } from '@/services/appointment-service';
import { TransactionService } from '@/services/transaction-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function AppointmentDetailPage() {
  const apptId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions, check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");
  
  const [laborDetails, setLaborDetails] = useState<LaborDetail[]>([{ trade: '', count: 1 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<EquipmentUsed[]>([]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);

  // حالات تسجيل المراجعة (Revision) الموحدة
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionStage, setRevisionStage] = useState<StageInstance | null>(null);
  const [revisionComment, setRevisionComment] = useState("");

  const apptRef = useMemo(() => 
    companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, 
  [db, companyId, apptId]);
  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  const transRef = useMemo(() => 
    companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null,
  [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const isConsulting = useMemo(() => {
    const name = transaction?.activityTypeName || '';
    return name.includes('استشارات') || name.includes('Consulting') || name.includes('تصميم') || name.includes('Design');
  }, [transaction]);

  const stagesQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null,
  [db, companyId, appt?.transactionId]);
  const { data: rawStages } = useCollection<StageInstance>(stagesQuery);

  const { stages, isEligible, blockerStage } = useMemo(() => {
    const allStages = (rawStages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const apptDeptId = appt?.departmentId;

    if (!apptDeptId) return { stages: allStages, isEligible: true };

    const filteredStages = allStages.filter(s => s.allowedDepartmentIds?.includes(apptDeptId));
    if (filteredStages.length === 0) return { stages: [], isEligible: false };

    const firstDeptStageOrder = filteredStages[0].order;
    const previousStages = allStages.filter(s => s.order < firstDeptStageOrder);
    const incompleteBlocker = previousStages.find(s => s.status !== 'completed');

    return {
      stages: filteredStages,
      isEligible: !incompleteBlocker,
      blockerStage: incompleteBlocker
    };
  }, [rawStages, appt?.departmentId]);

  const boqQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', appt.transactionId), limit(1)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => 
    companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null,
  [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const execsQuery = useMemo(() => 
    companyId && db && appt?.transactionId ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', appt.transactionId)) : null,
  [db, companyId, appt?.transactionId]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(execsQuery);

  const hasMadeProgress = useMemo(() => {
     return (allExecutions || []).some(e => e.appointmentId === apptId);
  }, [allExecutions, apptId]);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);
  const transactionService = useMemo(() => (db && companyId) ? new TransactionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  useEffect(() => {
    let active = true;
    async function fetchAllProgress() {
      if (!executionService || !stages || stages.length === 0 || !appt?.transactionId) return;
      const results: Record<string, StageProgressResult> = {};
      const promises = stages.map(async (s) => {
        const res = await executionService.getTechnicalStageProgress(appt.transactionId!, s.technicalStageId);
        return { id: s.technicalStageId, res };
      });
      const resolved = await Promise.all(promises);
      resolved.forEach(item => { results[item.id] = item.res; });
      if (active) setStageProgressMap(results);
    }
    fetchAllProgress();
    return () => { active = false; };
  }, [executionService, stages, appt?.transactionId, allExecutions]);

  const handleLinkToProject = async (transId: string) => {
    if (!db || !companyId || !apptId) return;
    setLoadingAction('linking');
    try {
      const trans = availableTransactions.find(t => t.id === transId);
      await updateDoc(doc(db, paths.appointments(companyId), apptId), {
        transactionId: transId,
        transactionNumber: trans?.transactionNumber || '',
        updatedAt: serverTimestamp()
      });
      toast({ title: isRtl ? "تم ربط الموعد بالمعاملة بنجاح" : "Appointment linked to project" });
      setIsLinkOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartStage = async (stageId: string) => {
    if (!transactionService || !user || !appt?.transactionId) return;
    setProcessingId(stageId);
    try {
      await transactionService.startStage(appt.transactionId, stageId, user.uid, globalUser?.username || 'User', globalUser?.departmentId, apptId);
      toast({ title: isRtl ? "تم بدء العمل" : "Stage Started" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteStage = async (stage: StageInstance, force: boolean = false) => {
    if (!transactionService || !user || !stage.id || !appt?.transactionId) return;
    setProcessingId(stage.id);
    try {
      await transactionService.completeStage(appt.transactionId, stage.id, user.uid, globalUser?.username || 'User', globalUser?.departmentId, force, apptId);
      toast({ title: isRtl ? "تم إنجاز المرحلة" : "Stage Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRevisionDialog = (stage: StageInstance) => {
    setRevisionStage(stage);
    setRevisionComment("");
    setIsRevisionOpen(true);
  };

  const handleConfirmRevision = async () => {
    if (!transactionService || !user || !revisionStage || !revisionComment.trim() || !appt?.transactionId) return;
    setProcessingId(`rev_${revisionStage.id}`);
    setIsRevisionOpen(false);
    try {
      await transactionService.incrementStageRevision(appt.transactionId, revisionStage.id!, user.uid, globalUser?.username || 'User', revisionComment, globalUser?.departmentId, apptId);
      toast({ title: isRtl ? "تم تسجيل دورة مراجعة جديدة" : "Revision Cycle Logged" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingId(null);
      setRevisionStage(null);
    }
  };

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || !selectedItemId || !selectedStageId) return;
    const qtyInput = progressQty === "" ? 0 : Number(progressQty);
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      await service.recordBOQItemExecution(
        activeBoq.id, selectedItemId, stage.technicalStageId, qtyInput, 
        user.uid, globalUser?.username || 'User', progressNotes, 
        selectedStageId, false, apptId, 
        { laborDetails, equipmentUsed }
      );
      
      toast({ title: isRtl ? "تم تسجيل الإنجاز والموارد" : "Progress & Resources Logged" });
      setIsRecordOpen(false);
      setProgressQty(""); setProgressNotes(""); setSelectedItemId("");
      setLaborDetails([{ trade: '', count: 1 }]); setEquipmentUsed([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const forceThaw = useCallback(() => {
    if (typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
       document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  const [availableTransactions, setAvailableTransactions] = useState<any[]>([]);
  useEffect(() => {
    if (isLinkOpen && db && companyId && appt?.clientId) {
      getDocs(query(collection(db, paths.transactions(companyId)), where('clientId', '==', appt.clientId)))
        .then(snap => setAvailableTransactions(snap.docs.map(d => ({id: d.id, ...d.data()}))))
        .catch(() => setAvailableTransactions([]));
    }
  }, [isLinkOpen, db, companyId, appt?.clientId]);

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-12 w-12 border-2 rounded-2xl bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                  {appt.clientName} | {transaction?.transactionNumber || 'External Mission'}
                </span>
                {!appt.transactionId && (
                  <Button variant="ghost" size="sm" onClick={() => setIsLinkOpen(true)} className="h-5 px-2 rounded-md text-[8px] font-black bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all gap-1">
                     <LinkIcon className="h-2 w-2" /> {isRtl ? 'ربط بمعاملة' : 'Link Project'}
                  </Button>
                )}
             </div>
           </div>
        </div>
        
        {appt.status !== 'completed' && (
           <Button 
             disabled={appt.transactionId && !hasMadeProgress}
             onClick={() => {
                if (db && companyId && user) {
                   const service = new AppointmentService(db, companyId);
                   service.updateStatus(apptId, 'completed', user.uid).then(() => {
                     toast({ title: isRtl ? "تم إنجاز الموعد وإغلاق الملف" : "Appt Completed" });
                     router.push('/dashboard/appointments');
                   });
                }
             }} 
             className={cn(
               "h-14 px-10 rounded-2xl font-black text-lg shadow-xl gap-3 border-b-8 transition-all",
               (appt.transactionId && !hasMadeProgress) 
                ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-50"
                : "bg-emerald-600 text-white shadow-emerald-100 border-emerald-800"
             )}
           >
               {appt.transactionId && !hasMadeProgress ? <ShieldAlert className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
               {isRtl 
                 ? (appt.transactionId && !hasMadeProgress ? 'يرجى تسجيل إنجاز فني أولاً' : 'إغلاق وإنجاز الموعد') 
                 : (appt.transactionId && !hasMadeProgress ? 'Log progress to complete' : 'Complete Appointment')}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 p-8 text-slate-900 border-b flex flex-row justify-between items-center text-start">
                 <div className="text-start">
                    <CardTitle className="text-xl font-black flex items-center gap-3">
                       <Target className="h-6 w-6 text-primary" />
                       {isRtl ? `رادار التنفيذ (${appt.departmentName || 'عام'})` : `${appt.departmentName || 'General'} Radar`}
                    </CardTitle>
                 </div>
                 {appt.status !== 'completed' && appt.transactionId && isEligible && (
                    <Button onClick={() => setIsRecordOpen(true)} className="btn-gradient h-12 px-8 rounded-xl gap-2 shadow-lg">
                       <Hammer className="h-4 w-4" /> {isRtl ? 'تسجيل إنجاز فني' : 'Log Progress'}
                    </Button>
                 )}
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 {!appt.transactionId ? (
                   <div className="py-24 text-center flex flex-col items-center gap-6 opacity-30">
                      <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300">
                         <Workflow className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                         <p className="text-lg font-black text-slate-800">{isRtl ? 'موعد خارجي (بدون مسار فني)' : 'External Mission'}</p>
                         <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto">
                            {isRtl ? 'هذا الموعد غير مرتبط بمعاملة فنية. قم بربطه بمشروع لعرض مراحل التنفيذ والمقايسة.' : 'This appointment is not linked to a technical transaction. Link it to view stages.'}
                         </p>
                      </div>
                   </div>
                 ) : !isEligible ? (
                   <div className="py-24 text-center flex flex-col items-center gap-6">
                      <div className="w-24 h-24 bg-rose-50 rounded-[3rem] flex items-center justify-center text-rose-500 shadow-inner ring-8 ring-rose-50/50">
                         <ShieldX className="h-12 w-12" />
                      </div>
                      <div className="space-y-3">
                         <p className="text-xl font-black text-rose-900">
                            {isRtl ? 'العميل لم يصل لهذه المرحلة بعد' : 'Project Sequence Violation'}
                         </p>
                         <p className="text-sm font-bold text-slate-400 max-w-sm mx-auto leading-relaxed">
                            {isRtl 
                              ? `تنبيه: لا يمكن بدء أعمال ${appt.departmentName} قبل إنجاز مرحلة "${blockerStage?.name}" السابقة. يرجى مراجعة الجدول الزمني للمشروع.` 
                              : `Cannot start ${appt.departmentName} work until "${blockerStage?.name}" is completed. Review project schedule.`}
                         </p>
                      </div>
                      <Button variant="outline" onClick={() => router.push(`/dashboard/clients/${appt.clientId}/transactions/${appt.transactionId}`)} className="rounded-xl border-2 font-black h-11 px-8 gap-2">
                         <Target className="h-4 w-4" /> {isRtl ? 'عرض الجدول الزمني للمشروع' : 'View Schedule'}
                      </Button>
                   </div>
                 ) : stages.length === 0 ? (
                   <div className="py-24 text-center flex flex-col items-center gap-6">
                      <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center text-amber-500 shadow-inner">
                         <ShieldAlert className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                         <p className="text-lg font-black text-slate-800">
                            {isRtl ? 'تنبيه: مراحل مخفية أو غير مفعمة' : 'Stages Restricted or Not Active'}
                         </p>
                         <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto leading-relaxed">
                            {isRtl 
                              ? `لا توجد مراحل تتبع قسمك المختار (${appt.departmentName || '---'}) في هذا المسار. يرجى مراجعة "هندسة المسارات" في الإعدادات.` 
                              : `No stages for the selected department (${appt.departmentName}) found. Check path settings.`}
                         </p>
                      </div>
                   </div>
                 ) : stages.map((stage, idx) => {
                    const isSelected = stage.id === selectedStageId;
                    const isPreviousCompleted = idx === 0 || stages[idx-1].status === 'completed';
                    const isReadyToStart = stage.status === 'pending' && isPreviousCompleted;
                    
                    // قفل تخصصي إضافي في الواجهة: هل يحق للموظف لمس هذه المرحلة؟
                    const isDeptAllowed = !stage.allowedDepartmentIds?.length || (globalUser?.departmentId && stage.allowedDepartmentIds.includes(globalUser.departmentId));

                    return (
                       <div key={stage.id} onClick={() => setSelectedStageId(stage.id!)} className={cn("p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col gap-4 group", isSelected ? "bg-primary/5 border-primary shadow-lg scale-[1.01]" : "bg-white border-slate-100 hover:border-slate-200")}>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs border shadow-sm", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-400")}>{stage.status === 'completed' ? <Check className="h-5 w-5" /> : (idx + 1)}</div>
                                <div className="text-start">
                                   <div className="flex items-center gap-2">
                                      <p className={cn("text-base font-black leading-tight", isSelected ? "text-primary" : "text-slate-800")}>{stage.name}</p>
                                      {isReadyToStart && (
                                         <Badge className="bg-orange-100 text-orange-700 border-0 font-black text-[7px] px-2 h-4 animate-ready-pulse uppercase">
                                            {isRtl ? 'جاهزة للبدء' : 'Ready'}
                                         </Badge>
                                      )}
                                      {isConsulting && (stage.revisionCount || 0) > 0 && (
                                        <Badge className="bg-orange-100 text-orange-700 border-0 font-black text-[9px] px-2 h-5">
                                          {isRtl ? `مراجعة #${stage.revisionCount}` : `Rev #${stage.revisionCount}`}
                                        </Badge>
                                      )}
                                      {!isAdmin && !isDeptAllowed && (
                                         <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 font-black text-[7px] gap-1 h-4">
                                            <Lock className="h-2 w-2" /> {isRtl ? 'خاص بقسم آخر' : 'Locked'}
                                         </Badge>
                                      )}
                                   </div>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1">{stage.status}</p>
                                </div>
                             </div>
                          </div>
                          {isSelected && (stage.status === 'pending' || stage.status === 'in-progress') && (
                             <div className="flex gap-3 animate-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                {stage.status === 'pending' && (
                                   <Button 
                                     onClick={() => handleStartStage(stage.id!)} 
                                     disabled={!!processingId || (!isAdmin && !isDeptAllowed)} 
                                     className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black text-xs gap-2 shadow-lg hover:scale-105 transition-all"
                                   >
                                      {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
                                      {isRtl ? 'بدء العمل' : 'Start'}
                                   </Button>
                                )}
                                {stage.status === 'in-progress' && (
                                   <Button 
                                     onClick={() => handleCompleteStage(stage)} 
                                     disabled={!!processingId || (!isAdmin && !isDeptAllowed)} 
                                     className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xs gap-2 shadow-lg hover:scale-105 transition-all"
                                   >
                                      {processingId === stage.id ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                      {isRtl ? 'إكمال' : 'Done'}
                                   </Button>
                                )}
                                {stage.status === 'in-progress' && isConsulting && (
                                  <Button 
                                    onClick={() => handleOpenRevisionDialog(stage)} 
                                    disabled={!!processingId || (!isAdmin && !isDeptAllowed)} 
                                    variant="outline" 
                                    className="flex-1 h-12 rounded-2xl border-orange-200 text-orange-600 font-black text-xs gap-2 hover:bg-orange-50"
                                  >
                                    {processingId === `rev_${stage.id}` ? <Loader2 className="animate-spin h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                                    {isRtl ? 'تسجيل دورة تعديل' : 'Log Revision'}
                                  </Button>
                                )}
                             </div>
                          )}
                       </div>
                    );
                 })}
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-5 flex flex-col h-[700px]">
           <div className="bg-white rounded-[3rem] shadow-2xl border border-primary/10 overflow-hidden flex-1 flex flex-col">
              <CommentSection 
                transactionId={appt.transactionId || apptId} 
                appointmentId={apptId} 
                path={appt.transactionId ? paths.transactionComments(companyId!, appt.transactionId) : `companies/${companyId}/appointments/${apptId}/comments`} 
                title={isRtl ? 'غرفة عمليات المعاملة' : 'Transaction War Room'} 
              />
           </div>
        </div>
      </div>

      {/* مودال تسجيل مراجعة التصميم الموحد */}
      <Dialog open={isRevisionOpen} onOpenChange={(v) => { if(!v) setIsRevisionOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 max-w-lg border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-orange-50 p-6 border-b text-orange-900 text-start">
               <DialogTitle className="text-xl font-black flex items-center gap-3">
                  <RotateCcw className="h-6 w-6" /> {isRtl ? 'توثيق مراجعة وتعديل التصميم' : 'Log Design Revision'}
               </DialogTitle>
               <p className="text-xs font-bold mt-1 opacity-70">{revisionStage?.name}</p>
            </div>
            <div className="p-8 space-y-4 text-start bg-white">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'أسباب أو تفاصيل التعديل' : 'Revision Notes / Reason'}</Label>
               <Textarea value={revisionComment} onChange={e => setRevisionComment(e.target.value)} placeholder={isRtl ? "اكتب هنا تفاصيل التعديلات التي تمت على المخطط..." : "Describe the changes made..."} className="min-h-[120px] rounded-2xl border-2 p-5 text-sm font-bold bg-slate-50 focus:bg-white transition-all shadow-inner" />
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button variant="outline" onClick={() => setIsRevisionOpen(false)} className="flex-1 h-12 rounded-xl font-bold bg-white">إلغاء</Button>
               <Button onClick={handleConfirmRevision} disabled={!revisionComment.trim()} className="flex-[2] h-12 rounded-xl bg-orange-600 text-white font-black text-lg shadow-xl shadow-orange-200">
                  <Save className="h-5 w-5" /> {isRtl ? 'اعتماد دورة التعديل' : 'Confirm Revision'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* مودال الربط بالمعاملة */}
      <Dialog open={isLinkOpen} onOpenChange={(v) => { if(!v) setIsLinkOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden max-w-lg border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-900 p-8 text-white text-start">
               <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3">
                  <LinkIcon className="h-7 w-7 text-primary" />
                  {isRtl ? 'ربط الموعد بمشروع قائم' : 'Link to Existing Project'}
               </DialogTitle>
            </div>
            <div className="p-8 space-y-6 text-start bg-white">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'اختر المعاملة الفنية' : 'Select Transaction'}</Label>
               <div className="space-y-2">
                  {availableTransactions.length === 0 ? (
                    <div className="p-10 text-center border-2 border-dashed rounded-2xl bg-slate-50">
                       <p className="text-xs font-bold text-slate-400">{isRtl ? 'لا يوجد معاملات جارية لهذا العميل.' : 'No active projects for this client.'}</p>
                    </div>
                  ) : availableTransactions.map(t => (
                    <div key={t.id} onClick={() => handleLinkToProject(t.id)} className="p-4 rounded-xl border-2 border-slate-100 hover:border-primary/20 hover:bg-primary/5 cursor-pointer transition-all flex justify-between items-center group">
                       <div className="text-start">
                          <p className="font-black text-sm text-slate-800 group-hover:text-primary">{t.subServiceName}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase">#{t.transactionNumber}</p>
                       </div>
                       <ArrowRight className={cn("h-4 w-4 text-slate-200 group-hover:text-primary transition-all", isRtl && "rotate-180")} />
                    </div>
                  ))}
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t">
               <Button variant="outline" onClick={() => setIsLinkOpen(false)} className="w-full h-12 rounded-xl font-bold bg-white">إلغاء</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isRecordOpen} onOpenChange={(v) => { if(!v) setIsRecordOpen(false); forceThaw(); }}>
         <DialogContent className="rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white max-w-2xl flex flex-col max-h-[95vh]" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 border-b shrink-0 text-start">
               <DialogTitle className="text-xl font-black flex items-center gap-3"><Hammer className="h-6 w-6 text-primary" />{isRtl ? 'تسجيل إنجاز فني وموارد الموقع' : 'Log Site Progress & Resources'}</DialogTitle>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 text-start scrollbar-hide bg-white">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Target Stage</Label>
                     <Select value={selectedStageId} onValueChange={v => { setSelectedStageId(v); setSelectedItemId(""); }}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl z-[150]">{stages?.filter(s => s.status === 'in-progress').map(s => (<SelectItem key={s.id} value={s.id!} className="font-bold py-2">{s.name}</SelectItem>))}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">BOQ Work Item</Label>
                     <Select disabled={!selectedStageId} value={selectedItemId} onValueChange={setSelectedItemId}>
                        <SelectTrigger className="h-10 rounded-xl border-2 font-bold bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="rounded-xl z-[150]">{boqItems?.filter(i => {
                           const stage = stages?.find(s => s.id === selectedStageId);
                           return (i.plannedQuantity || 0) > 0 && (i.technicalStageIds?.includes(stage?.technicalStageId!) || i.technicalStageId === stage?.technicalStageId);
                        }).map(i => (<SelectItem key={i.id} value={i.id!} className="font-bold text-xs py-3 text-start"><div className="text-start flex flex-col"><span className="font-black text-slate-800">{i.referenceTitle}</span><span className="text-[8px] text-slate-400">#{i.referenceCode}</span></div></SelectItem>))}</SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="space-y-4 p-6 bg-primary/5 rounded-[1.5rem] border-2 border-primary/10">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Quantity Executed Today</Label><Input type="number" step="0.01" value={progressQty} onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} className="h-14 rounded-xl border-2 font-black text-4xl text-center bg-white shadow-inner" /></div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                     <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> {isRtl ? 'العمالة والمهنة المشاركة' : 'Labor Resources'}</h4>
                     <Button type="button" variant="ghost" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1 }])} className="h-7 text-[10px] font-black gap-1 text-primary"><Plus className="h-3 w-3" /> {isRtl ? 'إضافة فئة' : 'Add Trade'}</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                     {laborDetails.map((labor, i) => (
                        <div key={i} className="flex items-center gap-3 animate-in slide-in-from-top-1">
                           <Input placeholder={isRtl ? "التخصص" : "Trade"} value={labor.trade} onChange={e => {
                              const newL = [...laborDetails]; newL[i].trade = e.target.value; setLaborDetails(newL);
                           }} className="h-10 rounded-lg font-bold text-xs bg-white" />
                           <Input type="number" value={labor.count} onChange={e => {
                              const newL = [...laborDetails]; newL[i].count = Number(e.target.value); setLaborDetails(newL);
                           }} className="h-10 w-24 rounded-lg font-black text-center bg-white" />
                           {laborDetails.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between border-b pb-2">
                     <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Truck className="h-4 w-4 text-orange-500" /> {isRtl ? 'الآليات والمعدات المستخدمة' : 'Equipment & Tools'}</h4>
                     <Button type="button" variant="ghost" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', name: '', hoursUsed: 1 }])} className="h-7 text-[10px] font-black gap-1 text-primary"><Plus className="h-3 w-3" /> {isRtl ? 'إضافة معدة' : 'Add Gear'}</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                     {equipmentUsed.map((equip, i) => (
                        <div key={i} className="flex items-center gap-3 animate-in slide-in-from-top-1">
                           <Select value={equip.equipmentId} onValueChange={v => {
                              const item = equipmentItems?.find((x:any) => x.id === v);
                              const newE = [...equipmentUsed]; newE[i].equipmentId = v; newE[i].name = item?.name || ''; setEquipmentUsed(newE);
                           }}>
                              <SelectTrigger className="h-10 rounded-lg font-bold text-xs bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                              <SelectContent className="rounded-xl z-[150]">{equipmentItems?.map((e:any) => <SelectItem key={e.id} value={e.id!} className="font-bold text-xs">{e.name}</SelectItem>)}</SelectContent>
                           </Select>
                           <div className="relative w-32 shrink-0">
                              <Input type="number" value={equip.hoursUsed} onChange={e => {
                                 const newE = [...equipmentUsed]; newE[i].hoursUsed = Number(e.target.value); setEquipmentUsed(newE);
                              }} className="h-10 rounded-lg font-black text-center pe-8 bg-white" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">HRS</span>
                           </div>
                           <Button type="button" variant="ghost" size="icon" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-2 pt-4 text-start">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Site Notes</Label>
                  <Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50/50 border-2 font-bold" />
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0 shadow-lg">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl font-bold bg-white">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={!!loadingAction || !selectedItemId || !selectedStageId} className="flex-[2] h-14 rounded-2xl text-xl gap-2 shadow-xl shadow-orange-500/20 bg-primary text-white font-black">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                  {isRtl ? 'حفظ واعتماد السجل' : 'Commit Record'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
