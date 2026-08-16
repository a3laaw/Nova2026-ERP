'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit3, Phone, 
  History, Loader2, PlayCircle, 
  Compass, Map as MapIcon, Layers,
  ArrowRight, Receipt, Trash2, AlertTriangle
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
import { ClientService } from '@/services/client-service';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
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

const StaticMapView = dynamic(() => import('@/components/clients/static-map-view'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-50">
      <Loader2 className="h-4 w-4 animate-spin text-primary/30" />
    </div>
  )
});

export default function ClientDetailsPage() {
  const clientId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { check, isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [deletingTransId, setDeletingTransId] = useState<string | null>(null);
  const [isDeletingTrans, setIsDeletingTrans] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [clientDeleteDialogOpen, setClientDeleteDialogOpen] = useState(false);

  const canEditClient = check('crm', 'edit').can;
  const canOpenTransaction = check('projects', 'create').can;
  const canDeleteClient = isAdmin;

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
    if (!db || !companyId || !deletingTransId) return;
    setIsDeletingTrans(true);
    try {
      const service = new TransactionService(db, companyId, permissions);
      await service.deleteTransaction(deletingTransId);
      toast({ title: t('common.deleted') });
      setDeletingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setIsDeletingTrans(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!db || !companyId || !clientId) return;
    setIsDeletingClient(true);
    try {
      const service = new ClientService(db, companyId);
      await service.deleteClient(clientId);
      toast({ title: t('common.deleted') });
      router.push('/dashboard/clients');
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setIsDeletingClient(false);
    }
  };

  if (cLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!client) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-4 w-full px-4 md:px-6 animate-in fade-in max-w-[1600px] mx-auto" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-100 text-start">
        <div className="flex items-center gap-3">
          <div className="text-start">
             <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 h-6 px-2 font-bold text-[10px]">
                   {client.fileNumber}
                </Badge>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">{client.nameAr}</h1>
                <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 h-5 rounded-md border-slate-200">{t('status.' + client.status)}</Badge>
             </div>
          </div>
        </div>
        
        <div className="flex gap-2">
           {canDeleteClient && (
              <Button onClick={() => setClientDeleteDialogOpen(true)} variant="ghost" size="sm" className="h-9 px-4 rounded-md font-bold text-xs gap-2 text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
              </Button>
           )}
           {canEditClient && (
             <Button onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} variant="outline" size="sm" className="h-9 px-4 rounded-md font-bold text-xs gap-2 border-2">
               <Edit3 className="h-3.5 w-3.5" /> {t('common.edit')}
             </Button>
           )}
           {canOpenTransaction && (
             <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`) } size="sm" className="h-9 px-4 rounded-md font-bold text-xs gap-2 shadow-sm">
               <Layers className="h-3.5 w-3.5" /> {t('clients.newTransaction')}
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b p-4 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <CardTitle className="text-xs font-bold uppercase text-slate-500">{t('clients.details.transactions')}</CardTitle>
                 </div>
                 <Badge className="bg-slate-800 text-white font-bold h-5 px-2 text-[10px] rounded-md">
                    {transactions?.length || 0}
                 </Badge>
              </CardHeader>
              <CardContent className="p-0">
                 {transactions?.map((t_row) => (
                    <div key={t_row.id} className="p-3 border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer flex items-center justify-between group gap-4">
                       <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${t_row.id}`)}>
                          <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0 shadow-sm", t_row.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                             <PlayCircle className="h-4 w-4" />
                          </div>
                          <div className="text-start truncate">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">#{t_row.transactionNumber}</p>
                             <h4 className="font-bold text-sm text-slate-800 leading-tight truncate">{t_row.subServiceName}</h4>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2 shrink-0">
                          <Button 
                             variant="ghost" 
                             size="sm" 
                             className="h-8 px-2 rounded-md text-[10px] font-bold gap-1.5 text-blue-600 hover:bg-blue-50"
                             onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/clients/${clientId}/transactions/${t_row.id}?tab=documents`); }}
                          >
                             <Receipt className="h-3.5 w-3.5" />
                             {tSafe('inline.finance', 'المالية', 'Finance')}
                          </Button>
                          {isAdmin && (
                            <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                               onClick={(e) => { e.stopPropagation(); setDeletingTransId(t_row.id); }}
                            >
                               <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 rounded-md text-slate-300 hover:text-primary"
                             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${t_row.id}`)}
                          >
                             <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                          </Button>
                       </div>
                    </div>
                 ))}
                 {!transactions?.length && <div className="py-10 text-center text-xs text-slate-300 italic">{t('common.noResults')}</div>}
              </CardContent>
           </Card>
           
           <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden text-start">
              <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                 <div className="p-4 space-y-3 text-start border-e border-slate-50">
                    <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-blue-600" /><h3 className="text-[10px] font-bold uppercase text-slate-500">{t('clients.details.location')}</h3></div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100"><p className="text-sm font-bold text-slate-800">{client.governorateName} / {client.areaName}</p></div>
                    <div className="grid grid-cols-3 gap-2">
                       <div className="p-2 rounded-md bg-white border border-slate-100 text-center"><span className="text-[8px] text-slate-400 block font-bold uppercase">B</span><span className="text-xs font-bold text-slate-800">{client.block || '-'}</span></div>
                       <div className="p-2 rounded-md bg-white border border-slate-100 text-center"><span className="text-[8px] text-slate-400 block font-bold uppercase">S</span><span className="text-xs font-bold text-slate-800">{client.street || '-'}</span></div>
                       <div className="p-2 rounded-md bg-white border border-slate-100 text-center"><span className="text-[8px] text-slate-400 block font-bold uppercase">P</span><span className="text-xs font-bold text-slate-800">{client.houseNumber || '-'}</span></div>
                    </div>
                 </div>
                 <div className="p-0 bg-slate-50/30 flex items-center justify-center min-h-[160px]">
                    <div onClick={() => client.locationUrl && window.open(client.locationUrl, '_blank')} className={cn("relative h-full w-full rounded-none overflow-hidden z-0", coordinates ? "cursor-pointer" : "bg-white/50 border-dashed")}>
                       {coordinates ? <StaticMapView position={coordinates} /> : <div className="h-full flex items-center justify-center text-slate-200"><MapIcon className="h-6 w-6" /></div>}
                    </div>
                 </div>
              </div>
           </Card>
        </div>

        <Card className="rounded-lg shadow-sm border-slate-100 bg-white overflow-hidden flex flex-col min-h-[400px]">
           <CardHeader className="bg-slate-50/50 border-b p-4 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-bold uppercase text-slate-500">{t('clients.details.history')}</CardTitle>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-y-auto scrollbar-hide text-start">
              <div className="relative p-4">
                 <div className={cn("absolute top-0 bottom-0 w-[1px] bg-slate-100", isRtl ? "right-6" : "left-6")} />
                 <div className="space-y-4">
                    {history?.sort((a,b)=> (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).map((e)=>(
                       <div key={e.id} className="relative ps-6">
                          <div className={cn("absolute top-1 h-2 w-2 rounded-full border border-white z-10 start-[-4px]", e.type === 'status_change' ? "bg-blue-500" : e.type === 'system_log' ? "bg-primary" : "bg-amber-500")} />
                          <div className="space-y-0.5">
                             <div className="flex justify-between items-center"><span className="text-[8px] font-bold text-slate-400 uppercase">{e.type}</span><span className="text-[8px] font-mono text-slate-300">{e.createdAt?.toDate().toLocaleDateString()}</span></div>
                             <p className="text-[11px] font-medium text-slate-700 leading-tight">{e.content}</p>
                             <p className="text-[8px] text-primary font-bold uppercase">{e.userName}</p>
                          </div>
                       </div>
                    ))}
                    {!history?.length && <div className="py-20 text-center opacity-30 italic text-xs">{t('common.noResults')}</div>}
                 </div>
              </div>
           </CardContent>
        </Card>
      </div>

      {/* حوار حذف المعاملة */}
      <AlertDialog open={!!deletingTransId} onOpenChange={(v) => !v && setDeletingId(null)}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <Trash2 className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">
                 {tSafe('inline.confirm.delete.transaction', 'تأكيد حذف المعاملة', 'Confirm Delete Transaction')}
               </AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {tSafe('inline.delete.transaction.desc', 'هل أنت متأكد؟ سيتم حذف المعاملة الفنية نهائياً من سجل العميل. لا يمكن التراجع عن هذا الإجراء.', 'Are you sure? This technical transaction will be permanently removed from the client record. This action cannot be undone.')}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white">{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction 
                 onClick={handleDeleteTransaction} 
                 disabled={isDeletingTrans}
                 className="flex-[2] h-14 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
               >
                  {isDeletingTrans ? <Loader2 className="animate-spin h-5 w-5" /> : t('common.delete')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

      {/* حوار حذف العميل */}
      <AlertDialog open={clientDeleteDialogOpen} onOpenChange={setClientDeleteDialogOpen}>
         <AlertDialogContent className="rounded-xl p-10 border-0 shadow-3xl bg-white" dir={dir}>
            <AlertDialogHeader>
               <div className="mx-auto w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <AlertTriangle className="h-10 w-10" />
               </div>
               <AlertDialogTitle className="text-start font-black text-3xl font-headline text-slate-900 leading-tight">
                 {tSafe('inline.confirm.delete.client', 'تأكيد حذف ملف العميل', 'Confirm Delete Client')}
               </AlertDialogTitle>
               <AlertDialogDescription className="text-start font-bold text-slate-400 mt-4 text-lg leading-relaxed">
                  {tSafe('inline.delete.client.desc', 'هل أنت متأكد؟ سيتم حذف العميل نهائياً من النظام. هذا الإجراء سيؤدي لفقدان تتبع كافة السجلات المرتبطة بهذا الملف.', 'Are you sure? This will permanently delete the client and all associated tracking data.')}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-12 gap-4 flex flex-row">
               <AlertDialogCancel className="flex-1 h-14 rounded-2xl font-bold border-2 bg-white">{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction 
                 onClick={handleDeleteClient} 
                 disabled={isDeletingClient}
                 className="flex-[2] h-14 rounded-2xl font-black bg-rose-600 text-white shadow-xl shadow-rose-200"
               >
                  {isDeletingClient ? <Loader2 className="animate-spin h-5 w-5" /> : t('common.delete')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
