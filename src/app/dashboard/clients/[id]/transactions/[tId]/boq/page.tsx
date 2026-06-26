'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileSpreadsheet, ArrowRight, Loader2, Save, 
  CheckCircle2, AlertTriangle, LayoutGrid, Boxes, 
  Hammer, Calculator, TrendingUp, ChevronDown, ChevronRight,
  Printer, MoreVertical, Search, Filter
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
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

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

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
      
      {/* 1. Minimal Header (Nova x Odoo Style) */}
      <header className="flex flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-primary/10">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 rounded-lg border">
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-2">
                 <h1 className="text-lg font-black text-slate-900 leading-none">{activeBoq.boqNumber}</h1>
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
              <Save className="h-3.5 w-3.5" /> {isRtl ? 'حفظ المسودة' : 'Save Draft'}
           </Button>
        </div>
      </header>

      {/* 2. Main Tree Grid Container */}
      <div className="flex-1 bg-white rounded-xl shadow-xl border border-primary/5 overflow-hidden flex flex-col">
         {/* Table Header */}
         <div className="grid grid-cols-12 bg-slate-50 border-b p-3 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-start">
            <div className="col-span-1">#</div>
            <div className="col-span-4">{isRtl ? 'بند العمل / الوصف' : 'Work Item / Title'}</div>
            <div className="col-span-1 text-center">{isRtl ? 'الوحدة' : 'Unit'}</div>
            <div className="col-span-1 text-center">{isRtl ? 'مخطط' : 'Planned'}</div>
            <div className="col-span-2 text-center">{isRtl ? 'منجز فعلي' : 'Executed'}</div>
            <div className="col-span-1 text-end">{isRtl ? 'الفئة' : 'Rate'}</div>
            <div className="col-span-2 text-end pe-4">{isRtl ? 'إجمالي (مخطط)' : 'Total'}</div>
         </div>

         {/* Scrollable Tree Content */}
         <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide p-2 space-y-1">
            {boqTree.map((node, idx) => renderRowRecursive(node, (idx + 1).toString()))}
         </div>

         {/* 3. Bottom Summary Bar (Odoo Logic) */}
         <footer className="bg-slate-900 text-white p-5 px-8 flex flex-col md:flex-row justify-between items-center gap-6 rounded-b-xl shadow-2xl">
            <div className="flex items-center gap-10">
               <div className="text-start">
                  <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'إجمالي الميزانية المخططة' : 'Total Planned Budget'}</p>
                  <h3 className="text-2xl font-black font-headline">{overallStats.totalPlanned.toLocaleString()} <span className="text-xs text-white/40">KWD</span></h3>
               </div>
               <div className="text-start border-s border-white/10 ps-10">
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">{isRtl ? 'القيمة المنفذة حالياً' : 'Total Executed Value'}</p>
                  <h3 className="text-2xl font-black font-headline text-emerald-400">{overallStats.totalExecuted.toLocaleString()} <span className="text-xs">KWD</span></h3>
               </div>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto">
               <div className="flex-1 md:w-48 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                     <span>{isRtl ? 'إنجاز المشروع' : 'Project Progress'}</span>
                     <span>{overallStats.progress}%</span>
                  </div>
                  <Progress value={overallStats.progress} className="h-1.5 bg-white/10 [&>div]:bg-primary" />
               </div>
               <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                  <TrendingUp className="h-6 w-6" />
               </div>
            </div>
         </footer>
      </div>
    </div>
  );

  // Recursive Renderer for Odoo-style Tree
  function renderRowRecursive(node: any, prefix: string) {
    const isExpanded = expandedNodes[node.id] !== false; // Default to true if not set
    const hasChildren = node.children.length > 0 || node.items.length > 0;

    return (
      <div key={node.id} className="space-y-1">
        {/* Parent Group Row */}
        <div 
          className={cn(
            "grid grid-cols-12 p-2.5 rounded-lg transition-all border border-transparent",
            "bg-slate-50/80 hover:bg-slate-100 group cursor-pointer"
          )}
          onClick={() => toggleNode(node.id)}
        >
          <div className="col-span-1 font-mono text-[10px] font-black text-slate-400 ps-4">
             {prefix}
          </div>
          <div className="col-span-4 flex items-center gap-2">
             <div className="text-primary/40 group-hover:text-primary transition-colors">
                {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />) : <div className="w-4" />}
             </div>
             <span className="text-xs font-black text-slate-700 truncate">{node.title}</span>
          </div>
          <div className="col-span-7" />
        </div>

        {/* Children (Sub-nodes and Items) */}
        {isExpanded && (
          <div className="space-y-1">
             {/* Render Nested Children */}
             {node.children.map((child: any, cIdx: number) => renderRowRecursive(child, `${prefix}.${cIdx + 1}`))}

             {/* Render Final Work Items */}
             {node.items.map((item: BOQItem, iIdx: number) => {
               const itemPrefix = `${prefix}.${iIdx + 1}`;
               const progress = executionService?.getBOQItemProgress(item);
               const isOver = progress?.isOverExecuted;

               return (
                 <div key={item.id} className="grid grid-cols-12 p-2 px-3 rounded-lg bg-white border border-slate-100 hover:border-primary/20 hover:shadow-sm transition-all group items-center">
                    <div className="col-span-1 font-mono text-[9px] font-bold text-slate-300 ps-6">
                       {itemPrefix}
                    </div>
                    <div className="col-span-4 flex flex-col text-start">
                       <span className="text-xs font-bold text-slate-800 leading-tight">{item.referenceTitle}</span>
                       <span className="text-[8px] font-mono text-slate-400 mt-0.5 tracking-tighter">REF: {item.referenceCode}</span>
                    </div>
                    <div className="col-span-1 text-center font-black text-[10px] text-slate-400 uppercase">
                       {item.unitSymbol || item.unitName}
                    </div>
                    <div className="col-span-1 text-center font-mono font-black text-slate-500 text-xs">
                       {item.plannedQuantity}
                    </div>
                    <div className="col-span-2 px-4">
                       <div className="relative">
                          <Input 
                            type="number" 
                            defaultValue={item.executedQuantity}
                            onBlur={(e) => handleUpdateQuantity(item.id!, Number(e.target.value))}
                            className={cn(
                              "h-8 rounded-lg border-2 font-black text-center text-xs transition-all",
                              isOver ? "border-rose-200 bg-rose-50 text-rose-600" : "bg-slate-50/50"
                            )} 
                          />
                          {updatingId === item.id && <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-primary" />}
                          {isOver && <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-rose-500 shadow-sm" />}
                       </div>
                    </div>
                    <div className="col-span-1 text-end font-mono font-bold text-slate-400 text-[10px]">
                       {item.estimatedRate?.toLocaleString()}
                    </div>
                    <div className="col-span-2 text-end pe-4">
                       <div className="flex flex-col items-end">
                          <span className="font-mono font-black text-slate-800 text-xs">
                             {((item.plannedQuantity || 0) * (item.estimatedRate || 0)).toLocaleString()}
                          </span>
                          <div className="w-16 mt-1">
                             <Progress value={progress?.progressPercent} className="h-0.5 bg-slate-100" />
                          </div>
                       </div>
                    </div>
                 </div>
               );
             })}
          </div>
        )}
      </div>
    );
  }
}
