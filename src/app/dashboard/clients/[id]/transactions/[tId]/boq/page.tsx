
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
  ChevronDown, ChevronRight,
  Printer, Folder, Calculator,
  PlusCircle, AlertCircle,
  CheckCircle2, Sparkles, FileSearch, 
  LayoutGrid, X, Clock
} from "lucide-react";
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem, BOQItemExecutionEntry, BOQVariation, BOQVariationItem } from '@/types/documents';
import { BOQTemplateItem } from '@/types/templates';
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
  const { t, lang, dir, isRtl } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
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

  const boqTree = useMemo(() => transformToBOQTree((items || []) as BOQTemplateItem[]), [items]);

  const handleApproveBaseline = async () => {
    if (!db || !companyId || !user || !activeBoq) return;
    setLoadingAction('approving');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const currentTotal = items.reduce((acc, i) => acc + (i.plannedQuantity * (i.estimatedRate || 0)), 0);
      await service.approveBOQ(activeBoq.id, currentTotal, transactionId, user.uid, globalUser?.username || user.displayName || 'Admin');
      toast({ title: t('common.saved') });
      setIsEditingBaseline(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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
      toast({ title: t('common.saved') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setLoadingReview(false);
    }
  };

  const handleApproveVO = async () => {
    if (!db || !companyId || !user || !reviewVO) return;
    setProcessingVOId(reviewVO.id!);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.approveVariation(reviewVO.boqId, reviewVO.id!, transactionId, user.uid, globalUser?.username || 'Admin');
      toast({ title: t('common.saved') });
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const handleRejectVO = async () => {
    if (!db || !companyId || !user || !reviewVO) return;
    setProcessingVOId(reviewVO.id!);
    try {
      const service = new VariationService(db, companyId, permissions);
      await service.rejectVariation(reviewVO.boqId, reviewVO.id!, transactionId, user.uid, globalUser?.username || 'Admin');
      toast({ title: t('common.saved') });
      setReviewVO(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const renderBOQTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => (
    <React.Fragment key={node.id}>
      <TableRow className="bg-slate-50 hover:bg-slate-100 border-b-2 border-white">
        <TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 text-start">{prefix}</TableCell>
        <TableCell colSpan={2} className="font-black text-slate-900 text-sm py-4 text-start" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
          <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-primary" />{node.title}</div>
        </TableCell>
        <TableCell colSpan={8}></TableCell>
      </TableRow>
      {node.items.map((item, iIdx) => {
        const itemPrefix = prefix + "." + (iIdx + 1);
        const metrics = executionMetrics[item.boqReferenceNodeId!] || { prev: 0, current: 0 };
        const planned = item.plannedQuantity || 1;
        const totalPct = Math.round(((metrics.prev + metrics.current) / planned) * 100);

        return (
          <TableRow key={item.id || `${item.boqReferenceNodeId}-${iIdx}`} className="hover:bg-primary/[0.02] border-b-slate-50">
            <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
            <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">{item.referenceCode}</TableCell>
            <TableCell className="text-xs font-bold text-slate-700 text-start">{item.referenceTitle}</TableCell>
            <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
            <TableCell className="text-center">
               {isEditingBaseline || activeBoq?.status === 'draft' ? (
                 <Input 
                   type="number" 
                   className="h-8 text-center text-xs font-black" 
                   value={item.plannedQuantity === 0 ? "" : item.plannedQuantity} 
                   onChange={e => handleUpdateItem(item.id!, e.target.value === "" ? 0 : Number(e.target.value), item.estimatedRate || 0)} 
                 />
               ) : <span className="font-black text-xs">{item.plannedQuantity}</span>}
            </TableCell>
            <TableCell className="text-center font-mono font-black text-blue-600 text-[11px]">{metrics.prev}</TableCell>
            <TableCell className="text-center font-mono font-black text-orange-600 text-[11px]">{metrics.current}</TableCell>
            <TableCell className="text-center font-mono font-black text-slate-900 text-[11px]">{metrics.prev + metrics.current}</TableCell>
            <TableCell className="text-center font-mono font-bold text-slate-400 text-[11px]">{item.estimatedRate?.toLocaleString()}</TableCell>
            <TableCell className="text-end font-mono font-black text-emerald-600 text-[11px]">{( (metrics.prev + metrics.current) * (item.estimatedRate || 0)).toLocaleString()}</TableCell>
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
  if (!activeBoq) return <div className="p-20 text-center"><FileSpreadsheet className="h-16 w-16 mx-auto text-slate-200" /><h2 className="text-xl font-black text-slate-400">{t('projects.boqExplorer.noBoqs')}</h2></div>;

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-primary/10">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-9 w-9 border rounded-lg flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400"><ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /></button>
           <div className="text-start">
             <h1 className="text-lg font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1>
             <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{transaction?.clientName}</p>
           </div>
        </div>
        <div className="flex items-center gap-2">
           {activeBoq.status === 'draft' ? (
              <div className="flex gap-2">
                 <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="h-9 px-4 rounded-lg font-bold text-xs gap-2 border-slate-200"><LayoutGrid className="h-3.5 w-3.5" /> {t('projects.boqExplorer.items')}</Button></DialogTrigger>
                    <DialogContent className="max-w-4xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white text-start"><DialogHeader className="bg-slate-50 p-6"><DialogTitle className="text-xl font-black flex items-center gap-3"><Sparkles className="text-primary h-6 w-6" /> {isRtl ? 'القاموس الهندسي الموحد' : 'Sovereign Registry'}</DialogTitle></DialogHeader><div className="py-6 px-6"><BOQReferenceSelector onSelect={handleAddItemFromRegistry} /></div><DialogFooter className="p-4 bg-slate-50"><Button variant="outline" onClick={() => setIsPickerOpen(false)} className="rounded-lg px-8">{t('common.close')}</Button></DialogFooter></DialogContent>
                 </Dialog>
                 <Button onClick={handleApproveBaseline} disabled={!!loadingAction} className="h-9 px-6 rounded-lg bg-emerald-600 text-white font-bold text-xs gap-2">{t('common.confirm')}</Button>
              </div>
           ) : (
             <div className="flex gap-2">
                <Button onClick={() => setIsEditingBaseline(!isEditingBaseline)} variant="outline" className="h-9 px-4 rounded-lg font-bold text-xs gap-2 border-slate-200">
                  {isEditingBaseline ? t('common.cancel') : t('common.edit')}
                </Button>
                <Button onClick={() => setIsVOOpen(true)} className="h-9 px-6 rounded-lg bg-primary text-white font-bold text-xs gap-2 shadow-sm shadow-primary/10"><PlusCircle className="h-3.5 w-3.5" /> {t('projects.boqExplorer.newVO')}</Button>
             </div>
           )}
           <Button variant="outline" className="h-9 px-4 rounded-lg font-bold text-xs border-slate-200"><Printer className="h-3.5 w-3.5" /></Button>
        </div>
      </header>

      {variations?.filter(v => v.status === 'draft').map(vo => (
         <div key={vo.id} className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <Clock className="h-4 w-4 text-amber-600" />
               <div className="text-start">
                  <h5 className="font-black text-xs text-amber-900">{t('projects.boqExplorer.variations')} {t('common.pending')}</h5>
                  <p className="text-[10px] font-bold text-amber-700">{vo.title} | {vo.totalAmount.toLocaleString()} KWD</p>
               </div>
            </div>
            <Button onClick={() => handleReviewVO(vo)} variant="outline" className="h-8 px-4 rounded-lg text-[10px] font-black gap-2 bg-white border-amber-200 text-amber-700"><FileSearch className="h-3 w-3" /> {t('projects.boqExplorer.review')}</Button>
         </div>
      ))}

      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-slate-50 sticky top-0 z-20 border-0">
             <TableRow className="hover:bg-slate-50 border-0">
               <TableHead className="ps-6 text-slate-500 font-bold text-[10px] text-start">{t('common.order')}</TableHead>
               <TableHead className="text-slate-500 font-bold text-[10px] text-start">{t('common.code')}</TableHead>
               <TableHead className="text-slate-900 font-black text-[10px] text-start uppercase">{t('projects.boqExplorer.item')}</TableHead>
               <TableHead className="text-center text-slate-500 font-bold text-[10px]">{t('common.unit')}</TableHead>
               <TableHead className="text-center text-slate-900 font-black text-[10px] uppercase">{t('projects.boqExplorer.planned')}</TableHead>
               <TableHead className="text-center text-slate-500 font-bold text-[10px]">{t('projects.boqExplorer.previous')}</TableHead>
               <TableHead className="text-center text-slate-500 font-bold text-[10px]">{t('projects.boqExplorer.current')}</TableHead>
               <TableHead className="text-center text-slate-900 font-black text-[10px] uppercase">{t('common.all')}</TableHead>
               <TableHead className="text-center text-slate-500 font-bold text-[10px]">{t('projects.boqExplorer.rate')}</TableHead>
               <TableHead className="text-end text-slate-900 font-black text-[10px] uppercase">{t('projects.boqExplorer.total')}</TableHead>
               <TableHead className="pe-6 text-slate-500 font-bold text-[10px] text-end">{t('projects.boqExplorer.progress')}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>{boqTree.length === 0 ? <TableRow><TableCell colSpan={11} className="py-40 text-center opacity-30"><Calculator className="h-10 w-10 mx-auto text-slate-200" /><p className="text-sm font-black mt-4">Empty BOQ</p></TableCell></TableRow> : boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))}</TableBody>
         </Table>
      </div>

      <Dialog open={!!reviewVO} onOpenChange={(open) => !open && setReviewVO(null)}>
         <DialogContent className="max-w-5xl rounded-xl p-0 overflow-hidden border-0 shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 text-slate-900 text-start border-b flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm"><FileSearch className="h-5 w-5" /></div>
                  <div><DialogTitle className="text-lg font-black">{t('projects.boqExplorer.review')}</DialogTitle><p className="text-[10px] text-slate-400 uppercase tracking-widest">{reviewVO?.title}</p></div>
               </div>
               <div className="text-end">
                  <p className="text-[8px] font-black text-primary uppercase mb-1">{t('projects.boqExplorer.financialImpact')}</p>
                  <h3 className={cn("text-xl font-black font-mono", (reviewVO?.totalAmount || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{reviewVO?.totalAmount.toLocaleString()} <span className="text-xs opacity-40">KWD</span></h3>
               </div>
            </div>
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide text-start bg-white">
               <div className="p-4 bg-slate-50/50 rounded-lg border text-xs font-bold text-slate-600 leading-relaxed italic">"{reviewVO?.reason || '---'}"</div>
               <div className="border rounded-lg overflow-hidden shadow-sm">
                  <Table>
                     <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="ps-6 py-2 text-[10px]">{t('projects.boqExplorer.action')}</TableHead>
                          <TableHead className="py-2 text-[10px]">{t('projects.boqExplorer.item')}</TableHead>
                          <TableHead className="text-center py-2 text-[10px]">{t('projects.boqExplorer.delta')}</TableHead>
                          <TableHead className="text-end py-2 text-[10px]">{t('projects.boqExplorer.rate')}</TableHead>
                          <TableHead className="text-end pe-6 py-2 text-[10px]">{t('projects.boqExplorer.total')}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {loadingReview ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/30" /></TableCell></TableRow> : reviewItems.map((item, idx) => (
                          <TableRow key={item.id || idx}>
                             <TableCell className="ps-6 py-2"><Badge variant="outline" className="font-black text-[8px] uppercase">{item.type}</Badge></TableCell>
                             <TableCell className="font-bold text-xs text-slate-700">{item.description}</TableCell>
                             <TableCell className="text-center font-mono font-black text-xs">{item.quantityDelta}</TableCell>
                             <TableCell className="text-end font-mono text-xs">{item.rate?.toLocaleString()}</TableCell>
                             <TableCell className="text-end pe-6 font-mono font-black text-sm">{item.total?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
               <Button onClick={() => setReviewVO(null)} variant="outline" className="flex-1 h-10 rounded-lg border-2 font-bold">{t('common.cancel')}</Button>
               <Button onClick={handleApproveVO} disabled={!!processingVOId} className="flex-[2] h-10 rounded-lg bg-emerald-600 text-white font-black gap-2 shadow-lg">{processingVOId ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{t('projects.boqExplorer.approveAndCommit')}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={items || []} />}
    </div>
  );
}
