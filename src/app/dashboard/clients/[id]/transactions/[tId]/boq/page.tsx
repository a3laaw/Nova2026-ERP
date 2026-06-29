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
  TrendingUp, ChevronDown, ChevronRight,
  Printer, Folder, Calculator, ShieldCheck,
  Zap, History
} from "lucide-react";
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem, BOQItemExecutionEntry } from '@/types/documents';
import { Transaction, StageInstance } from '@/types/transaction';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { BOQTreeNode } from '@/types/templates';
import { cn } from '@/lib/utils';

/**
 * صفحة متابعة إنجاز المقايسة الآلية (Automated BOQ Progress)
 * تقوم بحساب السابق والحالي والإجمالي برمجياً بناءً على حالة المراحل.
 */
export default function TransactionBOQProgressPage() {
  const params = useParams();
  const transactionId = params.tId as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // 1. جلب البيانات الأساسية (المعاملة والمراحل)
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const stagesQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactionStages(companyId, transactionId))) : null, [db, companyId, transactionId]);
  const { data: stages } = useCollection<StageInstance>(stagesQuery);

  // 2. جلب المقايسة وبنودها
  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: items, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  // 3. جلب كافة سجلات التنفيذ المرتبطة بهذه المقايسة (Collection Group Query)
  // ملاحظة: هذا الاستعلام يسحب كل الحركات الميدانية المسجلة عبر كافة البنود
  const executionsQuery = useMemo(() => 
    companyId && db && activeBoq?.id 
      ? query(collectionGroup(db, 'executions'), where('boqId', '==', activeBoq.id)) 
      : null, 
  [db, companyId, activeBoq]);
  const { data: allExecutions } = useCollection<BOQItemExecutionEntry>(executionsQuery);

  // 4. محرك الحساب الآلي (Automated Calculation Engine)
  // يقوم بتوزيع الكميات بناءً على حالة المرحلة المسجل عليها الإنجاز
  const executionMetrics = useMemo(() => {
    if (!allExecutions || !stages) return {};
    
    const metrics: Record<string, { prev: number, current: number }> = {};
    
    allExecutions.forEach(exec => {
      const stage = stages.find(s => s.technicalStageId === exec.technicalStageId);
      const itemId = exec.boqItemId;
      
      if (!metrics[itemId]) metrics[itemId] = { prev: 0, current: 0 };
      
      // المادة 1: إذا كانت المرحلة مكتملة، تذهب الكمية لـ "السابق"
      if (stage?.status === 'completed') {
        metrics[itemId].prev += (exec.quantity || 0);
      } 
      // المادة 2: إذا كانت المرحلة قيد التنفيذ، تذهب الكمية لـ "الحالي"
      else if (stage?.status === 'in-progress' || stage?.status === 'pending') {
        metrics[itemId].current += (exec.quantity || 0);
      }
    });
    
    return metrics;
  }, [allExecutions, stages]);

  const boqTree = useMemo(() => transformToBOQTree(items || []), [items]);

  // إحصائيات الفوتر
  const overallStats = useMemo(() => {
    if (!items) return { totalPlanned: 0, totalExecuted: 0, progress: 0 };
    const totalP = items.reduce((acc, i) => acc + ((i.plannedQuantity || 0) * (i.estimatedRate || 0)), 0);
    const metrics = items.map(i => {
        const m = executionMetrics[i.id!] || { prev: 0, current: 0 };
        return (m.prev + m.current) * (i.estimatedRate || 0);
    });
    const totalE = metrics.reduce((acc, val) => acc + val, 0);
    return {
      totalPlanned: totalP,
      totalExecuted: totalE,
      progress: totalP > 0 ? Math.round((totalE / totalP) * 100) : 0
    };
  }, [items, executionMetrics]);

  const renderExecutionTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => {
    return (
      <React.Fragment key={node.id}>
        <TableRow className="bg-slate-50/50 hover:bg-slate-100 border-b-2 border-white">
          <TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 w-[80px]">{prefix}</TableCell>
          <TableCell className="w-[100px] font-mono text-[10px] font-bold text-slate-400">---</TableCell>
          <TableCell className="font-black text-slate-800 text-sm py-4" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-orange-400" />
              {node.title}
            </div>
          </TableCell>
          <TableCell colSpan={8}></TableCell>
        </TableRow>

        {node.items.map((item, iIdx) => {
          const itemPrefix = `${prefix.replace('.0', '')}.${iIdx + 1}`;
          const metrics = executionMetrics[item.id!] || { prev: 0, current: 0 };
          
          const prevVal = metrics.prev;
          const currentVal = metrics.current;
          const totalCumulative = prevVal + currentVal;
          
          const progress = (totalCumulative / (item.plannedQuantity || 1)) * 100;
          const isOver = totalCumulative > (item.plannedQuantity || 0);

          return (
            <TableRow key={item.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group/item">
              <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8">{itemPrefix}</TableCell>
              <TableCell className="font-mono text-[10px] font-black text-primary/60">{item.referenceCode}</TableCell>
              <TableCell className="text-xs font-bold text-slate-700" style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 16}px` }}>
                {item.referenceTitle}
              </TableCell>
              <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || '-'}</TableCell>
              
              {/* المخطط */}
              <TableCell className="text-center w-[80px]">
                 <span className="font-mono font-black text-slate-400 text-xs bg-slate-100/50 px-3 py-1 rounded-lg">
                    {item.plannedQuantity}
                 </span>
              </TableCell>
              
              {/* السابق - آلي */}
              <TableCell className="text-center">
                 <span className="font-mono font-black text-blue-600 text-xs">
                    {prevVal || '0'}
                 </span>
              </TableCell>
              
              {/* الحالي - آلي - تصميم كبسولة مميزة */}
              <TableCell className="text-center w-[100px]">
                 <div className="inline-flex items-center justify-center h-8 px-4 rounded-full bg-orange-50 border border-orange-100 text-orange-600 font-black text-xs shadow-sm">
                    {currentVal || '0'}
                 </div>
              </TableCell>

              {/* الإجمالي - آلي */}
              <TableCell className="text-center w-[100px]">
                 <Badge variant="outline" className={cn(
                   "font-black text-xs px-4 h-9 rounded-full border-2 shadow-sm",
                   isOver ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-900 text-white border-slate-900"
                 )}>
                    {totalCumulative}
                 </Badge>
              </TableCell>

              <TableCell className="text-center font-mono font-bold text-slate-400 text-xs">
                {item.estimatedRate?.toLocaleString()}
              </TableCell>
              
              <TableCell className="text-end font-mono font-black text-emerald-600 text-xs">
                {(totalCumulative * (item.estimatedRate || 0)).toLocaleString()}
              </TableCell>

              <TableCell className="pe-6 w-[120px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-1 bg-slate-100 [&>div]:bg-primary" />
                </div>
              </TableCell>
            </TableRow>
          );
        })}

        {node.children.map((child, cIdx) => {
          const childPrefix = `${prefix.replace('.0', '')}.${node.items.length + cIdx + 1}`;
          return renderExecutionTreeRows(child, childPrefix);
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

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500" dir={dir}>
      
      <header className="flex flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl border-2">
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-3">
                 <h1 className="text-xl font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1>
                 <Badge className="bg-emerald-500 text-white border-0 font-black text-[9px] uppercase h-5 px-3">Automated Ledger</Badge>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                 {transaction?.clientName} | {transaction?.subServiceName}
              </p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="hidden md:flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <History className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase">{isRtl ? 'تحديث تلقائي من الميدان' : 'Live Field Sync Active'}</span>
           </div>
           <Button variant="outline" size="sm" className="h-11 px-6 rounded-xl font-black text-xs gap-2 border-2 bg-white hover:bg-slate-50">
              <Printer className="h-4 w-4" /> {isRtl ? 'طباعة تقرير الإنجاز' : 'Print Certificate'}
           </Button>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-3xl shadow-2xl border border-primary/5 overflow-hidden flex flex-col min-h-[600px]">
         <Table>
           <TableHeader className="bg-slate-50 border-b-2">
             <TableRow>
               <TableHead className="ps-6 w-[80px]">S.No</TableHead>
               <TableHead className="w-[100px]">Code</TableHead>
               <TableHead>{isRtl ? 'بند العمل / الوصف' : 'Item Description'}</TableHead>
               <TableHead className="text-center w-[60px]">{isRtl ? 'الوحدة' : 'Unit'}</TableHead>
               <TableHead className="text-center w-[80px] bg-slate-100/50">{isRtl ? 'المخطط' : 'Plan'}</TableHead>
               <TableHead className="text-center w-[80px]">{isRtl ? 'السابق' : 'Prev'}</TableHead>
               <TableHead className="text-center w-[120px]">{isRtl ? 'الحالي' : 'Current'}</TableHead>
               <TableHead className="text-center w-[100px]">{isRtl ? 'الإجمالي' : 'Total'}</TableHead>
               <TableHead className="text-center w-[100px]">{isRtl ? 'الفئة' : 'Rate'}</TableHead>
               <TableHead className="text-end w-[120px]">{isRtl ? 'القيمة' : 'Value'}</TableHead>
               <TableHead className="pe-6 w-[120px]">{isRtl ? 'الإنجاز' : 'Progress'}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
              {boqTree.map((node, idx) => renderBOQTreeRows(node, (idx + 1).toString() + ".0"))}
           </TableBody>
         </Table>

         <footer className="bg-[#1e1b4b] text-white p-8 px-12 flex flex-col md:flex-row justify-between items-center gap-10 mt-auto shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5"><TrendingUp className="h-40 w-40" /></div>
            
            <div className="flex items-center gap-16 relative z-10">
               <div className="text-start">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{isRtl ? 'إجمالي الميزانية المخططة' : 'Total Budget'}</p>
                  <h3 className="text-3xl font-black font-headline">{overallStats.totalPlanned.toLocaleString()} <span className="text-sm text-white/30">KWD</span></h3>
               </div>
               <div className="text-start border-s-2 border-white/10 ps-16">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">{isRtl ? 'القيمة المنفذة حالياً' : 'Total Executed'}</p>
                  <h3 className="text-3xl font-black font-headline text-emerald-400">{overallStats.totalExecuted.toLocaleString()} <span className="text-sm">KWD</span></h3>
               </div>
            </div>

            <div className="flex items-center gap-10 w-full md:w-auto bg-white/5 p-6 rounded-[2.5rem] border border-white/10 shadow-inner">
               <div className="flex-1 md:w-64 space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-400">{isRtl ? 'إنجاز المشروع كلياً' : 'Completion'}</span>
                     <span className="text-primary">{overallStats.progress}%</span>
                  </div>
                  <Progress value={overallStats.progress} className="h-2 bg-white/10 [&>div]:bg-primary shadow-2xl" />
               </div>
               <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-2xl ring-4 ring-primary/10">
                  <Calculator className="h-7 w-7" />
               </div>
            </div>
         </footer>
      </div>
    </div>
  );
}
