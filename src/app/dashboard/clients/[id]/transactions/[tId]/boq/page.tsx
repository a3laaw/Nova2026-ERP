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
  Info, Sparkles, Pencil, Save, ShieldAlert
} from "lucide-react";
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, collectionGroup } from 'firebase/firestore';
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
  const [processingVOId, setProcessingVOId] = useState<string | null>(null);
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // 1. جلب البيانات الأساسية
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId))) : null, [db, companyId, transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: rawItems, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  const items = useMemo(() => {
    return (rawItems || []).filter(i => (i.plannedQuantity || 0) > 0);
  }, [rawItems]);

  const variationsQuery = useMemo(() => 
    companyId && db && activeBoq?.id 
      ? query(collection(db, paths.boqVariations(companyId, activeBoq.id))) 
      : null, 
  [db, companyId, activeBoq]);
  const { data: variations } = useCollection<BOQVariation>(variationsQuery);

  const voItemsQuery = useMemo(() => 
    companyId && db ? query(collectionGroup(db, 'items'), where('companyId', '==', companyId)) : null, 
  [db, companyId]);
  const { data: rawAllItems } = useCollection<any>(voItemsQuery);

  const voDeltaMap = useMemo(() => {
    const map: Record<string, number> = {};
    const approvedVoIds = new Set((variations || []).filter(v => v.status === 'approved').map(v => v.id));

    (rawAllItems || []).filter(i => i.boqId === activeBoq?.id).forEach(vItem => {
      if (vItem.variationId && approvedVoIds.has(vItem.variationId)) {
        if (vItem.sourceBoqItemId) {
          map[vItem.sourceBoqItemId] = (map[vItem.sourceBoqItemId] || 0) + (vItem.quantityDelta || 0);
        }
      }
    });
    return map;
  }, [rawAllItems, variations, activeBoq]);

  const executionsQuery = useMemo(() => 
    companyId && db ? query(collectionGroup(db, 'executions'), where('companyId', '==', companyId)) : null, 
  [db, companyId]);
  const { data: rawExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);

  const allExecutions = useMemo(() => {
    return (rawExecutions || []).filter(e => e.boqId === activeBoq?.id);
  }, [rawExecutions, activeBoq]);

  const financialStats = useMemo(() => {
    const original = activeBoq?.totalAmount || 0;
    const voTotal = (variations || [])
      .filter(v => v.status === 'approved')
      .reduce((sum, v) => sum + (v.totalAmount || 0), 0);
    
    return {
      original,
      voTotal,
      final: original + voTotal
    };
  }, [activeBoq, variations]);

  const executionMetrics = useMemo(() => {
    if (!allExecutions || !stages) return {};
    const metrics: Record<string, { prev: number, current: number }> = {};
    allExecutions.forEach(exec => {
      const stage = stages.find(s => s.technicalStageId === exec.technicalStageId);
      const itemId = exec.boqItemId;
      if (!metrics[itemId]) metrics[itemId] = { prev: 0, current: 0 };
      if (stage?.status === 'completed') metrics[itemId].prev += (exec.quantity || 0);
      else if (stage?.status === 'in-progress' || stage?.status === 'pending') metrics[itemId].current += (exec.quantity || 0);
    });
    return metrics;
  }, [allExecutions, stages]);

  const boqTree = useMemo(() => transformToBOQTree(items || []), [items]);

  const overallStats = useMemo(() => {
    if (!items) return { totalPlanned: financialStats.final, totalExecuted: 0, progress: 0 };
    const metricsValue = items.map(i => {
        const m = executionMetrics[i.id!] || { prev: 0, current: 0 };
        return (m.prev + m.current) * (i.estimatedRate || 0);
    });
    const totalE = metricsValue.reduce((acc, val) => acc + val, 0);
    return {
      totalPlanned: financialStats.final,
      totalExecuted: totalE,
      progress: financialStats.final > 0 ? Math.round((totalE / financialStats.final) * 100) : 0
    };
  }, [items, executionMetrics, financialStats]);

  const handleApproveBaseline = async () => {
    if (!db || !companyId || !user || !activeBoq) return;
    setLoadingAction('approving');
    try {
      const service = new DocumentService(db, companyId, permissions);
      const currentTotal = items.reduce((acc, i) => acc + (i.plannedQuantity * (i.estimatedRate || 0)), 0);
      await service.approveBOQ(activeBoq.id, currentTotal, transactionId, user.uid, globalUser?.username || user.displayName || 'Admin');
      toast({ title: isRtl ? "تم اعتماد الميزانية الرسمية للمشروع" : "Project Baseline Approved" });
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

  const handleApproveVO = async (voId: string) => {
    if (!db || !companyId || !user || !activeBoq) return;
    setProcessingVOId(voId);
    try {
      const service = new VariationService(db, companyId, permissions);
      const userName = globalUser?.username || user.displayName || 'Admin';
      await service.approveVariation(activeBoq.id, voId, transactionId, user.uid, userName);
      toast({ title: isRtl ? "تمت عملية الاعتماد المالي والميداني" : "VO Approved & Injected" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const handleRejectVO = async (voId: string) => {
    if (!db || !companyId || !user || !activeBoq) return;
    setProcessingVOId(voId);
    try {
      const service = new VariationService(db, companyId, permissions);
      const userName = globalUser?.username || user.displayName || 'Admin';
      await service.rejectVariation(activeBoq.id, voId, transactionId, user.uid, userName);
      toast({ title: isRtl ? "تم رفض وإلغاء التغيير" : "Variation Rejected" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setProcessingVOId(null);
    }
  };

  const renderBOQTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => {
    if (node.items.length === 0 && node.children.length === 0) return null;

    return (
      <React.Fragment key={node.id}>
        <TableRow className="bg-slate-50/50 hover:bg-slate-100 border-b-2 border-white">
          <TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 w-[80px] text-start">{prefix}</TableCell>
          <TableCell className="w-[100px] font-mono text-[10px] font-bold text-slate-400 text-start">---</TableCell>
          <TableCell className="font-black text-slate-800 text-sm py-4 text-start" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-orange-400" />
              {node.title}
            </div>
          </TableCell>
          <TableCell colSpan={10}></TableCell>
        </TableRow>

        {node.items.map((item, iIdx) => {
          const itemPrefix = `${prefix.replace('.0', '')}.${iIdx + 1}`;
          const metrics = executionMetrics[item.id!] || { prev: 0, current: 0 };
          const totalCumulative = metrics.prev + metrics.current;
          
          const isVOInjected = item.referenceCode?.startsWith('VO-');
          const delta = isVOInjected ? item.plannedQuantity : (voDeltaMap[item.id!] || 0);
          const originalQty = isVOInjected ? 0 : (item.plannedQuantity - delta);
          const finalPlan = item.plannedQuantity;
          
          const totalPct = Math.round((totalCumulative / (finalPlan || 1)) * 100);
          
          return (
            <TableRow key={item.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group/item">
              <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8 text-start">{itemPrefix}</TableCell>
              <TableCell className="font-mono text-[10px] font-black text-primary/60 text-start">
                 <div className="flex flex-col gap-1">
                    <span>{item.referenceCode}</span>
                    {isVOInjected && (
                      <Badge className="bg-blue-600 text-white border-0 text-[7px] font-black px-1.5 h-4 uppercase w-fit gap-1 shadow-sm">
                        <Sparkles className="h-2 w-2" /> {isRtl ? 'بند مستجد' : 'VO NEW'}
                      </Badge>
                    )}
                 </div>
              </TableCell>
              <TableCell className="text-xs font-bold text-slate-700 text-start" style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 16}px` }}>
                {item.referenceTitle}
              </TableCell>
              <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
              
              <TableCell className="text-center w-[70px] font-mono font-bold text-slate-400 text-[10px] bg-slate-50/30">
                 {originalQty}
              </TableCell>
              <TableCell className="text-center w-[70px] font-mono font-black text-[10px] bg-slate-50/30">
                 {delta !== 0 ? (
                   <span className={cn(delta > 0 ? "text-emerald-600" : "text-rose-600")}>
                      {delta > 0 ? `+${delta}` : delta}
                   </span>
                 ) : <span className="text-slate-200">0</span>}
              </TableCell>
              <TableCell className="text-center w-[120px] font-mono font-black text-slate-900 text-xs border-x border-slate-100">
                 {isEditingBaseline ? (
                   <Input 
                     type="number" 
                     className="h-8 text-center font-black border-primary/30" 
                     value={item.plannedQuantity} 
                     onChange={e => handleUpdateItem(item.id!, Number(e.target.value), item.estimatedRate || 0)} 
                   />
                 ) : finalPlan}
              </TableCell>
              
              <TableCell className="text-center font-mono font-black text-blue-600 text-xs">{metrics.prev}</TableCell>
              <TableCell className="text-center">
                 <div className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-orange-50 border border-orange-100 text-orange-600 font-black text-xs">
                    {metrics.current}
                 </div>
              </TableCell>
              <TableCell className="text-center">
                 <Badge variant="outline" className="font-black text-xs px-4 h-8 rounded-full bg-slate-900 text-white border-slate-900">
                    {totalCumulative}
                 </Badge>
              </TableCell>
              <TableCell className="text-center font-mono font-bold text-slate-400 text-xs w-[120px]">
                 {isEditingBaseline ? (
                   <Input 
                     type="number" 
                     step="0.001"
                     className="h-8 text-center font-black border-primary/30 text-emerald-600" 
                     value={item.estimatedRate} 
                     onChange={e => handleUpdateItem(item.id!, item.plannedQuantity, Number(e.target.value))} 
                   />
                 ) : item.estimatedRate?.toLocaleString()}
              </TableCell>
              <TableCell className="text-end font-mono font-black text-emerald-600 text-xs">
                {(totalCumulative * (item.estimatedRate || 0)).toLocaleString()}
              </TableCell>
              <TableCell className="pe-6 w-[120px] text-end">
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-400"><span>{totalPct}%</span></div>
                  <Progress value={totalPct} className="h-1" />
                </div>
              </TableCell>
            </TableRow>
          );
        })}

        {node.children.map((child, cIdx) => {
          const childPrefix = `${prefix.replace('.0', '')}.${node.items.length + cIdx + 1}`;
          return renderBOQTreeRows(child, childPrefix);
        })}
      </React.Fragment>
    );
  };

  if (boqLoading || itemsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  if (!activeBoq) return (
    <div className="p-20 text-center space-y-4">
      <FileSpreadsheet className="h-16 w-16 mx-auto text-slate-200" />
      <h2 className="text-xl font-black text-slate-400">{isRtl ? 'لا توجد مقايسة مرتبطة' : 'No BOQ linked'}</h2>
      <Button onClick={() => router.back()} variant="outline" className="rounded-xl">رجوع</Button>
    </div>
  );

  const isDraft = activeBoq.status === 'draft';

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500" dir={dir}>
      
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl border-2">
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-3">
                 <h1 className="text-xl font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1>
                 <Badge variant="outline" className={cn(
                    "text-[8px] font-black uppercase px-2",
                    isDraft ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                 )}>
                    {activeBoq.status}
                 </Badge>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{transaction?.clientName}</p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           {isDraft ? (
              <div className="flex gap-2">
                 <Button 
                   onClick={() => setIsEditingBaseline(!isEditingBaseline)}
                   variant={isEditingBaseline ? "secondary" : "outline"}
                   className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2"
                 >
                    {isEditingBaseline ? <CheckCircle2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    {isEditingBaseline ? (isRtl ? 'تم التعديل' : 'Finish Editing') : (isRtl ? 'تعديل كميات الميزانية' : 'Customize Project BOQ')}
                 </Button>
                 <Button 
                   onClick={handleApproveBaseline}
                   disabled={loadingAction === 'approving'}
                   className="h-11 px-8 rounded-xl bg-emerald-600 text-white font-black text-xs gap-2 shadow-xl shadow-emerald-100"
                 >
                    {loadingAction === 'approving' ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {isRtl ? 'اعتماد الميزانية والبدء' : 'Approve & Start Site Work'}
                 </Button>
              </div>
           ) : (
             <div className="flex gap-2">
                <div className="flex gap-2">
                   {(variations || []).filter(v => v.status === 'draft').map(vo => (
                     <div key={vo.id} className="p-1 px-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3 shadow-sm">
                        <div className="text-start">
                           <p className="text-[8px] font-black text-amber-600 uppercase">DRAFT VO</p>
                           <p className="text-[10px] font-black text-slate-800">{vo.title}</p>
                        </div>
                        {isAdmin && (
                           <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                onClick={() => handleApproveVO(vo.id)}
                                disabled={processingVOId === vo.id}
                                className="h-8 rounded-lg bg-emerald-600 text-white font-black text-[9px] hover:bg-emerald-700 px-3"
                              >
                                 {processingVOId === vo.id ? <Loader2 className="animate-spin h-3 w-3" /> : (isRtl ? 'اعتماد وصرف' : 'Approve')}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleRejectVO(vo.id)}
                                disabled={processingVOId === vo.id}
                                className="h-8 rounded-lg text-rose-600 font-black text-[9px] hover:bg-rose-50 px-3"
                              >
                                 {isRtl ? 'رفض' : 'Reject'}
                              </Button>
                           </div>
                        )}
                     </div>
                   ))}
                </div>

                <Button 
                  onClick={() => setIsVOOpen(true)}
                  className="h-11 px-6 rounded-xl font-black text-xs gap-2 bg-[#1e1b4b] text-white hover:bg-slate-800 shadow-xl"
                >
                   <PlusCircle className="h-4 w-4 text-primary" /> {isRtl ? 'إنشاء أمر تغييري' : 'New Variation'}
                </Button>
             </div>
           )}
           <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2"><Printer className="h-4 w-4" /> {isRtl ? 'طباعة تقرير الإنجاز' : 'Print Certificate'}</Button>
        </div>
      </header>

      {isDraft && (
        <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-[2.5rem] flex items-start gap-4 animate-in zoom-in-95">
           <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
           <div className="text-start">
              <h5 className="font-black text-sm text-amber-900">{isRtl ? 'مرحلة ضبط الميزانية المخصصة للمشروع' : 'Project Baseline Customization Phase'}</h5>
              <p className="text-xs font-bold text-amber-800/80 leading-relaxed mt-1">
                 {isRtl 
                   ? 'يمكنك الآن تعديل الكميات والأسعار لتناسب هذا المشروع تحديداً قبل اعتماده كمرجع رسمي للموقع. القالب الأصلي لن يتأثر بتغييراتك هنا.' 
                   : 'You can now adjust quantities and rates to fit this specific project before approving it as the official baseline. Global templates won\'t be affected.'}
              </p>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="border-0 shadow-lg rounded-2xl p-5 text-start bg-white">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الميزانية الأصلية' : 'Original Budget'}</p>
            <h3 className="text-xl font-black text-slate-900">{financialStats.original.toLocaleString()} KWD</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl p-5 text-start bg-white border-s-4 border-s-blue-500">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'الأوامر التغييرية المعتمدة' : 'Approved Variations'}</p>
            <h3 className="text-xl font-black text-blue-600">{financialStats.voTotal > 0 ? '+' : ''}{financialStats.voTotal.toLocaleString()} KWD</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-2xl p-5 text-start bg-slate-900 text-white border-s-4 border-s-emerald-500">
            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'الميزانية المعدلة النهائية' : 'Revised Final Total'}</p>
            <h3 className="text-xl font-black text-emerald-400">{financialStats.final.toLocaleString()} KWD</h3>
         </Card>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-2xl border border-primary/5 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-slate-900 sticky top-0 z-20">
             <TableRow className="hover:bg-slate-900 border-0">
               <TableHead className="ps-6 w-[80px] text-white/40 font-mono text-[10px] text-start">S.No</TableHead>
               <TableHead className="w-[100px] text-white/40 font-mono text-[10px] text-start">Code</TableHead>
               <TableHead className="text-white font-black text-xs text-start">{isRtl ? 'بند العمل / الوصف' : 'Item Description'}</TableHead>
               <TableHead className="text-center w-[60px] text-white font-black text-xs">{isRtl ? 'الوحدة' : 'Unit'}</TableHead>
               
               <TableHead className="text-center w-[70px] text-white/60 font-black text-[9px] bg-white/5">{isRtl ? 'الأصل' : 'Orig'}</TableHead>
               <TableHead className="text-center w-[70px] text-white/60 font-black text-[9px] bg-white/5">{isRtl ? 'تغيير VO' : 'VO Δ'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs bg-white/10">{isRtl ? (isEditingBaseline ? 'تعديل الكمية' : 'المخطط') : (isEditingBaseline ? 'Qty Edit' : 'Revised')}</TableHead>
               
               <TableHead className="text-center w-[100px] text-white font-black text-xs">{isRtl ? 'السابق' : 'Prev'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs">{isRtl ? 'الحالي' : 'Current'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs">{isRtl ? 'الإجمالي' : 'Total'}</TableHead>
               <TableHead className="text-center w-[120px] text-white font-black text-xs">{isRtl ? (isEditingBaseline ? 'تعديل السعر' : 'الفئة') : 'Rate'}</TableHead>
               <TableHead className="text-end w-[120px] text-white font-black text-xs">{isRtl ? 'القيمة' : 'Value'}</TableHead>
               <TableHead className="pe-6 w-[120px] text-end text-white font-black text-xs">{isRtl ? 'الإنجاز' : 'Progress'}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
              {boqTree.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={13} className="py-40 text-center opacity-30">
                      <div className="flex flex-col items-center gap-4">
                         <Calculator className="h-12 w-12 text-slate-300" />
                         <p className="text-lg font-black">{isRtl ? 'المقايسة لا تحتوي على بنود نشطة' : 'No active items in BOQ'}</p>
                      </div>
                   </TableCell>
                </TableRow>
              ) : (
                boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))
              )}
           </TableBody>
         </Table>

         <footer className="bg-[#1e1b4b] text-white p-8 px-12 flex flex-col md:flex-row justify-between items-center gap-10 mt-auto shadow-2xl">
            <div className="flex items-center gap-16">
               <div className="text-start">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{isRtl ? 'إجمالي الميزانية المخططة' : 'Total Budget'}</p>
                  <h3 className="text-3xl font-black font-headline">{financialStats.final.toLocaleString()} <span className="text-sm text-white/30">KWD</span></h3>
               </div>
               <div className="text-start border-s-2 border-white/10 ps-16">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">{isRtl ? 'القيمة المنفذة حالياً' : 'Total Executed'}</p>
                  <h3 className="text-3xl font-black font-headline text-emerald-400">{overallStats.totalExecuted.toLocaleString()} <span className="text-sm">KWD</span></h3>
               </div>
            </div>
            <div className="flex items-center gap-10 bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
               <div className="flex-1 md:w-64 space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-400">{isRtl ? 'إنجاز المشروع كلياً' : 'Completion'}</span>
                     <span className="text-primary">{overallStats.progress}%</span>
                  </div>
                  <Progress value={overallStats.progress} className="h-2 bg-white/10" />
               </div>
               <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-2xl"><Calculator className="h-7 w-7" /></div>
            </div>
         </footer>
      </div>

      <VOManagerDialog 
        isOpen={isVOOpen}
        onClose={() => setIsVOOpen(false)}
        boqId={activeBoq.id}
        transactionId={transactionId}
        boqNumber={activeBoq.boqNumber}
        boqItems={rawItems || []}
      />
    </div>
  );
}
