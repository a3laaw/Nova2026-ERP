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
  LayoutGrid, X, Clock, DollarSign, Search,
  Eye, FileSearch
} from "lucide-react";
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem, BOQItemExecutionEntry, BOQVariation, BOQVariationItem } from '@/types/documents';
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
  const [reviewVO, setReviewVO] = useState<BOQVariation | null>(null);
  const [reviewItems, setReviewItems] = useState<BOQVariationItem[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  useEffect(() => {
    const isModalOpen = isVOOpen || isPickerOpen || !!reviewVO || isEditingBaseline;
    if (!isModalOpen && typeof document !== 'undefined') {
       document.body.style.pointerEvents = 'auto';
       document.body.style.overflow = 'auto';
    }
  }, [isVOOpen, isPickerOpen, reviewVO, isEditingBaseline]);

  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.transactionStages(companyId, transactionId))) : null, [db, companyId, transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: rawItems, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  const items = useMemo(() => (rawItems || []).filter(i => (i.plannedQuantity || 0) > 0), [rawItems]);

  const variationsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqVariations(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: variations } = useCollection<BOQVariation>(variationsQuery);

  const executionsQuery = useMemo(() => {
    if (!companyId || !db || !transactionId) return null;
    return query(collection(db, paths.executions(companyId)), where('transactionId', '==', transactionId));
  }, [db, companyId, transactionId]);

  const { data: rawExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);
  const allExecutions = useMemo(() => (rawExecutions || []).filter(e => e.boqId === activeBoq?.id), [rawExecutions, activeBoq]);

  const executionMetrics = useMemo(() => {
    const metrics: Record<string, { prev: number, current: number }> = {};
    (allExecutions || []).forEach(exec => {
      if (exec.isArchived) return; 
      const stage = stages?.find(s => s.technicalStageId === exec.technicalStageId);
      const itemId = exec.boqItemId;
      if (!metrics[itemId]) metrics[itemId] = { prev: 0, current: 0 };
      if (stage?.status === 'completed') metrics[itemId].prev += (exec.quantity || 0);
      else metrics[itemId].current += (exec.quantity || 0);
    });
    return metrics;
  }, [allExecutions, stages]);

  const boqTree = useMemo(() => transformToBOQTree(items || []), [items]);

  const handleApproveBaseline = async () => {
    if (!db || !companyId || !user || !activeBoq) return;
    setLoadingAction('approving');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const currentTotal = items.reduce((acc, i) => acc + (i.plannedQuantity * (i.estimatedRate || 0)), 0);
      await service.approveBOQ(activeBoq.id, currentTotal, transactionId, user.uid, globalUser?.username || user.displayName || 'Admin');
      toast({ title: isRtl ? "تم اعتماد الميزانية وتفعيل المسار الفني" : "Baseline Approved & Pipeline Active" });
      setIsEditingBaseline(false);
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

  const handleReviewVO = async (vo: BOQVariation) => {
    if (!db || !companyId) return;
    setLoadingReview(true);
    setReviewVO(vo);
    try {
      const snap = await getDocs(collection(db, paths.boqVariationItems(companyId, vo.boqId, vo.id)));
      setReviewItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BOQVariationItem)));
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLoadingReview(false);
    }
  };

  const handleApproveVO = async () => {
    if (!db || !companyId || !user || !reviewVO) return;
    setProcessingVOId(reviewVO.id);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.approveVariation(activeBoq!.id, reviewVO.id!, transactionId, user.uid, globalUser?.username || 'Admin');
      toast({ title: isRtl ? "تم اعتماد التعديل بنجاح" : "Variation Approved" });
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const renderBOQTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => (
    <React.Fragment key={node.id}>
      <TableRow className="bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 border-b-2 border-white/10">
        <TableCell className="font-mono text-[11px] font-black text-white/40 ps-6 text-start">{prefix}</TableCell>
        <TableCell colSpan={2} className="font-black text-white text-sm py-4 text-start" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
          <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-primary" />{node.title}</div>
        </TableCell>
        <TableCell colSpan={8}></TableCell>
      </TableRow>
      {node.items.map((item, iIdx) => {
        const itemPrefix = prefix + "." + (iIdx + 1);
        const metrics = executionMetrics[item.id!] || { prev: 0, current: 0 };
        const planned = item.plannedQuantity || 1;
        const totalPct = Math.round(((metrics.prev + metrics.current) / planned) * 100);

        return (
          <TableRow key={item.id} className="hover:bg-primary/[0.02] border-b-slate-100">
            <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
            <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">{item.referenceCode}</TableCell>
            <TableCell className="text-xs font-bold text-slate-700 text-start">{item.referenceTitle}</TableCell>
            <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
            <TableCell className="text-center">
               {isEditingBaseline || activeBoq?.status === 'draft' ? (
                 <Input 
                   type="number" 
                   className="h-8 text-center" 
                   value={item.plannedQuantity === 0 ? "" : item.plannedQuantity} 
                   onChange={e => handleUpdateItem(item.id!, e.target.value === "" ? 0 : Number(e.target.value), item.estimatedRate || 0)} 
                 />
               ) : item.plannedQuantity}
            </TableCell>
            <TableCell className="text-center font-mono font-black text-blue-600 text-xs">{metrics.prev}</TableCell>
            <TableCell className="text-center font-mono font-black text-orange-600 text-xs">{metrics.current}</TableCell>
            <TableCell className="text-center font-mono font-black text-slate-900 text-xs">{metrics.prev + metrics.current}</TableCell>
            <TableCell className="text-center font-mono font-bold text-slate-400 text-xs">{item.estimatedRate?.toLocaleString()}</TableCell>
            <TableCell className="text-end font-mono font-black text-emerald-600 text-xs">{( (metrics.prev + metrics.current) * (item.estimatedRate || 0)).toLocaleString()}</TableCell>
            <TableCell className="pe-6 w-[120px] text-end">
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-black uppercase text-slate-400"><span>{totalPct}%</span></div>
                <Progress value={totalPct} className="h-1" />
              </div>
            </TableCell>
          </TableRow>
        );
      })}
      {node.children.map((child, cIdx) => renderBOQTreeRows(child, prefix + "." + (node.items.length + cIdx + 1))) }
    </React.Fragment>
  );

  if (boqLoading || itemsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!activeBoq) return <div className="p-20 text-center"><FileSpreadsheet className="h-16 w-16 mx-auto text-slate-200" /><h2 className="text-xl font-black text-slate-400">{isRtl ? 'لا توجد مقايسة' : 'No BOQ'}</h2></div>;

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors"><ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /></button>
           <div className="text-start"><h1 className="text-xl font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{transaction?.clientName}</p></div>
        </div>
        <div className="flex items-center gap-3">
           {activeBoq.status === 'draft' ? (
              <div className="flex gap-2">
                 <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'إضافة بنود من القاموس' : 'Add Items'}</Button></DialogTrigger>
                    <DialogContent className="max-w-4xl rounded-[2.5rem] p-8 border-0 shadow-3xl bg-white text-start"><DialogHeader><DialogTitle className="text-2xl font-black flex items-center gap-3"><Sparkles className="text-primary h-6 w-6" /> {isRtl ? 'القاموس الهندسي الموحد' : 'Sovereign Registry'}</DialogTitle></DialogHeader><div className="py-6"><BOQReferenceSelector onSelect={handleAddItemFromRegistry} /></div><DialogFooter><Button onClick={() => setIsPickerOpen(false)} className="rounded-xl px-10">إغلاق</Button></DialogFooter></DialogContent>
                 </Dialog>
                 <Button onClick={handleApproveBaseline} disabled={!!loadingAction} className="h-11 px-8 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2">{isRtl ? 'اعتماد الميزانية' : 'Approve'}</Button>
              </div>
           ) : (
             <div className="flex gap-2">
                <Button onClick={() => setIsEditingBaseline(!isEditingBaseline)} variant="outline" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2">{isRtl ? 'تعديل استثنائي' : 'Edit'}</Button>
                <Button onClick={() => setIsVOOpen(true)} className="btn-gradient h-11 px-6 rounded-xl gap-2 shadow-xl"><PlusCircle className="h-4 w-4 text-white" /> {isRtl ? 'أمر تغييري' : 'New VO'}</Button>
             </div>
           )}
           <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2"><Printer className="h-4 w-4" /></Button>
        </div>
      </header>

      {variations?.filter(v => v.status === 'draft').map(vo => (
         <div key={vo.id} className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <Clock className="h-5 w-5 text-amber-600" />
               <div className="text-start">
                  <h5 className="font-black text-sm text-amber-900">{isRtl ? 'أمر تغييري قيد المراجعة' : 'Pending VO'}</h5>
                  <p className="text-[10px] font-bold text-amber-700">{vo.title} | {vo.totalAmount.toLocaleString()} KWD</p>
               </div>
            </div>
            <Button onClick={() => handleReviewVO(vo)} className="h-10 px-6 rounded-xl btn-gradient text-xs gap-2"><FileSearch className="h-4 w-4" /> {isRtl ? 'مراجعة بنود التعديل' : 'Review'}</Button>
         </div>
      ))}

      <div className="flex-1 bg-white rounded-3xl shadow-2xl border border-primary/5 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-[#1e1b4b] sticky top-0 z-20 border-0">
             <TableRow className="hover:bg-[#1e1b4b] border-0">
               <TableHead className="ps-6 text-white font-black text-xs text-start">{isRtl ? 'المرجع' : 'Ref'}</TableHead>
               <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'الكود' : 'Code'}</TableHead>
               <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'البند' : 'Description'}</TableHead>
               <TableHead className="text-center text-white font-black text-xs">{isRtl ? 'وحدة' : 'Unit'}</TableHead>
               <TableHead className="text-center text-white font-black text-xs">{isRtl ? 'الكمية' : 'Planned'}</TableHead>
               <TableHead className="text-center text-white font-black text-xs">{isRtl ? 'سابق' : 'Prev'}</TableHead>
               <TableHead className="text-center text-white font-black text-xs">{isRtl ? 'حالي' : 'Curr'}</TableHead>
               <TableHead className="text-center text-white font-black text-xs">{isRtl ? 'إجمالي' : 'Total'}</TableHead>
               <TableHead className="text-center text-white font-black text-xs">{isRtl ? 'سعر الوحدة' : 'Rate'}</TableHead>
               <TableHead className="text-end text-white font-black text-xs">{isRtl ? 'القيمة' : 'Value'}</TableHead>
               <TableHead className="pe-6 text-white font-black text-xs text-end">{isRtl ? 'إنجاز' : 'Progress'}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>{boqTree.length === 0 ? <TableRow><TableCell colSpan={11} className="py-40 text-center opacity-30"><Calculator className="h-12 w-12 mx-auto" /><p className="text-lg font-black">Empty BOQ</p></TableCell></TableRow> : boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))}</TableBody>
         </Table>
      </div>

      <Dialog open={!!reviewVO} onOpenChange={(open) => !open && setReviewVO(null)}>
         <DialogContent className="max-w-5xl rounded-none p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-[#1e1b4b] p-8 text-white text-start flex justify-between items-center">
               <div className="flex items-center gap-6">
                  <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-2xl"><FileSearch className="h-7 w-7" /></div>
                  <div><DialogTitle className="text-2xl font-black">{isRtl ? 'مراجعة أمر تغييري' : 'Review VO'}</DialogTitle><p className="text-[10px] text-slate-400 uppercase tracking-widest">{reviewVO?.title}</p></div>
               </div>
               <div className="text-end">
                  <p className="text-[9px] font-black text-primary uppercase mb-1">Impact</p>
                  <h3 className={cn("text-3xl font-black font-mono", (reviewVO?.totalAmount || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{reviewVO?.totalAmount.toLocaleString()} KWD</h3>
               </div>
            </div>
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide text-start">
               <div className="p-6 bg-slate-50 rounded-2xl border-2 border-white shadow-inner"><h5 className="font-black text-xs text-slate-400 uppercase mb-2">Justification</h5><p className="text-sm font-bold text-slate-700 leading-relaxed">{reviewVO?.reason || '---'}</p></div>
               <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                     <TableHeader className="bg-[#1e1b4b]"><TableRow><TableHead className="ps-6 text-white">Action</TableHead><TableHead className="text-white">Item</TableHead><TableHead className="text-center text-white">Delta</TableHead><TableHead className="text-end text-white">Rate</TableHead><TableHead className="text-end pe-6 text-white">Total</TableHead></TableRow></TableHeader>
                     <TableBody>
                        {loadingReview ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : reviewItems.map((item, idx) => (
                          <TableRow key={idx}>
                             <TableCell className="ps-6"><Badge variant="outline" className="font-black text-[8px] uppercase">{item.type}</Badge></TableCell>
                             <TableCell className="font-bold text-xs text-slate-700">{item.description}</TableCell>
                             <TableCell className="text-center font-mono font-black text-xs">{item.quantityDelta}</TableCell>
                             <TableCell className="text-end font-mono text-xs">{item.rate?.toLocaleString()}</TableCell>
                             <TableCell className="text-end pe-6 font-mono font-black">{item.total?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
               <Button onClick={() => setReviewVO(null)} variant="outline" className="flex-1 h-16 rounded-2xl border-2 font-black">إلغاء</Button>
               <Button onClick={handleApproveVO} disabled={!!processingVOId} className="flex-[2] h-16 rounded-2xl btn-gradient text-xl gap-3">{processingVOId ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}{isRtl ? 'اعتماد التغيير' : 'Approve'}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={items || []} />}
    </div>
  );
}