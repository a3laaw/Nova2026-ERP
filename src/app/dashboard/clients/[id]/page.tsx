'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit3, MapPin, Phone, 
  History, Loader2, Activity, PlayCircle, 
  Compass, Map as MapIcon, Target, Layers,
  Trash2, AlertTriangle, ArrowRight
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { Transaction } from '@/types/transaction';
import { TransactionService } from '@/services/transaction-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import dynamic from 'next/dynamic';

// تحميل الخريطة بشكل ديناميكي مع تعطيل SSR لمنع أخطاء الـ Chunks
const StaticMapView = dynamic(() => import('@/components/clients/static-map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-50">
      <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
    </div>
  )
});

export default function ClientDetailsPage() {
  const clientId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { lang, dir, t: translate } = useLanguage();
  const { check, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clientRef = useMemo(() => companyId && db ? doc(db, paths.clients(companyId), clientId) : null, [db, companyId, clientId]);
  const historyQuery = useMemo(() => companyId && db ? query(collection(db, paths.clientHistory(companyId, clientId))) : null, [db, companyId, clientId]);
  const transQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactions(companyId)), where('clientId', '==', clientId)) : null, [db, companyId, clientId]);

  const { data: client, loading: cLoading } = useDoc<Client>(clientRef);
  const { data: history } = useCollection<ClientHistory>(historyQuery);
  const { data: transactions } = useCollection<Transaction>(transQuery);

  const coordinates = useMemo(() => {
    if (!client?.locationUrl) return null;
    const match = client.locationUrl.match(/q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/) || client.locationUrl.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
    return match ? [parseFloat(match[1]), parseFloat(match[2])] as [number, number] : null;
  }, [client?.locationUrl]);

  const handleDeleteTransaction = async () => {
    if (!db || !companyId || !deletingId) return;
    setIsDeleting(true);
    try {
      const service = new TransactionService(db, companyId, ['projects:delete']); 
      await service.deleteTransaction(deletingId);
      toast({ title: isRtl ? "تم حذف المعاملة" : "Transaction Deleted" });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: translate('error'), description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (cLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!client) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="text-start">
             <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-xs border border-primary/10 w-fit min-w-fit">
                   {client.fileNumber}
                </div>
                <h1 className="text-lg font-black font-headline text-slate-900">{client.nameAr}</h1>
                <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5">{client.status}</Badge>
             </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} variant="outline" className="h-9 px-4 rounded-lg font-bold text-[10px] gap-2">
             <Edit3 className="h-3.5 w-3.5" /> {isRtl ? 'تعديل' : 'Edit'}
           </Button>
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`)} className="h-9 px-4 rounded-lg bg-primary text-white font-black text-[10px] gap-2 shadow-lg shadow-primary/10">
             <Activity className="h-3.5 w-3.5" /> {isRtl ? 'فتح معاملة' : 'New Trans'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-4 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-primary" />
                    <CardTitle className="text-xs font-black uppercase tracking-widest">{isRtl ? 'المعاملات الفنية' : 'Technical Transactions'}</CardTitle>
                 </div>
                 <Badge className="bg-slate-900 text-white font-black rounded-full h-5 px-2.5 flex items-center justify-center text-[9px]">
                    {transactions?.length || 0}
                 </Badge>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                 {transactions?.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group">
                       <div className="flex items-center gap-3 flex-1" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${t.id}`)}>
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shadow-sm", t.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                             <PlayCircle className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{t.transactionNumber}</p>
                             <h4 className="font-black text-[12px] text-slate-800 leading-tight">{t.subServiceName}</h4>
                             <p className="text-[9px] font-bold text-primary mt-0.5">{t.activityTypeName}</p>
                          </div>
                       </div>
                       
                       <div className="flex gap-2">
                          {isAdmin && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                               onClick={(e) => { e.stopPropagation(); setDeletingId(t.id); }}
                             >
                                <Trash2 className="h-4 w-4" />
                             </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg"
                            onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${t.id}`)}
                          >
                             <ArrowRight className={cn("h-4 w-4 text-slate-300", isRtl && "rotate-180")} />
                          </Button>
                       </div>
                    </div>
                 ))}
                 {!transactions?.length && <div className="py-12 text-center text-[10px] text-slate-300 font-bold italic">لا يوجد معاملات مسجلة.</div>}
              </CardContent>
           </Card>
           
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <div className="grid grid-cols-1 md:grid-cols-2">
                 <div className="p-5 space-y-4 text-start border-e border-slate-50">
                    <div className="flex items-center gap-2 mb-2"><Compass className="h-4 w-4 text-blue-600" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isRtl ? 'الرادار الجغرافي' : 'Location Radar'}</h3></div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-white shadow-inner"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">العنوان</p><p className="text-xs font-black text-slate-800">{client.governorateName} / {client.areaName}</p></div>
                    <div className="grid grid-cols-3 gap-2">{[{l:'B', v:client.block},{l:'S',v:client.street},{l:'P',v:client.houseNumber}].map((x,i)=>(<div key={i} className="p-2 rounded-lg bg-white border border-slate-100 text-center"><span className="text-[8px] text-slate-400 block font-bold">{x.l}</span><span className="text-[11px] font-black text-slate-800">{x.v||'-'}</span></div>))}</div>
                 </div>
                 <div className="p-5 bg-slate-50/50 flex items-center justify-center">
                    <div onClick={() => client.locationUrl && window.open(client.locationUrl, '_blank')} className={cn("relative h-32 w-full rounded-[2.5rem] overflow-hidden shadow-lg border-2 z-0", coordinates ? "bg-white border-blue-500/10 cursor-pointer hover:ring-4 hover:ring-blue-500/5 transition-all" : "bg-white/50 border-dashed border-slate-200")}>
                       {coordinates ? (
                          <StaticMapView position={coordinates} />
                       ) : <div className="h-full flex items-center justify-center text-slate-200"><MapIcon className="h-8 w-8" /></div>}
                    </div>
                 </div>
              </div>
           </Card>
        </div>

        <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden flex flex-col min-h-[400px]">
           <CardHeader className="bg-slate-50/50 border-b p-4 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isRtl ? 'سجل الأحداث' : 'History Log'}</CardTitle>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] scrollbar-hide text-start">
              <div className="relative p-5">
                 <div className={cn("absolute top-0 bottom-0 w-[1px] bg-slate-100", isRtl ? "right-8" : "left-8")} />
                 <div className="space-y-5">
                    {history?.sort((a,b)=>b.createdAt?.toMillis()-a.createdAt?.toMillis()).map((e)=>(
                       <div key={e.id} className="relative ps-8">
                          <div className={cn("absolute top-1 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm z-10", e.type === 'status_change' ? "bg-blue-500" : "bg-amber-500", isRtl ? "right-0" : "left-0")} />
                          <div className="space-y-0.5">
                             <div className="flex justify-between items-center"><span className="text-[7px] font-black text-slate-400 uppercase">{e.type}</span><span className="text-[7px] font-mono text-slate-300 font-bold">{e.createdAt?.toDate().toLocaleDateString()}</span></div>
                             <p className="text-[11px] font-bold text-slate-700 leading-tight">{e.content}</p>
                             <p className="text-[7px] text-primary uppercase font-black">{e.userName}</p>
                          </div>
                       </div>
                    ))}
                    {!history?.length && <div className="py-20 text-center text-[10px] text-slate-300 font-bold italic">لا يوجد أحداث.</div>}
                 </div>
              </div>
           </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-0 shadow-3xl bg-white z-[100]" dir={dir}>
          <AlertDialogHeader>
             <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="h-10 w-10" />
             </div>
             <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">{translate('confirmDelete')}</AlertDialogTitle>
             <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                {isRtl 
                  ? 'هل أنت متأكد؟ سيتم حذف هذه المعاملة وكافة مراحل التنفيذ وسجلات الإنجاز الميداني المرتبطة بها نهائياً. لا يمكن التراجع عن هذا الإجراء.' 
                  : 'Are you sure? This technical transaction and all its associated field logs and execution stages will be permanently deleted.'}
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4 flex flex-row items-center justify-center">
            <AlertDialogCancel className="flex-1 h-16 rounded-2xl font-bold border-2 bg-white text-slate-600">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTransaction} 
              disabled={isDeleting}
              className="flex-[2] h-16 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
            >
               {isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : (isRtl ? 'نعم، احذف المعاملة' : 'Confirm Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
