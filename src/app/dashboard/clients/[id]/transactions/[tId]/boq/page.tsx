'use client';

import React, { useState, useMemo } from 'react';
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
  LayoutGrid, X, Clock, FilePlus
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { BOQTemplate, BOQTemplateItem, BOQTreeNode } from '@/types/templates';
import { Transaction, StageInstance } from '@/types/transaction';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { cn } from '@/lib/utils';
import { VOManagerDialog } from '@/components/transactions/vo-manager-dialog';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';

export default function TransactionBOQProgressPage() {
  const params = useParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [isVOOpen, setIsVOOpen] = useState(false);
  const [isBoqInitOpen, setIsBoqInitOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => (companyId && db && transactionId) ? query(collection(db, paths.transactionStages(companyId, transactionId)), orderBy('order')) : null, [db, companyId, transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqs(companyId))) : null, [db, companyId]);
  const { data: allBoqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);

  const activeBoq = useMemo(() => {
    return (allBoqs || []).find(b => b.transactionId?.trim() === transactionId?.trim());
  }, [allBoqs, transactionId]);

  const itemsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: rawItems } = useCollection<BOQItem>(itemsQuery);

  const items = useMemo(() => (rawItems || []).filter(i => (i.plannedQuantity || 0) > 0), [rawItems]);

  const allTemplatesQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqTemplates(companyId))) : null, [db, companyId]);
  const { data: allTemplates } = useCollection<BOQTemplate>(allTemplatesQuery);

  const templates = useMemo(() => {
     if (!allTemplates || !transaction?.subServiceId) return [];
     const subId = transaction.subServiceId.trim();
     return allTemplates.filter(temp => (temp.subServiceId?.trim() === subId) && temp.isActive !== false);
  }, [allTemplates, transaction?.subServiceId]);

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

  const handleCreateBOQ = async () => {
    if (!db || !companyId || !user || !selectedTemplateId || !transaction) return;
    setLoadingAction('creating_boq');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const template = templates?.find(t => t.id === selectedTemplateId);
      await service.instantiateBoqFromTemplate(selectedTemplateId, { 
        transactionId, 
        clientId, 
        clientName: transaction.clientName, 
        activityTypeId: transaction.activityTypeId, 
        serviceId: transaction.serviceId, 
        subServiceId: transaction.subServiceId, 
        name: template?.name || "" 
      }, user.uid, globalUser?.fullName || 'User');
      toast({ title: t('common.saved') });
      setIsBoqInitOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: t('common.error'), description: e.message }); 
    }
    finally { setLoadingAction(null); }
  };

  const handleApproveBaseline = async () => {
    if (!db || !companyId || !user || !activeBoq) return;
    setLoadingAction('approving');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const currentTotal = items.reduce((acc, i) => acc + (i.plannedQuantity * (i.estimatedRate || 0)), 0);
      await service.approveBOQ(activeBoq.id, currentTotal, transactionId, user.uid, globalUser?.fullName || 'Admin');
      toast({ title: t('common.saved') });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoadingAction(null);
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
          <TableRow key={item.id || `${item.boqReferenceNodeId}-${iIdx}`} className="hover:bg-primary/[0.02] border-b-slate-50 text-start">
            <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
            <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">{item.referenceCode}</TableCell>
            <TableCell className="text-xs font-bold text-slate-700 text-start">{item.referenceTitle}</TableCell>
            <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
            <TableCell className="text-center">
               <span className="font-black text-xs">{item.plannedQuantity}</span>
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

  if (boqLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  
  if (!activeBoq) return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in" dir={dir}>
      <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white rounded-xl border-4 border-dashed border-slate-100 text-center space-y-6">
          <div className="w-24 h-24 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary/30 shadow-inner">
             <FileSpreadsheet className="h-12 w-12" />
          </div>
          <div className="space-y-2">
             <h2 className="text-xl font-black text-slate-400">{t('projects.boqExplorer')}</h2>
             <p className="text-xs font-bold text-slate-300 max-w-sm mx-auto leading-relaxed">
                {t('projects.boqExplorer.noBoqs')}
             </p>
          </div>
          <Button onClick={() => setIsBoqInitOpen(true)} className="h-14 rounded-2xl px-10 bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 gap-3">
             <FilePlus className="h-5 w-5" />
             {t('common.add')}
          </Button>
      </div>

      <Dialog open={isBoqInitOpen} onOpenChange={setIsBoqInitOpen}>
         <DialogContent className="rounded-xl max-w-md p-0 overflow-hidden border shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 border-b text-start"><DialogTitle className="text-base font-black flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {t('common.confirm')}</DialogTitle></div>
            <div className="p-8 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400">{t('templates')}</Label>
               <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-lg">
                     <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-2xl">
                     {templates?.map(t => <SelectItem key={t.id} value={t.id!} className="font-bold py-4">{t.name}</SelectItem>)}
                  </SelectContent>
               </Select>
               <Button onClick={handleCreateBOQ} disabled={!selectedTemplateId || !!loadingAction} className="w-full h-14 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 border-b-4 border-orange-700 mt-4 transition-all active:scale-95">
                  {loadingAction === 'creating_boq' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-2" />} {t('common.save')}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );

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
                 <Button onClick={handleApproveBaseline} disabled={!!loadingAction} className="h-9 px-6 rounded-lg bg-emerald-600 text-white font-bold text-xs gap-2">{t('common.confirm')}</Button>
              </div>
           ) : (
             <div className="flex gap-2">
                <Button onClick={() => setIsVOOpen(true)} className="h-9 px-6 rounded-lg bg-primary text-white font-bold text-xs gap-2 shadow-sm shadow-primary/10"><PlusCircle className="h-3.5 w-3.5" /> {t('projects.voManager.title')}</Button>
             </div>
           )}
           <Button variant="outline" className="h-9 px-4 rounded-lg font-bold text-xs border-slate-200"><Printer className="h-3.5 w-3.5" /></Button>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-slate-50 sticky top-0 z-20 border-0">
             <TableRow className="hover:bg-slate-50 border-0">
               <TableHead className="ps-6 text-slate-500 font-bold text-[10px] text-start">{t('common.order')}</TableHead>
               <TableHead className="text-slate-500 font-bold text-[10px] text-start">{t('common.code')}</TableHead>
               <TableHead className="text-slate-900 font-black text-[10px] text-start uppercase">{t('common.add')}</TableHead>
               <TableHead className="text-center text-slate-500 font-bold text-[10px]">{t('common.unit')}</TableHead>
               <TableHead className="text-center text-slate-900 font-black text-[10px] uppercase">{t('common.quantity')}</TableHead>
               <TableHead colSpan={3} className="text-center text-slate-900 font-black text-[10px] uppercase">{t('common.total')}</TableHead>
               <TableHead className="text-center text-slate-500 font-bold text-[10px]">{t('projects.boqExplorer.rate')}</TableHead>
               <TableHead className="text-end text-slate-900 font-black text-[10px] uppercase">{t('common.total')}</TableHead>
               <TableHead className="pe-6 text-slate-500 font-bold text-[10px] text-end">{t('common.status')}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>{boqTree.length === 0 ? <TableRow><TableCell colSpan={11} className="py-40 text-center opacity-30"><Calculator className="h-10 w-10 mx-auto text-slate-200" /><p className="text-sm font-black mt-4">Empty</p></TableCell></TableRow> : boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))}</TableBody>
         </Table>
      </div>

      {activeBoq && <VOManagerDialog isOpen={isVOOpen} onClose={() => setIsVOOpen(false)} boqId={activeBoq.id} transactionId={transactionId} boqNumber={activeBoq.boqNumber} boqItems={items || []} />}
    </div>
  );
}
