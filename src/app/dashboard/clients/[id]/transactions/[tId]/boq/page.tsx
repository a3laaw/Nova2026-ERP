'use client';

import { useState, useMemo, useEffect } from 'react';
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

  if (boqLoading || itemsLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  if (!activeBoq) return (
    <div className="p-20 text-center space-y-4">
      <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300"><FileSpreadsheet className="h-10 w-10" /></div>
      <h2 className="text-xl font-black text-slate-400">{isRtl ? 'لا توجد مقايسة مرتبطة بهذه المعاملة' : 'No BOQ linked to this transaction'}</h2>
      <Button onClick={() => router.back()} variant="outline">{isRtl ? 'رجوع' : 'Back'}</Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">{isRtl ? 'تتبع إنجاز المقايسة' : 'BOQ Execution Tracking'}</h1>
             <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3 text-primary" /> {activeBoq.boqNumber} | {transaction?.transactionNumber}
             </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {boqTree.map((section) => (
          <div key={section.id} className="space-y-4">
             <div className="flex items-center gap-4 bg-slate-900 text-white p-5 rounded-3xl shadow-xl">
                <LayoutGrid className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-black font-headline">{section.name}</h3>
             </div>

             <div className="ms-6 space-y-8 border-s-4 border-slate-100 ps-8 pt-4">
                {section.children.map((category) => (
                  <div key={category.id} className="space-y-4">
                     <div className="flex items-center gap-3 text-primary font-black uppercase text-xs tracking-widest">
                        <Boxes className="h-4 w-4" />
                        {category.name}
                     </div>

                     <div className="grid grid-cols-1 gap-4">
                        {category.children.map((comp) => (
                          <div key={comp.id} className="space-y-4">
                             {comp.children.map((item: any) => {
                               const progress = executionService?.getBOQItemProgress(item as BOQItem);
                               return (
                                 <Card key={item.id} className="border-0 shadow-lg rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 group">
                                    <CardContent className="p-6 flex flex-col lg:flex-row items-center justify-between gap-8">
                                       <div className="flex-1 space-y-2 w-full text-start">
                                          <div className="flex items-center gap-3">
                                             <Badge variant="outline" className="font-mono text-[8px] border-slate-200 text-slate-400">#{item.itemCode}</Badge>
                                             <h4 className="font-black text-slate-800 text-base leading-tight">{item.description}</h4>
                                          </div>
                                          <div className="flex items-center gap-4">
                                             <div className="flex-1">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                                                   <span>{isRtl ? 'نسبة الإنجاز' : 'Progress'}</span>
                                                   <span className={cn(progress?.isOverExecuted ? "text-rose-600" : "text-primary")}>{progress?.progressPercent}%</span>
                                                </div>
                                                <Progress value={progress?.progressPercent} className={cn("h-2", progress?.isOverExecuted ? "bg-rose-100 [&>div]:bg-rose-500" : "")} />
                                             </div>
                                             <div className="text-center px-4 border-s-2">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'المخطط' : 'Planned'}</p>
                                                <p className="font-black text-slate-800">{item.plannedQuantity} <span className="text-[8px]">{item.unit}</span></p>
                                             </div>
                                          </div>
                                       </div>

                                       <div className="w-full lg:w-[280px] bg-slate-50 p-5 rounded-3xl border-2 border-white shadow-inner flex flex-col gap-4">
                                          <div className="space-y-1.5">
                                             <Label className="text-[9px] font-black uppercase text-slate-400 block">{isRtl ? 'الكمية المنفذة فعلياً' : 'Actual Executed Qty'}</Label>
                                             <div className="relative">
                                                <Input 
                                                   type="number" 
                                                   step="0.01"
                                                   defaultValue={item.executedQuantity}
                                                   onBlur={(e) => {
                                                      const newVal = Number(e.target.value);
                                                      if (newVal !== item.executedQuantity) {
                                                         handleUpdateQuantity(item.id, newVal);
                                                      }
                                                   }}
                                                   className="h-12 rounded-xl border-2 font-black text-lg text-center bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                                />
                                                {updatingId === item.id && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                                             </div>
                                          </div>
                                          <div className="flex justify-between items-center px-2">
                                             <span className="text-[9px] font-bold text-slate-400 uppercase">{isRtl ? 'المتبقي للتنفيذ' : 'Remaining'}</span>
                                             <span className="font-black text-xs text-primary">{progress?.remainingQuantity} {item.unit}</span>
                                          </div>
                                       </div>
                                    </CardContent>
                                 </Card>
                               );
                             })}
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
