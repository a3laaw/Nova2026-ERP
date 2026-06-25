'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileSpreadsheet, ArrowRight, Loader2, Save, 
  CheckCircle2, AlertTriangle, LayoutGrid, Boxes, 
  Hammer, Calculator, TrendingUp
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

  // 1. جلب رأس المعاملة
  const transRef = useMemo(() => companyId && db ? doc(db, paths.transactions(companyId), transactionId) : null, [db, companyId, transactionId]);
  const { data: transaction } = useDoc<Transaction>(transRef);

  // 2. جلب المقايسة المرتبطة
  const boqQuery = useMemo(() => companyId && db ? query(collection(db, paths.boqs(companyId)), where('transactionId', '==', transactionId)) : null, [db, companyId, transactionId]);
  const { data: boqs, loading: boqLoading } = useCollection<BOQ>(boqQuery);
  const activeBoq = boqs?.[0];

  // 3. جلب بنود المقايسة
  const itemsQuery = useMemo(() => companyId && db && activeBoq?.id ? query(collection(db, paths.boqItems(companyId, activeBoq.id))) : null, [db, companyId, activeBoq]);
  const { data: items, loading: itemsLoading } = useCollection<BOQItem>(itemsQuery);

  // بناء شجرة المقايسة للعرض
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
      toast({ title: isRtl ? "تم تحديث الإنجاز الميداني" : "Progress Updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setUpdatingId(null);
    }
  };

  if (boqLoading || itemsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  if (!activeBoq) return (
    <div className="p-20 text-center space-y-4">
      <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300"><FileSpreadsheet className="h-10 w-10" /></div>
      <h2 className="text-xl font-black text-slate-400">{isRtl ? 'لا توجد مقايسة فعالة مرتبطة بهذه المعاملة' : 'No active BOQ linked to this transaction'}</h2>
      <Button onClick={() => router.back()} variant="outline" className="rounded-xl px-8">{isRtl ? 'رجوع' : 'Back'}</Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'تتبع إنجاز بنود الأعمال' : 'BOQ Execution Tracking'}</h1>
             <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3 text-primary" /> {activeBoq.boqNumber} | {transaction?.transactionNumber}
             </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-6 border-b-4 border-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'إجمالي البنود المنجزة' : 'Completed Items'}</p>
            <h3 className="text-3xl font-black text-slate-900">
               {items?.filter(i => (i.executedQuantity || 0) >= (i.plannedQuantity || 0)).length} / {items?.length}
            </h3>
         </Card>
      </div>

      {/* BOQ Tree Items with Progress Controls */}
      <div className="space-y-8">
        {boqTree.map((section) => (
          <div key={section.id} className="space-y-4">
             <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg"><LayoutGrid className="h-5 w-5" /></div>
                <h3 className="text-xl font-black text-slate-800">{section.title}</h3>
             </div>

             <div className="ms-6 space-y-4 pt-2 border-s-4 border-slate-50 ps-8">
                {section.items.map((item) => {
                  const progress = executionService?.getBOQItemProgress(item);
                  return (
                    <Card key={item.id} className="border-0 shadow-lg rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 group">
                       <CardContent className="p-6 flex flex-col lg:flex-row items-center justify-between gap-8">
                          <div className="flex-1 space-y-3 text-start">
                             <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-mono text-[8px] border-slate-200 text-slate-400">REF: {item.referenceCode}</Badge>
                                <h4 className="font-black text-slate-800 text-base leading-tight">{item.referenceTitle}</h4>
                             </div>
                             
                             <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                   <span>{isRtl ? 'نسبة الإنجاز الفعلي' : 'Progress Rate'}</span>
                                   <span className={cn(progress?.isOverExecuted ? "text-rose-600" : "text-primary")}>
                                      {progress?.progressPercent}%
                                   </span>
                                </div>
                                <Progress 
                                  value={progress?.progressPercent} 
                                  className={cn("h-2.5", progress?.isOverExecuted ? "bg-rose-100 [&>div]:bg-rose-500" : "")} 
                                />
                             </div>

                             <div className="flex gap-6 pt-2">
                                <div className="text-start">
                                   <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'الكمية المخططة' : 'Planned'}</p>
                                   <p className="font-black text-slate-800 text-xs">{item.plannedQuantity} <span className="text-[9px] text-slate-400 font-bold">{item.unitSymbol || item.unitName}</span></p>
                                </div>
                                <div className="text-start border-s ps-6">
                                   <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'المتبقي للتنفيذ' : 'Remaining'}</p>
                                   <p className="font-black text-primary text-xs">{progress?.remainingQuantity} <span className="text-[9px] font-bold">{item.unitSymbol || item.unitName}</span></p>
                                </div>
                             </div>
                          </div>

                          <div className="w-full lg:w-[260px] bg-slate-50 p-6 rounded-3xl border-2 border-white shadow-inner space-y-3">
                             <Label className="text-[9px] font-black uppercase text-slate-400 block">{isRtl ? 'تحديث الكمية المنجزة' : 'Update Executed Qty'}</Label>
                             <div className="relative">
                                <Input 
                                  type="number" 
                                  step="0.001"
                                  defaultValue={item.executedQuantity}
                                  onBlur={(e) => {
                                    const newVal = Number(e.target.value);
                                    if (newVal !== item.executedQuantity) {
                                       handleUpdateQuantity(item.id!, newVal);
                                    }
                                  }}
                                  className="h-14 rounded-2xl border-2 font-black text-xl text-center bg-white focus:ring-4 focus:ring-primary/10 transition-all" 
                                />
                                {updatingId === item.id && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                             </div>
                             {progress?.isOverExecuted && (
                               <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="text-[8px] font-black uppercase">{isRtl ? 'تجاوز للكمية التعاقدية' : 'Over Execution detected'}</span>
                               </div>
                             )}
                          </div>
                       </CardContent>
                    </Card>
                  );
                })}

                {/* Recursion for deeper levels */}
                {section.children.map(renderBOQTreeNodeSub)}
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Helper renderer for recursive tree
  function renderBOQTreeNodeSub(node: any) {
    return (
      <div key={node.id} className="space-y-4 mt-8">
        <div className="flex items-center gap-3 px-4">
           <Boxes className="h-4 w-4 text-slate-400" />
           <h4 className="font-black text-slate-600 text-sm">{node.title}</h4>
        </div>
        <div className="ms-4 space-y-4 border-s-2 border-slate-100 ps-6">
           {node.items.map((item: BOQItem) => {
             const progress = executionService?.getBOQItemProgress(item);
             return (
               <Card key={item.id} className="border-0 shadow-md rounded-2xl bg-white group ring-1 ring-black/[0.02]">
                  <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="flex-1 text-start space-y-2">
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-[7px] font-mono border-slate-100">REF: {item.referenceCode}</Badge>
                           <h5 className="font-bold text-slate-700 text-sm">{item.referenceTitle}</h5>
                        </div>
                        <Progress value={progress?.progressPercent} className="h-1.5" />
                        <div className="flex justify-between text-[8px] font-black text-slate-400">
                           <span>{progress?.progressPercent}% DONE</span>
                           <span>{item.plannedQuantity} {item.unitSymbol} PLANNED</span>
                        </div>
                     </div>
                     <div className="w-full md:w-[160px]">
                        <Input 
                          type="number" 
                          step="0.001"
                          defaultValue={item.executedQuantity}
                          onBlur={(e) => handleUpdateQuantity(item.id!, Number(e.target.value))}
                          className="h-10 rounded-xl border-2 font-black text-center bg-slate-50/50" 
                        />
                     </div>
                  </CardContent>
               </Card>
             );
           })}
           {node.children.map(renderBOQTreeNodeSub)}
        </div>
      </div>
    );
  }
}
