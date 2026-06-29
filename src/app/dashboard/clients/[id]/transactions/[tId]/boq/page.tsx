'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileSpreadsheet, ArrowRight, Loader2, Save, 
  CheckCircle2, AlertTriangle, LayoutGrid, Boxes, 
  Hammer, Calculator, TrendingUp, ChevronDown, ChevronRight,
  Printer, MoreVertical, Search, Filter, Folder,
  Target, Activity, History
} from "lucide-react";
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { BOQ, BOQItem } from '@/types/documents';
import { Transaction } from '@/types/transaction';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { transformToBOQTree } from '@/lib/boq-tree-utils';
import { BOQTreeNode } from '@/types/templates';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function TransactionBOQProgressPage() {
  const params = useParams();
  const transactionId = params.tId as string;
  const clientId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // حالات الإدخال والتحميل
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentInputs, setCurrentInputs] = useState<Record<string, number>>({});

  // 1. جلب البيانات الأساسية
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: items, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  const boqTree = useMemo(() => transformToBOQTree(items || []), [items]);
  const executionService = useMemo(() => db && companyId ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  // دالة الحفظ الميداني
  const handleUpdateQuantity = async (item: BOQItem) => {
    const newVal = currentInputs[item.id!];
    if (!newVal || newVal <= 0 || !executionService || !activeBoq || !user) return;

    setUpdatingId(item.id!);
    try {
      // استخدام المرحلة الافتراضية للبند أو أول مرحلة مرتبطة به
      const targetStageId = item.technicalStageId || (item.technicalStageIds?.[0]) || '';
      
      if (!targetStageId) {
        throw new Error(isRtl ? "البند غير مرتبط بمرحلة فنية" : "Item not linked to a stage");
      }

      await executionService.recordBOQItemExecution(
        activeBoq.id, 
        item.id!, 
        targetStageId,
        newVal, 
        user.uid, 
        user.displayName || 'Engineer'
      );

      // تصفير الإدخال الحالي بعد النجاح
      setCurrentInputs(prev => ({ ...prev, [item.id!]: 0 }));
      toast({ 
        title: isRtl ? "تم تسجيل الإنجاز" : "Progress Recorded",
        description: isRtl ? `تمت إضافة ${newVal} وحدة للبند.` : `Added ${newVal} units.`
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleInputChange = (itemId: string, val: string) => {
    const num = parseFloat(val);
    setCurrentInputs(prev => ({ ...prev, [itemId]: isNaN(num) ? 0 : num }));
  };

  // إحصائيات فوتر الصفحة
  const overallStats = useMemo(() => {
    if (!items) return { totalPlanned: 0, totalExecuted: 0, progress: 0 };
    const totalP = items.reduce((acc, i) => acc + ((i.plannedQuantity || 0) * (i.estimatedRate || 0)), 0);
    const totalE = items.reduce((acc, i) => acc + ((i.executedQuantity || 0) * (i.estimatedRate || 0)), 0);
    return {
      totalPlanned: totalP,
      totalExecuted: totalE,
      progress: totalP > 0 ? Math.round((totalE / totalP) * 100) : 0
    };
  }, [items]);

  /**
   * دالة العرض الجدولي الشجري المنظم (Tree Grid)
   * تدعم عرض (السابق، الحالي، الإجمالي)
   */
  const renderExecutionTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => {
    return (
      <React.Fragment key={node.id}>
        {/* صف القسم (Group Header) */}
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

        {/* صفوف البنود التنفيذية */}
        {node.items.map((item, iIdx) => {
          const itemPrefix = `${prefix.replace('.0', '')}.${iIdx + 1}`;
          const currentVal = currentInputs[item.id!] || 0;
          const prevVal = item.executedQuantity || 0;
          const totalCumulative = prevVal + currentVal;
          const totalPlannedValue = (item.plannedQuantity || 0) * (item.estimatedRate || 0);
          
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
              <TableCell className="text-center font-mono font-black text-slate-400 text-xs bg-slate-50/30">{item.plannedQuantity}</TableCell>
              
              {/* السابق */}
              <TableCell className="text-center font-mono font-black text-slate-600 text-xs">{prevVal}</TableCell>
              
              {/* الحالي (الإدخال) */}
              <TableCell className="p-1 w-[130px]">
                <div className="relative group/input">
                  <Input 
                    type="number" 
                    value={currentVal || ''}
                    onChange={(e) => handleInputChange(item.id!, e.target.value)}
                    onBlur={() => handleUpdateQuantity(item)}
                    placeholder="0"
                    className={cn(
                      "h-9 rounded-full border-2 font-black text-center text-xs transition-all",
                      currentVal > 0 ? "border-primary bg-primary/5 text-primary shadow-lg" : "bg-white border-slate-100"
                    )} 
                  />
                  {updatingId === item.id && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-primary" />}
                  {currentVal > 0 && updatingId !== item.id && <button onClick={() => handleUpdateQuantity(item)} className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:scale-110 transition-transform"><CheckCircle2 className="h-4 w-4" /></button>}
                </div>
              </TableCell>

              {/* الإجمالي */}
              <TableCell className="text-center">
                 <Badge variant="outline" className={cn(
                   "font-black text-xs px-3 h-8 rounded-xl border-2",
                   isOver ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-50 text-slate-900 border-slate-100"
                 )}>
                    {totalCumulative}
                 </Badge>
              </TableCell>

              {/* الفئة */}
              <TableCell className="text-center font-mono font-bold text-slate-400 text-xs">
                {item.estimatedRate?.toLocaleString()}
              </TableCell>
              
              {/* القيمة الإجمالية المنفذة */}
              <TableCell className="text-end font-mono font-black text-emerald-600 text-xs">
                {(totalCumulative * (item.estimatedRate || 0)).toLocaleString()}
              </TableCell>

              {/* الإنجاز */}
              <TableCell className="pe-6 w-[120px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-1 bg-slate-100 [&>div]:bg-primary shadow-sm" />
                </div>
              </TableCell>
            </TableRow>
          );
        })}

        {/* العودية للأقسام الفرعية */}
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
                 <Badge className="bg-primary/10 text-primary border-0 font-black text-[9px] uppercase h-5 px-3">Live Execution</Badge>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                 {transaction?.clientName} | {transaction?.subServiceName}
              </p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
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
               <TableHead className="text-center w-[130px]">{isRtl ? 'الحالي' : 'Current'}</TableHead>
               <TableHead className="text-center w-[100px]">{isRtl ? 'الإجمالي' : 'Total'}</TableHead>
               <TableHead className="text-center w-[100px]">{isRtl ? 'الفئة' : 'Rate'}</TableHead>
               <TableHead className="text-end w-[120px]">{isRtl ? 'القيمة' : 'Value'}</TableHead>
               <TableHead className="pe-6 w-[120px]">{isRtl ? 'الإنجاز' : 'Progress'}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
              {boqTree.map((node, idx) => renderExecutionTreeRows(node, (idx + 1).toString() + ".0"))}
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
