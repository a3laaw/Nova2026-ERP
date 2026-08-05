
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, Workflow, CheckCircle2,
  Hammer, Check, Save,
  Target, X, RotateCcw, Lock, Info, Play,
  Users, Truck, Plus, Trash2, Link as LinkIcon,
  ShieldAlert, ShieldX, Sparkles, DollarSign, Building2, Briefcase, Clock
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, updateDoc, serverTimestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Appointment } from '@/types/appointment';
import { Transaction, StageInstance } from '@/types/transaction';
import { BOQ, BOQItem, BOQItemExecutionEntry, LaborDetail, EquipmentUsed } from '@/types/documents';
import { Job } from '@/types/reference';
import { CommentSection } from '@/components/transactions/comment-section';
import { BOQExecutionService, StageProgressResult } from '@/services/boq-execution-service';
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

  const currentUserName = useMemo(() => globalUser?.fullName || user?.displayName || globalUser?.username || 'Engineer', [globalUser, user]);

  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [progressQty, setProgressQty] = useState<number | "">(""); 
  const [progressNotes, setProgressNotes] = useState("");
  
  const [laborDetails, setLaborDetails] = useState<any[]>([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<any[]>([]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, StageProgressResult>>({});
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);

  const apptRef = useMemo(() => companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, [db, companyId, apptId]);
  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  const transRef = useMemo(() => companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null, [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null, [db, companyId, appt?.transactionId]);
  const { data: rawStages } = useCollection<StageInstance>(stagesQuery);

  const { stages, isEligible } = useMemo(() => {
    const allStages = (rawStages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const apptDeptId = appt?.departmentId;
    if (!apptDeptId) return { stages: allStages, isEligible: true };
    const filteredStages = allStages.filter(s => s.allowedDepartmentIds?.includes(apptDeptId));
    if (filteredStages.length === 0) return { stages: [], isEligible: false };
    const firstDeptStageOrder = filteredStages[0].order;
    const previousStages = allStages.filter(s => s.order < firstDeptStageOrder);
    const incompleteBlocker = previousStages.find(s => s.status !== 'completed');
    return { stages: filteredStages, isEligible: !incompleteBlocker };
  }, [rawStages, appt?.departmentId]);

  const boqQuery = useMemo(() => companyId && db && appt?.transactionId ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', appt.transactionId), limit(1)) : null, [db, companyId, appt?.transactionId]);
  const { data: boqs } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: boqItems } = useCollection<BOQItem>(itemsQuery);

  const inventoryQuery = useMemo(() => companyId && db ? query(collection(db, paths.equipment(companyId)), where('status', '==', 'available')) : null, [db, companyId]);
  const { data: equipmentItems } = useCollection<any>(inventoryQuery);

  useEffect(() => {
     if (isRecordOpen && db && companyId) {
        getDocs(query(collectionGroup(db, 'jobs'), where('companyId', '==', companyId)))
           .then(snap => setAvailableJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))))
           .catch(() => setAvailableJobs([]));
     }
  }, [isRecordOpen, db, companyId]);

  const executionService = useMemo(() => (db && companyId) ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

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
  }, [executionService, stages, appt?.transactionId]);

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || !selectedItemId || !selectedStageId) return;
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      await service.recordBOQItemExecution(
        activeBoq.id, selectedItemId, stage.technicalStageId, Number(progressQty) || 0, 
        user.uid, currentUserName, progressNotes, 
        selectedStageId, false, apptId, 
        { laborDetails, equipmentUsed }
      );
      
      toast({ title: isRtl ? "تم تسجيل الإنجاز والتكاليف" : "Progress & Costs Logged" });
      setIsRecordOpen(false);
      setLaborDetails([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0 }]);
      setEquipmentUsed([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const totalEstimatedCost = useMemo(() => {
    const labor = laborDetails.reduce((acc, l) => acc + (l.count * l.hours * l.hourlyCostRef), 0);
    const equip = equipmentUsed.reduce((acc, e) => acc + (e.hoursUsed * e.hourlyRateRef), 0);
    return labor + equip;
  }, [laborDetails, equipmentUsed]);

  if (apptLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!appt) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start" dir={dir}>
      <div className="flex justify-between items-center border-b pb-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="h-12 w-12 border-2 rounded-2xl bg-white flex items-center justify-center hover:bg-slate-50 text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900">{appt.title}</h1>
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{appt.clientName} | {transaction?.transactionNumber || 'External'}</p>
           </div>
        </div>
        {appt.status !== 'completed' && (
           <Button onClick={() => setIsRecordOpen(true)} className="h-14 px-10 rounded-2xl bg-primary text-white font-black text-lg shadow-xl gap-3 border-b-8 border-orange-700">
               <Hammer className="h-6 w-6" /> {isRtl ? 'تسجيل إنجاز فني ومالي' : 'Log Field Progress'}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 p-8 border-b text-start">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <Target className="h-6 w-6 text-primary" /> {isRtl ? 'رادار التنفيذ والمراحل' : 'Technical Radar'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 {stages.map((stage, idx) => (
                    <div key={stage.id} onClick={() => setSelectedStageId(stage.id!)} className={cn("p-5 rounded-3xl border-2 cursor-pointer transition-all", selectedStageId === stage.id ? "bg-primary/5 border-primary shadow-lg" : "bg-white border-slate-100")}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-start">
                             <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-black shadow-inner border", stage.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-white text-slate-400")}>{stage.status === 'completed' ? <Check className="h-5 w-5" /> : (idx + 1)}</div>
                             <p className="font-black text-base">{stage.name}</p>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-black uppercase">{stage.status}</Badge>
                       </div>
                    </div>
                 ))}
              </CardContent>
           </Card>
        </div>
        <div className="lg:col-span-5 h-[600px]">
           <CommentSection transactionId={appt.transactionId || apptId} path={paths.transactionComments(companyId!, appt.transactionId || apptId)} />
        </div>
      </div>

      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
         <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-900 p-8 text-white text-start flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white"><Hammer className="h-6 w-6" /></div>
                  <DialogTitle className="text-2xl font-black">توثيق الإنجاز والتكاليف الميدانية</DialogTitle>
               </div>
               <div className="text-end">
                  <p className="text-[9px] font-black text-primary uppercase">Estimated WIP Cost</p>
                  <h3 className="text-3xl font-black text-emerald-400 font-mono">{totalEstimatedCost.toLocaleString()} <span className="text-xs">KWD</span></h3>
               </div>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide text-start bg-white">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Target Stage</Label>
                     <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="z-[150]">{stages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">BOQ Item</Label>
                     <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent className="z-[150]">{boqItems?.map(i => <SelectItem key={i.id} value={i.id!} className="font-bold text-xs">{i.referenceTitle}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/10">
                  <Label className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Quantity Executed Today</Label>
                  <Input type="number" value={progressQty} onChange={e => setProgressQty(e.target.value === '' ? '' : Number(e.target.value))} className="h-16 rounded-2xl border-0 bg-white text-4xl font-black text-center shadow-inner" />
               </div>

               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b pb-2">
                     <Label className="font-black text-sm text-slate-800">العمالة الميدانية (حسب المسميات المعتمدة)</Label>
                     <Button variant="ghost" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1, hours: 8, hourlyCostRef: 0 }])} className="h-8 text-[10px] font-black"><Plus className="h-3 w-3" /> Add Trade</Button>
                  </div>
                  {laborDetails.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-2xl border-2 border-white shadow-sm">
                       <div className="col-span-5 space-y-1">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Official Job Title</Label>
                          <Select value={l.trade} onValueChange={v => {
                             const job = availableJobs.find(j => (isRtl ? j.name : j.nameEn) === v || j.name === v);
                             const rate = job?.hourlyCost || 0;
                             const nl = [...laborDetails]; nl[i].trade = v; nl[i].hourlyCostRef = rate; setLaborDetails(nl);
                          }}>
                             <SelectTrigger className="h-10 rounded-xl bg-white border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="z-[151]">{availableJobs.map(j => <SelectItem key={j.id} value={isRtl ? j.name : (j.nameEn || j.name)} className="font-bold">{isRtl ? j.name : (j.nameEn || j.name)}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       <div className="col-span-2 space-y-1">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Count</Label>
                          <Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-10 rounded-xl bg-white text-center font-black" />
                       </div>
                       <div className="col-span-2 space-y-1">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Hrs</Label>
                          <Input type="number" value={l.hours} onChange={e => { const nl = [...laborDetails]; nl[i].hours = Number(e.target.value); setLaborDetails(nl); }} className="h-10 rounded-xl bg-white text-center font-black" />
                       </div>
                       <div className="col-span-2 text-end">
                          <p className="text-[9px] font-black text-emerald-600">{(l.count * l.hours * l.hourlyCostRef).toLocaleString()} KWD</p>
                       </div>
                       <div className="col-span-1 flex justify-end">
                          <Button variant="ghost" size="icon" onClick={() => setLaborDetails(laborDetails.filter((_, idx) => idx !== i))} className="h-8 w-8 text-rose-300"><Trash2 className="h-4 w-4" /></Button>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b pb-2">
                     <Label className="font-black text-sm text-slate-800">المعدات والآليات</Label>
                     <Button variant="ghost" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', name: '', hoursUsed: 4, hourlyRateRef: 0 }])} className="h-8 text-[10px] font-black"><Plus className="h-3 w-3" /> Add Gear</Button>
                  </div>
                  {equipmentUsed.map((e, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-2xl border-2 border-white shadow-sm">
                       <div className="col-span-6 space-y-1">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Equipment</Label>
                          <Select value={e.equipmentId} onValueChange={v => {
                             const item = equipmentItems?.find((x:any) => x.id === v);
                             const rate = item?.ownershipType === 'owned' ? item.hourlyDepreciationRate : item.hourlyRentalRate;
                             const ne = [...equipmentUsed]; ne[i].equipmentId = v; ne[i].name = item?.name || ''; ne[i].hourlyRateRef = rate || 0; setEquipmentUsed(ne);
                          }}>
                             <SelectTrigger className="h-10 rounded-xl bg-white border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="z-[151]">{equipmentItems?.map((x:any) => <SelectItem key={x.id} value={x.id!} className="font-bold">{x.name} ({x.code})</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       <div className="col-span-2 space-y-1">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Hrs</Label>
                          <Input type="number" value={e.hoursUsed} onChange={val => { const ne = [...equipmentUsed]; ne[i].hoursUsed = Number(val.target.value); setEquipmentUsed(ne); }} className="h-10 rounded-xl bg-white text-center font-black" />
                       </div>
                       <div className="col-span-3 text-end">
                          <p className="text-[9px] font-black text-blue-600">{(e.hoursUsed * e.hourlyRateRef).toLocaleString()} KWD</p>
                       </div>
                       <div className="col-span-1 flex justify-end">
                          <Button variant="ghost" size="icon" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} className="h-8 w-8 text-rose-300"><Trash2 className="h-4 w-4" /></Button>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Internal Field Notes</Label>
                  <Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} className="min-h-[100px] rounded-2xl border-2" />
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={loadingAction === 'recording' || !selectedItemId} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-xl shadow-xl gap-3">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} الاعتماد والحفظ
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
