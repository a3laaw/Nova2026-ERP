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
  Target, Activity
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

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 1. Data Fetching
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: items, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  const boqTree = useMemo(() => transformToBOQTree(items || []), [items]);
  
  const executionService = useMemo(() => db && companyId ? new BOQExecutionService(db, companyId, permissions) : null, [db, companyId, permissions]);

  const handleUpdateQuantity = async (itemId: string, val: number) => {
    if (!executionService || !activeBoq || !user) return;
    setUpdatingId(itemId);
    try {
      await executionService.updateBOQItemExecutedQuantity(
        activeBoq.id, 
        itemId, 
        val, 
        user.uid, 
        user.displayName || 'Engineer'
      );
      toast({ title: isRtl ? "تم تحديث الإنجاز" : "Progress Updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setUpdatingId(null);
    }
  };

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
   * دالة العرض الجدولي الشجري المنظم (Tree Grid) لمتابعة الإنجاز
   */
  const renderExecutionTreeRows = (node: BOQTreeNode, prefix: string): React.ReactNode => {
    return (
      <React.Fragment key={node.id}>
        {/* صف القسم (Group Header) */}
        <TableRow className="bg-slate-50 hover:bg-slate-100 border-b-2 border-white">
          <TableCell className="font-mono text-[11px] font-black text-slate-400 ps-6 w-[80px]">{prefix}</TableCell>
          <TableCell className="w-[100px] font-mono text-[10px] font-bold text-slate-400">---</TableCell>
          <TableCell className="font-black text-slate-800 text-sm py-4" style={{ paddingInlineStart: `${node.depth * 20 + 16}px` }}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-orange-400" />
              {node.title}
            </div>
          </TableCell>
          <TableCell colSpan={6}></TableCell>
        </TableRow>

        {/* صفوف البنود التنفيذية لمتابعة الكميات */}
        {node.items.map((item, iIdx) => {
          const itemPrefix = `${prefix.replace('.0', '')}.${iIdx + 1}`;
          const progress = executionService?.getBOQItemProgress(item as any);
          const isOver = progress?.isOverExecuted;
          const totalPlanned = (item.plannedQuantity || 0) * (item.estimatedRate || 0);

          return (
            <TableRow key={item.id} className="hover:bg-primary/[0.02] transition-colors border-b-slate-100 group/item">
              <TableCell className="font-mono text-[10px] font-bold text-slate-300 ps-8">{itemPrefix}</TableCell>
              <TableCell className="font-mono text-[10px] font-black text-primary/60">{item.referenceCode}</TableCell>
              <TableCell className="text-xs font-bold text-slate-700" style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 16}px` }}>
                {item.referenceTitle}
              </TableCell>
              <TableCell className="text-center font-black text-[10px] text-slate-400 uppercase">{item.unitSymbol || item.unitName || '-'}</TableCell>
              <TableCell className="text-center font-mono font-black text-slate-500 text-xs">{item.plannedQuantity}</TableCell>
              <TableCell className="p-1 w-[120px]">
                <div className="relative">
                  <Input 
                    type="number" 
                    defaultValue={item.executedQuantity}
                    onBlur={(e) => handleUpdateQuantity(item.id!, Number(e.target.value))}
                    className={cn(
                      "h-8 rounded-lg border-2 font-black text-center text-xs transition-all",
                      isOver ? "border-rose-200 bg-rose-50 text-rose-600" : "bg-white"
                    )} 
                  />
                  {updatingId === item.id && <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-primary" />}
                </div>
              </TableCell>
              <TableCell className="text-center font-mono font-bold text-slate-400 text-xs">
                {item.estimatedRate?.toLocaleString()}
              </TableCell>
              <TableCell className="text-end font-mono font-black text-slate-800 text-xs">
                {totalPlanned.toLocaleString()}
              </TableCell>
              <TableCell className="pe-6 w-[120px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                    <span>{progress?.progressPercent}%</span>
                  </div>
                  <Progress value={progress?.progressPercent} className="h-1 bg-slate-100 [&>div]:bg-primary" />
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
      
      {/* Professional Header Bar */}
      <header className="flex flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-lg border">
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-2">
                 <h1 className="text-base font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1>
                 <Badge variant="outline" className="text-[8px] h-4 font-black uppercase bg-primary/5 text-primary border-primary/20">{activeBoq.status}</Badge>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                 {transaction?.clientName} | {transaction?.subServiceName}
              </p>
           </div>
        </div>
        
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="h-9 px-4 rounded-lg font-bold text-xs gap-2">
              <Printer className="h-3.5 w-3.5" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
           <Button className="h-9 px-4 rounded-lg font-black text-xs gap-2">
              <Save className="h-3.5 w-3.5" /> {isRtl ? 'حفظ' : 'Save'}
           </Button>
        </div>
      </header>

      {/* Main execution Grid */}
      <div className="flex-1 bg-white rounded-xl shadow-xl border border-primary/5 overflow-hidden flex flex-col">
         <Table>
           <TableHeader className="bg-slate-50 border-b-2">
             <TableRow>
               <TableHead className="ps-6 w-[80px]">S.No</TableHead>
               <TableHead className="w-[100px]">Code</TableHead>
               <TableHead>{isRtl ? 'بند العمل / الوصف' : 'Item Description'}</TableHead>
               <TableHead className="text-center w-[60px]">{isRtl ? 'الوحدة' : 'Unit'}</TableHead>
               <TableHead className="text-center w-[80px]">{isRtl ? 'مخطط' : 'Plan'}</TableHead>
               <TableHead className="text-center w-[120px]">{isRtl ? 'المنفذ' : 'Actual'}</TableHead>
               <TableHead className="text-center w-[100px]">{isRtl ? 'الفئة' : 'Rate'}</TableHead>
               <TableHead className="text-end w-[120px]">{isRtl ? 'الإجمالي' : 'Total'}</TableHead>
               <TableHead className="pe-6 w-[120px]">{isRtl ? 'الإنجاز' : 'Progress'}</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody className="max-h-[60vh] overflow-y-auto">
              {boqTree.map((node, idx) => renderExecutionTreeRows(node, (idx + 1).toString() + ".0"))}
           </TableBody>
         </Table>

         {/* Bottom Global Summary Bar (Odoo Style) */}
         <footer className="bg-[#1e1b4b] text-white p-6 px-10 flex flex-col md:flex-row justify-between items-center gap-8 rounded-b-xl shadow-2xl">
            <div className="flex items-center gap-12">
               <div className="text-start">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الميزانية المخططة' : 'Total Planned Budget'}</p>
                  <h3 className="text-2xl font-black font-headline">{overallStats.totalPlanned.toLocaleString()} <span className="text-xs text-white/40">KWD</span></h3>
               </div>
               <div className="text-start border-s border-white/10 ps-12">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">{isRtl ? 'القيمة المنفذة حالياً' : 'Total Executed Value'}</p>
                  <h3 className="text-2xl font-black font-headline text-emerald-400">{overallStats.totalExecuted.toLocaleString()} <span className="text-xs">KWD</span></h3>
               </div>
            </div>

            <div className="flex items-center gap-8 w-full md:w-auto bg-white/5 p-4 rounded-2xl border border-white/10">
               <div className="flex-1 md:w-48 space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase">
                     <span className="text-slate-400">{isRtl ? 'إنجاز المشروع' : 'Completion'}</span>
                     <span className="text-primary">{overallStats.progress}%</span>
                  </div>
                  <Progress value={overallStats.progress} className="h-1.5 bg-white/10 [&>div]:bg-primary shadow-inner" />
               </div>
               <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg ring-4 ring-primary/5">
                  <TrendingUp className="h-6 w-6" />
               </div>
            </div>
         </footer>
      </div>
    </div>
  );
}
