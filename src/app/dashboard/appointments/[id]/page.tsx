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
  ShieldAlert, ShieldX, Sparkles, DollarSign, Building2, Briefcase, Clock, Camera, LayoutGrid
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [loggedItems, setLoggedItems] = useState<any[]>([]);
  const [laborDetails, setLaborDetails] = useState<any[]>([{ trade: '', count: 1, hours: 8, hourlyCostRef: 0 }]);
  const [equipmentUsed, setEquipmentUsed] = useState<any[]>([]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);

  const apptRef = useMemo(() => companyId && db ? doc(db, paths.appointments(companyId), apptId) : null, [db, companyId, apptId]);
  const { data: appt, loading: apptLoading } = useDoc<Appointment>(apptRef);

  const transRef = useMemo(() => companyId && db && appt?.transactionId ? doc(db, paths.transactions(companyId), appt.transactionId) : null, [db, companyId, appt?.transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db && appt?.transactionId ? query(collection(db, paths.transactionStages(companyId, appt.transactionId)), orderBy('order')) : null, [db, companyId, appt?.transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

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

  // تحديث البنود المتاحة للتسجيل عند اختيار المرحلة
  useEffect(() => {
     if (selectedStageId && boqItems) {
        const stage = stages?.find(s => s.id === selectedStageId);
        if (stage) {
           const filtered = boqItems.filter(i => (i.technicalStageIds?.includes(stage.technicalStageId) || i.technicalStageId === stage.technicalStageId));
           setLoggedItems(filtered.map(i => ({ 
             boqItemId: i.id, 
             itemName: i.referenceTitle, 
             quantity: 0, 
             unit: i.unitSymbol || 'unit', 
             notes: '',
             technicalStageId: stage.technicalStageId
           })));
        }
     }
  }, [selectedStageId, boqItems, stages]);

  const handleRecordProgress = async () => {
    if (!db || !companyId || !user || !activeBoq || loggedItems.length === 0) return;
    setLoadingAction('recording');
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error("Stage not found");

      // تسجيل كل بند كعملية تنفيذ منفصلة مربوطة بنفس الموعد
      for (const item of loggedItems) {
         if (item.quantity > 0) {
            await service.recordBOQItemExecution(
               activeBoq.id, item.boqItemId, stage.technicalStageId, item.quantity, 
               user.uid, currentUserName, item.notes, 
               selectedStageId, false, apptId, 
               { laborDetails, equipmentUsed }
            );
         }
      }
      
      toast({ title: isRtl ? "تم تسجيل الإنجاز المتكامل" : "Progress & Resources Logged" });
      setIsRecordOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

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
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{appt.clientName} | Project: {transaction?.transactionNumber || '---'}</p>
           </div>
        </div>
        {appt.status !== 'completed' && (
           <Button onClick={() => setIsRecordOpen(true)} className="h-14 px-10 rounded-2xl bg-primary text-white font-black text-lg shadow-xl gap-3 border-b-8 border-orange-700">
               <Hammer className="h-6 w-6" /> {isRtl ? 'تسجيل إنجاز فني وموارد' : 'Log Daily Progress'}
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
           <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 p-8 border-b text-start">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <Target className="h-6 w-6 text-primary" /> {isRtl ? 'مراحل التنفيذ المباشرة' : 'Active Execution Pipeline'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 {stages?.map((stage, idx) => (
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
         <DialogContent className="max-w-5xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-900 p-8 text-white text-start flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg"><LayoutGrid className="h-6 w-6" /></div>
                  <DialogTitle className="text-2xl font-black">توثيق الإنجاز اليومي المتكامل</DialogTitle>
               </div>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide text-start bg-white">
               <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Target Stage</Label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                     <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="..." /></SelectTrigger>
                     <SelectContent className="z-[150]">{stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold">{s.name}</SelectItem>)}</SelectContent>
                  </Select>
               </div>

               {selectedStageId && (
                  <div className="space-y-4 animate-in fade-in">
                     <h4 className="font-black text-sm text-primary flex items-center gap-2 border-b pb-2"><Hammer className="h-4 w-4" /> {isRtl ? 'كميات الإنجاز (BOQ)' : 'BOQ Progress Grid'}</h4>
                     <Table>
                        <TableHeader>
                           <TableRow className="bg-slate-50">
                              <TableHead className="text-start">{isRtl ? 'البند' : 'Item'}</TableHead>
                              <TableHead className="text-center w-[120px]">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                              <TableHead className="text-start">{isRtl ? 'ملاحظة فنية' : 'Note'}</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {loggedItems.map((item, idx) => (
                             <TableRow key={idx}>
                                <TableCell className="text-start"><p className="font-bold text-xs">{item.itemName}</p><Badge variant="secondary" className="text-[7px] font-black uppercase h-4">{item.unit}</Badge></TableCell>
                                <TableCell><Input type="number" step="0.01" value={item.quantity === 0 ? '' : item.quantity} onChange={e => { const ni = [...loggedItems]; ni[idx].quantity = Number(e.target.value); setLoggedItems(ni); }} className="h-9 border-2 font-black text-center" /></TableCell>
                                <TableCell><Input value={item.notes} onChange={e => { const ni = [...loggedItems]; ni[idx].notes = e.target.value; setLoggedItems(ni); }} className="h-9 border-2 text-xs" /></TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t">
                  <div className="space-y-6">
                     <div className="flex justify-between items-center"><Label className="font-black text-sm text-slate-800">العمالة الميدانية</Label><Button variant="ghost" size="sm" onClick={() => setLaborDetails([...laborDetails, { trade: '', count: 1, hours: 8, hourlyCostRef: 0 }])} className="h-7 text-[10px] font-black"><Plus className="h-3 w-3" /> Add Trade</Button></div>
                     {laborDetails.map((l, i) => (
                       <div key={i} className="flex gap-2 items-end"><Select onValueChange={v => { const j = availableJobs.find(x => x.name === v); const nl = [...laborDetails]; nl[i].trade = v; nl[i].hourlyCostRef = j?.hourlyCost || 0; setLaborDetails(nl); }}><SelectTrigger className="h-9 rounded-lg border-2 text-xs"><SelectValue /></SelectTrigger><SelectContent>{availableJobs.map(j => <SelectItem key={j.id} value={j.name}>{j.name}</SelectItem>)}</SelectContent></Select><Input type="number" value={l.count} onChange={e => { const nl = [...laborDetails]; nl[i].count = Number(e.target.value); setLaborDetails(nl); }} className="h-9 w-16 text-center font-black" /></div>
                     ))}
                  </div>
                  <div className="space-y-6">
                     <div className="flex justify-between items-center"><Label className="font-black text-sm text-slate-800">المعدات</Label><Button variant="ghost" size="sm" onClick={() => setEquipmentUsed([...equipmentUsed, { equipmentId: '', hoursUsed: 4 }])} className="h-7 text-[10px] font-black"><Plus className="h-3 w-3" /> Add Gear</Button></div>
                     {equipmentUsed.map((e, i) => (
                        <div key={i} className="flex gap-2 items-center"><Select onValueChange={v => { const ne = [...equipmentUsed]; ne[i].equipmentId = v; setEquipmentUsed(ne); }}><SelectTrigger className="h-9 rounded-lg border-2 text-xs"><SelectValue /></SelectTrigger><SelectContent>{equipmentItems?.map((x:any) => <SelectItem key={x.id} value={x.id!}>{x.name}</SelectItem>)}</SelectContent></Select><Input type="number" value={e.hoursUsed} onChange={v => { const ne = [...equipmentUsed]; ne[i].hoursUsed = Number(v.target.value); setEquipmentUsed(ne); }} className="h-9 w-16 text-center font-black" /><Trash2 className="h-4 w-4 text-rose-300" onClick={() => setEquipmentUsed(equipmentUsed.filter((_, idx) => idx !== i))} /></div>
                     ))}
                  </div>
               </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4 shrink-0 shadow-lg">
               <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white">إلغاء</Button>
               <Button onClick={handleRecordProgress} disabled={loadingAction === 'recording' || !selectedStageId} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-xl shadow-xl gap-3 border-b-8 border-orange-700">
                  {loadingAction === 'recording' ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} الاعتماد والحفظ الميداني
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
