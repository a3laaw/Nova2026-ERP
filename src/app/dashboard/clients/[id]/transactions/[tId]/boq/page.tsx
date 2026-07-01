'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileSpreadsheet, ArrowRight, Loader2, 
  TrendingUp, ChevronDown, ChevronRight,
  Printer, Folder, Calculator, ShieldCheck,
  Zap, History, PlusCircle, AlertCircle,
  CheckCircle2, XCircle, Ban, TrendingDown,
  Info, Sparkles, Pencil, Save, ShieldAlert,
  LayoutGrid, X, Clock, DollarSign
} from "lucide-react";
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem, BOQItemExecutionEntry, BOQVariation } from '@/types/documents';
import { Transaction, StageInstance } from '@/types/transaction';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { BOQTreeNode } from '@/types/templates';
import { cn } from '@/lib/utils';
import { VOManagerDialog } from '@/components/transactions/vo-manager-dialog';
import { VariationService } from '@/services/variation-service';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { BOQReferenceSelector } from '@/components/settings/checklists/boq-reference/boq-reference-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function TransactionBOQProgressPage() {
  const params = useParams();
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isVOOpen, setIsVOOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [processingVOId, setProcessingVOId] = useState<string | null>(null);
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // 1. Data Fetching
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId))) : null, [db, companyId, transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: rawItems, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  const items = useMemo(() => (rawItems || []).filter(i => (i.plannedQuantity || 0) > 0), [rawItems]);

  const variationsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqVariations(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: variations } = useCollection<BOQVariation>(variationsQuery);

  const executionsQuery = useMemo(() => companyId && db ? query(collection(db, paths.executions(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: rawExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);
  const allExecutions = useMemo(() => (rawExecutions || []).filter(e => e.boqId === activeBoq?.id), [rawExecutions, activeBoq]);

  // FIXED: executionMetrics now filters out archived logs to prevent inflated numbers
  const executionMetrics = useMemo(() => {
    const metrics: Record<string, { prev: number, current: number }> = {};
    (allExecutions || []).forEach(exec => {
      if (exec.isArchived) return; // SKIP ARCHIVED LOGS

      const stage = stages?.find(s => s.technicalStageId === exec.technicalStageId);
      const itemId = exec.boqItemId;
      if (!metrics[itemId]) metrics[itemId] = { prev: 0, current: 0 };
      if (stage?.status === 'completed') metrics[itemId].prev += (exec.quantity || 0);
      else metrics[itemId].current += (exec.quantity || 0);
    });
    return metrics;
  }, [allExecutions, stages]);

  const boqTree = useMemo(() => transformToBOQTree(items || []), [items]);

  const pendingVOs = useMemo(() => (variations || []).filter(v => v.status === 'draft'), [variations]);

  const financialStats = useMemo(() => {
    const original = activeBoq?.totalAmount || 0;
    const voTotal = (variations || []).filter(v => v.status === 'approved').reduce((sum, v) => sum + (v.totalAmount || 0), 0);
    return { original, voTotal, final: isEditingBaseline ? items.reduce((acc, i) => acc + (i.plannedQuantity * (i.estimatedRate || 0)), 0) : (original + voTotal) };
  }, [activeBoq, variations, items, isEditingBaseline]);

  const handleApproveBaseline = async () => {
    if (!db || !companyId || !user || !activeBoq) return;
    setLoadingAction('approving');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const currentTotal = items.reduce((acc, i) => acc + (i.plannedQuantity * (i.estimatedRate || 0)), 0);
      await service.approveBOQ(activeBoq.id, currentTotal, transactionId, user.uid, globalUser?.username || user.displayName || 'Admin');
      toast({ title: isRtl ? "تم اعتماد الميزانية وتفعيل المسار الفني" : "Baseline Approved & Pipeline Active" });
      setIsEditingBaseline(false);
      router.push(`/dashboard/clients/${transaction?.clientId}/transactions/${transactionId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateItem = async (itemId: string, qty: number, rate: number) => {
    if (!db || !companyId || !activeBoq) return;
    const service = new DocumentService(db, companyId, permissions);
    await service.updateBOQItem(activeBoq.id, itemId, qty, rate);
  };

  const handleAddItemFromRegistry = async (node: any) => {
    if (!activeBoq || !db || !companyId || !user) return;
    try {
      const service = new DocumentService(db, companyId, permissions);
      await service.addBOQItemFromNode(activeBoq.id, transactionId, node, user.uid);
      toast({ title: isRtl ? "تمت إضافة البند للمسودة" : "Item Added to Draft" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    }
  };

  const handleApproveVO = async (vo: BOQVariation) => {
    if (!db || !companyId || !user) return;
    setProcessingVOId(vo.id);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.approveVariation(activeBoq!.id, vo.id!, transactionId, user.uid, globalUser?.username || 'Admin');
      toast({ title: isRtl ? "تم اعتماد التعديل بنجاح" : "Variation Approved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const handleRejectVO = async (vo: BOQVariation) => {
    if (!db || !companyId || !user) return;
    setProcessingVOId(vo.id);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.rejectVariation(activeBoq!.id, vo.id!, transactionId, user.uid, globalUser?.username || 'Admin');
      toast({ title: isRtl ? "تم رفض التعديل" : "Variation Rejected" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const renderBOQTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => (
    <React.Fragment key={node.id}>
      <TableRow className="bg-slate-50/50 border-b-2 border-white"><TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 text-start">{prefix}</TableCell><TableCell colSpan={2} className="font-black text-slate-800 text-sm py-4 text-start" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}><div className="flex items-center gap-2"><Folder className="h-4 w-4 text-orange-400" />{node.title}</div></TableCell><TableCell colSpan={10}></TableCell></TableRow>
      {node.items.map((item, iIdx) => {
        const itemPrefix = `${prefix.replace('.0', '')}.${iIdx + 1}`;
        const metrics = executionMetrics[item.id!] || { prev: 0, current: 0 };
        const totalCumulative = metrics.prev + metrics.current;
        const planned = item.plannedQuantity || 1;
        const prevPct = Math.round((metrics.prev / planned) * 100);
        const currPct = Math.round((metrics.current / planned) * 100);
        const totalPct = Math.round((totalCumulative / planned) * 100);

        return (
          <TableRow key={item.id} className="hover:bg-primary/[0.02] border-b-slate-100">
            <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
            <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">{item.referenceCode}</TableCell>
            <TableCell className="text-xs font-bold text-slate-700 text-start" style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 16}px` }}>{item.referenceTitle}</TableCell>
            <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
            <TableCell className="text-center w-[120px] font-mono font-black text-slate-900 text-xs border-x border-slate-100">
              {isEditingBaseline ? (
                <Input type="number" className="h-8 text-center font-black" value={item.plannedQuantity} onChange={e => handleUpdateItem(item.id!, Number(e.target.value), item.estimatedRate || 0)} />
              ) : item.plannedQuantity}
            </TableCell>
            <TableCell className="text-center">
               <div className="flex flex-col items-center">
                  <span className="font-mono font-black text-blue-600 text-xs">{metrics.prev}</span>
                  <span className="text-[8px] font-bold text-slate-400">{prevPct}%</span>
               </div>
            </TableCell>
            <TableCell className="text-center">
               <div className="flex flex-col items-center">
                  <div className={cn("h-7 px-3 rounded-full font-black text-xs inline-flex items-center", metrics.current > 0 ? "bg-orange-50 text-orange-600" : "text-slate-300")}>{metrics.current}</div>
                  <span className="text-[8px] font-bold text-slate-400 mt-0.5">{currPct}%</span>
               </div>
            </TableCell>
            <TableCell className="text-center">
               <div className="flex flex-col items-center">
                  <Badge variant="outline" className={cn("font-black text-xs px-4 h-8 border-0 shadow-sm", totalCumulative > 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400")}>{totalCumulative}</Badge>
                  <span className="text-[8px] font-black text-slate-500 mt-1">{totalPct}%</span>
               </div>
            </TableCell>
            <TableCell className="text-center font-mono font-bold text-slate-400 text-xs w-[120px]">
              {isEditingBaseline ? (
                <Input type="number" step="0.001" className="h-8 text-center font-black text-emerald-600" value={item.estimatedRate} onChange={e => handleUpdateItem(item.id!, item.plannedQuantity, Number(e.target.value))} />
              ) : item.estimatedRate?.toLocaleString()}
            </TableCell>
            <TableCell className="text-end font-mono font-black text-emerald-600 text-xs">{(totalCumulative * (item.estimatedRate || 0)).toLocaleString()}</TableCell>
            <TableCell className="pe-6 w-[120px] text-end">
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                  <span>{totalPct}%</span>
                </div>
                <Progress value={totalPct} className="h-1" />
              </div>
            </TableCell>
          </TableRow>
        );
      })}
      {node.children.map((child, cIdx) => renderBOQTreeRows(child, `${prefix.replace('.0', '')}.${node.items.length + cIdx + 1}`)) }
    </React.Fragment>
  );

  if (boqLoading || itemsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!activeBoq) return <div className="p-20 text-center"><FileSpreadsheet className="h-16 w-16 mx-auto text-slate-200" /><h2 className="text-xl font-black text-slate-400">{isRtl ? 'لا توجد مقايسة' : 'No BOQ'}</h2></div>;

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl"><ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /></Button>
           <div className="text-start"><h1 className="text-xl font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{transaction?.clientName}</p></div>
        </div>
        <div className="flex items-center gap-3">
           {activeBoq.status === 'draft' ? (
              <div className="flex gap-2">
                 <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'إضافة بنود من القاموس' : 'Add Items from Registry'}</Button></DialogTrigger>
                    <DialogContent className="max-w-4xl rounded-[2.5rem] p-8 border-0 shadow-3xl bg-white text-start"><DialogHeader><DialogTitle className="text-2xl font-black flex items-center gap-3"><Sparkles className="text-primary h-6 w-6" /> {isRtl ? 'القاموس الهندسي السيادي' : 'Sovereign Registry'}</DialogTitle></DialogHeader><div className="py-6"><BOQReferenceSelector onSelect={handleAddItemFromRegistry} activityTypeId={transaction?.activityTypeId} serviceId={transaction?.serviceId} /></div><DialogFooter><Button onClick={() => setIsPickerOpen(false)} className="rounded-xl px-10">إغلاق</Button></DialogFooter></DialogContent>
                 </Dialog>
                 <Button onClick={() => setIsEditingBaseline(!isEditingBaseline)} variant={isEditingBaseline ? "secondary" : "outline"} className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2">{isEditingBaseline ? <CheckCircle2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}{isRtl ? 'تعديل المسودة' : 'Edit Draft'}</Button>
                 <Button onClick={handleApproveBaseline} disabled={!!loadingAction} className="h-11 px-8 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2 shadow-xl shadow-emerald-100">{loadingAction ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{isRtl ? 'اعتماد الميزانية وتفعيل الميدان' : 'Approve & Activate Field'}</Button>
              </div>
           ) : (
             <Button onClick={() => setIsVOOpen(true)} className="h-11 px-6 rounded-xl bg-[#1e1b4b] text-white font-black text-xs gap-2 shadow-xl"><PlusCircle className="h-4 w-4 text-primary" /> {isRtl ? 'أمر تغييري' : 'New VO'}</Button>
           )}
           <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2"><Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}</Button>
        </div>
      </header>

      {/* منطقة الاعتمادات المعلقة للأوامر التغييرية */}
      {pendingVOs.length > 0 && isAdmin && (
        <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
           {pendingVOs.map(vo => (
              <div key={vo.id} className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                       <Clock className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="text-start">
                       <h5 className="font-black text-sm text-amber-900">{isRtl ? 'أمر تغييري قيد المراجعة' : 'Pending Variation Order'}</h5>
                       <p className="text-[10px] font-bold text-amber-700">{vo.title} | {isRtl ? 'تأثير مالي:' : 'Impact:'} {vo.totalAmount.toLocaleString()} KWD</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button 
                      onClick={() => handleRejectVO(vo)}
                      disabled={processingVOId === vo.id}
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-4 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-[10px]"
                    >
                       <XCircle className="h-3.5 w-3.5 me-1" /> {isRtl ? 'رفض' : 'Reject'}
                    </Button>
                    <Button 
                      onClick={() => handleApproveVO(vo)}
                      disabled={processingVOId === vo.id}
                      size="sm" 
                      className="h-9 px-6 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-100 font-black text-[10px]"
                    >
                       {processingVOId === vo.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 me-1" />}
                       {isRtl ? 'اعتماد التغيير' : 'Approve'}
                    </Button>
                 </div>
              </div>
           ))}
        </div>
      )}

      {activeBoq.status === 'draft' && (
        <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-[2.5rem] flex items-start gap-4 animate-in zoom-in-95">
           <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
           <div className="text-start"><h5 className="font-black text-sm text-amber-900">{isRtl ? 'تخصيص ميزانية المشروع' : 'Project Baseline Setup'}</h5><p className="text-xs font-bold text-amber-800/80 leading-relaxed mt-1">{isRtl ? 'يمكنك الآن تعديل الكميات وإضافة بنود إضافية من القاموس السيادي. بمجرد الاعتماد، سيتم حقن مراحل العمل آلياً في المعاملة.' : 'You can adjust quantities and add items from the registry. Once approved, work stages will be injected into the transaction.'}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="border-0 shadow-lg rounded-2xl p-5 text-start bg-white"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الميزانية المخططة' : 'Planned'}</p><h3 className="text-xl font-black text-slate-900">{financialStats.final.toLocaleString()} KWD</h3></Card>
         <Card className="border-0 shadow-lg rounded-2xl p-5 text-start bg-white border-s-4 border-s-blue-500"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'تعديلات معتمدة' : 'Approved VOs'}</p><h3 className="text-xl font-black text-blue-600">{financialStats.voTotal.toLocaleString()} KWD</h3></Card>
         <Card className="border-0 shadow-lg rounded-2xl p-5 text-start bg-slate-900 text-white border-s-4 border-s-emerald-500"><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'الإنجاز الفعلي' : 'Actual Execution'}</p><h3 className="text-xl font-black text-emerald-400">{items.reduce((acc,i)=>(acc+(i.executedQuantity*(i.estimatedRate||0))),0).toLocaleString()} KWD</h3></Card>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-2xl border border-primary/5 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-slate-900 sticky top-0 z-20">
             <TableRow className="hover:bg-slate-900 border-0">
               <TableHead className="ps-6 w-[80px] text-white/40 font-mono text-[10px] text-start">S.No</TableHead>
               <TableHead className="w-[100px] text-white/40 font-mono text-[10px] text-start">Code</TableHead>
               <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'البند' : 'Description'}</TableHead>
               <TableHead className="text-center w-[60px] text-white font-black text-xs">{isRtl ? 'وحدة' : 'Unit'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs bg-white/10">{isRtl ? 'الكمية' : 'Planned'}</TableHead>
               <TableHead className="text-center w-[100px] text-white font-black text-xs">{isRtl ? 'السابق' : 'Prev'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs">{isRtl ? 'الحالي' : 'Current'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs">{isRtl ? 'الإجمالي' : 'Total'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs">{isRtl ? 'سعر الوحدة' : 'Unit Price'}</TableHead>
               <TableHead className="text-end w-[120px] text-white font-black text-xs">{isRtl ? 'القيمة' : 'Value'}</TableHead>
               <TableHead className="pe-6 w-[120px] text-end text-white font-black text-xs">{isRtl ? 'إنجاز %' : 'Progress'}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>{boqTree.length === 0 ? <TableRow><TableCell colSpan={11} className="py-40 text-center opacity-30"><Calculator className="h-12 w-12 mx-auto text-slate-300" /><p className="text-lg font-black">{isRtl ? 'المقايسة فارغة' : 'Empty BOQ'}</p></TableCell></TableRow> : boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))}</TableBody>
         </Table>
      </div>

      <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={rawItems || []} />
    </div>
  );
}
