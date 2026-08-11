
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
  LayoutGrid, X, Clock, FilePlus,
  History, TrendingUp, DollarSign,
  HardHat, UserCheck, Link as LinkIcon,
  ShieldCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem } from '@/types/documents';
import { BOQTemplate, BOQTemplateItem, BOQTreeNode } from '@/types/templates';
import { Subcontractor } from '@/types/procurement';
import { Transaction } from '@/types/transaction';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { cn } from '@/lib/utils';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TransactionBOQProgressPage() {
  const params = useParams();
  const clientId = params.id as string;
  const transactionId = params.tId as string;
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, dir, isRtl } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [isBoqInitOpen, setIsBoqInitOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const transRef = useMemo(() => (companyId && db && transactionId) ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const boqQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqs(companyId))) : null, [db, companyId]);
  const { data: allBoqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);

  const activeBoq = useMemo(() => (allBoqs || []).find(b => b.transactionId?.trim() === transactionId?.trim()), [allBoqs, transactionId]);

  const itemsQuery = useMemo(() => (companyId && db && activeBoq?.id) ? query(collection(db, paths.boqItems(companyId, activeBoq.id)), orderBy('order')) : null, [db, companyId, activeBoq]);
  const { data: rawItems } = useCollection<BOQItem>(itemsQuery);

  const subsQuery = useMemo(() => companyId && db ? query(collection(db, paths.subcontractors(companyId)), where('status', '==', 'active')) : null, [db, companyId]);
  const { data: subcontractors } = useCollection<Subcontractor>(subsQuery);

  const ipcsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.ipcs(companyId)), where('transactionId', '==', transactionId), where('status', '==', 'approved')) : null,
  [db, companyId, transactionId]);
  const { data: approvedIpcs } = useCollection<any>(ipcsQuery);

  const billedQuantitiesMap = useMemo(() => {
    const map = new Map<string, number>();
    (approvedIpcs || []).forEach(ipc => {
      (ipc.lineItems || []).forEach((li: any) => {
        const current = map.get(li.boqItemId) || 0;
        map.set(li.boqItemId, current + (li.currentQty || 0));
      });
    });
    return map;
  }, [approvedIpcs]);

  const items = useMemo(() => (rawItems || []).filter(i => (i.plannedQuantity || 0) > 0 || (activeBoq?.status === 'draft')), [rawItems, activeBoq]);

  const allTemplatesQuery = useMemo(() => (companyId && db) ? query(collection(db, paths.boqTemplates(companyId))) : null, [db, companyId]);
  const { data: allTemplates } = useCollection<BOQTemplate>(allTemplatesQuery);

  const templates = useMemo(() => {
     if (!allTemplates || !transaction?.subServiceId) return [];
     return allTemplates.filter(temp => (temp.subServiceId?.trim() === transaction.subServiceId.trim()) && temp.isActive !== false);
  }, [allTemplates, transaction?.subServiceId]);

  const boqTree = useMemo(() => transformToBOQTree((items || []) as BOQTemplateItem[]), [items]);

  const handleLinkSub = async (itemId: string, subId: string) => {
    if (!db || !companyId || !activeBoq) return;
    const sub = subcontractors?.find(s => s.id === subId);
    try {
      await updateDoc(doc(db, paths.boqItems(companyId, activeBoq.id), itemId), {
        subcontractorId: subId === 'NONE' ? '' : subId,
        subcontractorName: subId === 'NONE' ? '' : sub?.name || '',
        updatedAt: serverTimestamp()
      });
      toast({ title: t('common.saved') });
    } catch (e) { toast({ variant: "destructive", title: t('common.error') }); }
  };

  const handleUpdateDraft = async (itemId: string, field: string, val: any) => {
    if (!db || !companyId || !activeBoq || activeBoq.status !== 'draft') return;
    try {
      await updateDoc(doc(db, paths.boqItems(companyId, activeBoq.id), itemId), {
        [field]: Number(val) || 0,
        updatedAt: serverTimestamp()
      });
    } catch (e) { console.error("Update failed", e); }
  };

  const handleConfirmBaseline = async () => {
    if (!db || !companyId || !activeBoq || !user) return;
    setLoadingAction('confirming');
    try {
      const docService = new DocumentService(db, companyId, permissions);
      const total = items.reduce((acc, i) => acc + ((i.plannedQuantity || 0) * (i.estimatedRate || 0)), 0);
      await docService.approveBOQ(activeBoq.id, total, transactionId, user.uid, globalUser?.fullName || 'Admin');
      toast({ title: tSafe('inline.baseline.confirmed', 'تم اعتماد الميزانية المرجعية', 'Baseline Confirmed') });
    } finally { setLoadingAction(null); }
  };

  const renderBOQTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => (
    <React.Fragment key={node.id}>
      <TableRow className="bg-slate-50/50 hover:bg-slate-100/50 border-b-2 border-white">
        <TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 text-start">{prefix}</TableCell>
        <TableCell colSpan={10} className="font-black text-slate-900 text-sm py-4 text-start" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
          <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-primary" />{node.title}</div>
        </TableCell>
      </TableRow>
      {node.items.map((item, iIdx) => {
        const itemPrefix = prefix + "." + (iIdx + 1);
        const planned = item.plannedQuantity || 0;
        const totalExecuted = item.executedQuantity || 0;
        const previousBilled = billedQuantitiesMap.get(item.id!) || 0;
        const currentToBill = Math.max(0, totalExecuted - previousBilled);
        const totalPct = Math.min(100, Math.round((totalExecuted / Math.max(1, planned)) * 100));
        const isDraft = activeBoq?.status === 'draft';

        return (
          <TableRow key={item.id} className="hover:bg-primary/[0.02] border-b-slate-50 text-start">
            <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
            <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">{item.referenceCode}</TableCell>
            <TableCell className="text-xs font-bold text-slate-700 text-start">{item.referenceTitle}</TableCell>
            <TableCell className="text-center">
               <Select value={item.subcontractorId || 'NONE'} onValueChange={v => handleLinkSub(item.id!, v)}>
                  <SelectTrigger className="h-7 w-[120px] rounded-lg border-2 font-black text-[8px] bg-slate-50/50">
                     <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-2xl z-[150]">
                     <SelectItem value="NONE" className="font-bold text-[10px] text-slate-400 italic">--- {isRtl ? 'بدون مقاول' : 'Internal'} ---</SelectItem>
                     {subcontractors?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px] py-1.5">{s.name}</SelectItem>)}
                  </SelectContent>
               </Select>
            </TableCell>
            <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
            <TableCell className="text-center p-1 w-[80px]">
               {isDraft ? (
                 <Input type="number" defaultValue={planned} onBlur={e => handleUpdateDraft(item.id!, 'plannedQuantity', e.target.value)} className="h-7 text-center font-black text-xs border-primary/20" />
               ) : (
                 <span className="font-black text-xs">{planned}</span>
               )}
            </TableCell>
            <TableCell className="text-center font-mono font-black text-blue-600 text-[11px] bg-blue-50/20">{previousBilled}</TableCell>
            <TableCell className="text-center font-mono font-black text-orange-600 text-[11px] bg-orange-50/20">{currentToBill}</TableCell>
            <TableCell className="text-center font-mono font-black text-slate-900 text-[11px]">{totalExecuted}</TableCell>
            <TableCell className="text-end p-1 w-[100px]">
               {isDraft ? (
                 <div className="relative">
                    <Input type="number" step="0.001" defaultValue={item.estimatedRate} onBlur={e => handleUpdateDraft(item.id!, 'estimatedRate', e.target.value)} className="h-7 text-center font-black text-[10px] text-emerald-600 border-primary/20 pe-5" />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] opacity-30">KWD</span>
                 </div>
               ) : (
                 <span className="font-mono font-black text-emerald-600 text-[11px] pe-2">{(totalExecuted * (item.estimatedRate || 0)).toLocaleString()}</span>
               )}
            </TableCell>
            <TableCell className="pe-6 w-[100px] text-end">
              <div className="space-y-1">
                <div className="flex justify-between text-[7px] font-black uppercase text-slate-400"><span>{totalPct}%</span></div>
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
          <div className="w-24 h-24 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary/30 shadow-inner"><FileSpreadsheet className="h-12 w-12" /></div>
          <div className="space-y-2">
             <h2 className="text-xl font-black text-slate-400">{t('projects.boqExplorer')}</h2>
             <p className="text-xs font-bold text-slate-300 max-w-sm mx-auto leading-relaxed">{t('boq.activateTemplate')}</p>
          </div>
          <Button onClick={() => setIsBoqInitOpen(true)} className="h-14 rounded-2xl px-10 bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 gap-3"><FilePlus className="h-5 w-5" />{t('common.add')}</Button>
      </div>
      <Dialog open={isBoqInitOpen} onOpenChange={setIsBoqInitOpen}>
         <DialogContent className="rounded-xl max-w-md p-0 overflow-hidden border shadow-3xl bg-white" dir={dir}>
            <div className="bg-slate-50 p-6 border-b text-start"><DialogTitle className="text-base font-black flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {t('common.confirm')}</DialogTitle></div>
            <div className="p-8 space-y-4 text-start">
               <Label className="text-[10px] font-black uppercase text-slate-400">{t('templates')}</Label>
               <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-12 rounded-xl border-2 font-black text-lg"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-2xl">
                     {(templates || []).map((t_item: any) => <SelectItem key={t_item.id} value={t_item.id!} className="font-bold py-4">{t_item.name}</SelectItem>)}
                  </SelectContent>
               </Select>
               <Button onClick={async () => {
                  if (!db || !companyId || !user || !selectedTemplateId) return;
                  setLoadingAction('init');
                  try {
                    const docService = new DocumentService(db, companyId, permissions);
                    await docService.instantiateBoqFromTemplate(selectedTemplateId, {
                       transactionId, clientId, clientName: transaction?.clientName || '',
                       activityTypeId: transaction?.activityTypeId || '',
                       serviceId: transaction?.serviceId || '',
                       subServiceId: transaction?.subServiceId || '',
                       name: `دراسة مقايسة - ${transaction?.subServiceName}`
                    }, user.uid, globalUser?.fullName || 'Admin');
                    setIsBoqInitOpen(false);
                  } finally { setLoadingAction(null); }
               }} disabled={!selectedTemplateId || !!loadingAction} className="w-full h-14 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 border-b-4 border-orange-700 mt-4 transition-all">
                  {loadingAction === 'init' ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 me-2" />}
                  {t('boq.instantiateStart')}
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
           {activeBoq.status === 'draft' && (
             <Badge className="bg-amber-50 text-amber-600 border-amber-200 font-black text-[8px] uppercase px-3">STUDY MODE</Badge>
           )}
        </div>
        <div className="flex items-center gap-2">
           {activeBoq.status === 'draft' && (
             <Button onClick={handleConfirmBaseline} disabled={!!loadingAction} className="h-9 px-6 rounded-lg font-black text-xs gap-2 shadow-lg border-b-4 border-orange-700">
                {loadingAction === 'confirming' ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {tSafe('inline.confirm.baseline', 'تأكيد الميزانية المرجعية', 'Confirm Baseline')}
             </Button>
           )}
           <Button variant="outline" className="h-9 px-4 rounded-lg font-bold text-xs border-slate-200" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /></Button>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-slate-50/80 sticky top-0 z-20 border-b">
             <TableRow className="hover:bg-slate-50/80 border-0">
               <TableHead className="ps-6 text-slate-500 font-mono text-[10px] text-start uppercase tracking-widest w-[80px]">#</TableHead>
               <TableHead className="text-slate-500 font-mono text-[10px] text-start uppercase tracking-widest w-[100px]">{t('common.code')}</TableHead>
               <TableHead className="text-slate-900 font-black text-[10px] text-start uppercase tracking-widest">{tSafe('inline.work.item', 'بند العمل', 'Work Item')}</TableHead>
               <TableHead className="text-center text-primary font-black text-[10px] uppercase tracking-widest">{isRtl ? 'مقاول باطن' : 'Sub-Con'}</TableHead>
               <TableHead className="text-center text-slate-500 font-black text-[10px] uppercase tracking-widest w-[60px]">{t('common.unit')}</TableHead>
               <TableHead className="text-center text-slate-900 font-black text-[10px] uppercase tracking-widest w-[80px]">{tSafe('inline.planned', 'المخطط', 'Planned')}</TableHead>
               <TableHead className="text-center text-blue-600 font-black text-[10px] uppercase tracking-widest w-[80px]">{tSafe('inline.prev', 'السابق', 'Prev')}</TableHead>
               <TableHead className="text-center text-orange-600 font-black text-[10px] uppercase tracking-widest w-[80px]">{tSafe('inline.curr', 'الحالي', 'Curr')}</TableHead>
               <TableHead className="text-center text-slate-900 font-black text-[10px] uppercase tracking-widest w-[80px]">{tSafe('common.all', 'إجمالي', 'Total')}</TableHead>
               <TableHead className="text-end text-emerald-600 font-black text-[10px] uppercase tracking-widest w-[120px]">{tSafe('inline.subtotal', 'صافي المبلغ', 'Amount')}</TableHead>
               <TableHead className="pe-6 text-slate-500 font-black text-[10px] text-end uppercase tracking-widest w-[100px]">{tSafe('inline.progress', 'الإنجاز', 'Status')}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>{boqTree.length === 0 ? <TableRow><TableCell colSpan={11} className="py-40 text-center opacity-30"><Calculator className="h-10 w-10 mx-auto text-slate-200" /><p className="text-sm font-black mt-4">{tSafe('inline.empty', 'فارغ', 'Empty')}</p></TableCell></TableRow> : boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))}</TableBody>
         </Table>
      </div>
    </div>
  );
}
