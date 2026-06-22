'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Edit3, MapPin, Phone, 
  History, Loader2, AlertCircle,
  HardHat, Activity, Plus,
  MessageSquare, Globe,
  Navigation, Map as MapIcon, Compass,
  Layers, CheckCircle2, PlayCircle, Target
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ClientService } from '@/services/client-service';
import { toast } from '@/hooks/use-toast';

import dynamic from 'next/dynamic';
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [interaction, setInteraction] = useState('');
  const [logging, setLogging] = useState(false);

  const clientRef = useMemo(() => companyId && db ? doc(db, paths.clients(companyId), clientId) : null, [db, companyId, clientId]);
  const historyQuery = useMemo(() => companyId && db ? query(collection(db, paths.clientHistory(companyId, clientId))) : null, [db, companyId, clientId]);
  const transactionsQuery = useMemo(() => companyId && db ? query(collection(db, paths.transactions(companyId)), where('clientId', '==', clientId)) : null, [db, companyId, clientId]);

  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);
  const { data: rawHistory, loading: historyLoading } = useCollection<ClientHistory>(historyQuery);
  const { data: rawTransactions, loading: transLoading } = useCollection<Transaction>(transactionsQuery);

  const transactions = useMemo(() => [...rawTransactions].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)), [rawTransactions]);
  const history = useMemo(() => [...rawHistory].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)), [rawHistory]);

  const coordinates = useMemo(() => {
    if (!client?.locationUrl) return null;
    try {
      const match = client.locationUrl.match(/q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/) || client.locationUrl.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
      if (match) return [parseFloat(match[1]), parseFloat(match[2])] as [number, number];
    } catch (e) {}
    return null;
  }, [client?.locationUrl]);

  const handleLogVisit = async () => {
    if (!db || !companyId || !user || !interaction.trim()) return;
    setLogging(true);
    try {
      const service = new ClientService(db, companyId);
      await service.logInteraction(clientId, interaction, user.uid, user.displayName || 'User');
      setInteraction('');
      toast({ title: isRtl ? "تم التوثيق" : "Logged" });
    } finally {
      setLogging(false);
    }
  };

  if (clientLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!client) return <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 text-slate-300"><AlertCircle className="h-12 w-12" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20" dir={dir}>
      {/* Small Compact Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="h-10 w-10 p-0 rounded-xl bg-white shadow-sm border border-slate-200">
            <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-3">
                <div className="px-3 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-sm border border-primary/10">
                   {client.fileNumber}
                </div>
                <h1 className="text-xl font-black font-headline text-slate-900">{client.nameAr}</h1>
                <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5">{client.status}</Badge>
             </div>
          </div>
        </div>

        <div className="flex gap-2">
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} variant="outline" size="sm" className="h-9 px-4 rounded-lg font-bold text-xs gap-2">
              <Edit3 className="h-3.5 w-3.5" /> {isRtl ? 'تعديل' : 'Edit'}
           </Button>
           <Button 
             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`)}
             size="sm"
             className="h-9 px-4 rounded-lg bg-primary text-white font-black text-xs gap-2 shadow-lg shadow-primary/10"
           >
              <Activity className="h-3.5 w-3.5" /> {isRtl ? 'فتح معاملة' : 'New Trans'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           
           {/* Transactions Card - More Compact */}
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-4 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-black">{isRtl ? 'المعاملات الفنية' : 'Transactions'}</CardTitle>
                 </div>
                 <Badge className="bg-slate-900 text-white font-black rounded-full h-6 px-3 flex items-center justify-center text-[10px]">{transactions?.length || 0}</Badge>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                 {transactions?.map((trans) => (
                    <div 
                      key={trans.id} 
                      onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${trans.id}`)}
                      className="p-4 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group"
                    >
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shadow-sm",
                            trans.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                          )}>
                             <PlayCircle className="h-5 w-5" />
                          </div>
                          <div className="text-start">
                             <p className="text-[8px] font-black text-slate-400 uppercase">{trans.transactionNumber}</p>
                             <h4 className="font-black text-sm text-slate-800">{trans.subServiceName}</h4>
                          </div>
                       </div>
                       <ArrowRight className={cn("h-4 w-4 text-slate-300 group-hover:text-primary transition-all", isRtl && "rotate-180")} />
                    </div>
                 ))}
              </CardContent>
           </Card>
           
           {/* Radar Card - More Compact */}
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <div className="grid grid-cols-1 md:grid-cols-2">
                 <div className="p-6 space-y-6 text-start border-e border-slate-50">
                    <div className="flex items-center gap-2 mb-4">
                       <Compass className="h-4 w-4 text-blue-600" />
                       <h3 className="text-sm font-black uppercase tracking-tight">{isRtl ? 'الرادار الجغرافي' : 'Location Radar'}</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-white shadow-inner">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'العنوان' : 'Address'}</p>
                       <p className="text-sm font-black text-slate-800">{client.governorateName} / {client.areaName}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       {[{ l: 'B', v: client.block }, { l: 'S', v: client.street }, { l: 'P', v: client.houseNumber }].map((x, i) => (
                         <div key={i} className="p-2 rounded-lg bg-white border border-slate-100 text-center">
                            <span className="text-[8px] text-slate-400 block">{x.l}</span>
                            <span className="text-xs font-black">{x.v || '-'}</span>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="p-6 bg-slate-50/50 flex items-center justify-center">
                    <div className={cn(
                       "relative h-40 w-full rounded-[2rem] overflow-hidden shadow-xl border-2",
                       coordinates ? "bg-white border-blue-500/10 cursor-pointer" : "bg-white/50 border-dashed border-slate-200"
                    )}>
                       {coordinates ? (
                          <a href={client.locationUrl} target="_blank" rel="noopener noreferrer" className="h-full w-full block">
                             <MapContainer center={coordinates} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={coordinates} />
                             </MapContainer>
                             <div className="absolute bottom-2 left-0 right-0 px-2">
                                <Badge className="w-full bg-blue-600 text-white font-black text-[7px] uppercase h-4 border-0">GPS LOCKED</Badge>
                             </div>
                          </a>
                       ) : <div className="h-full flex items-center justify-center text-slate-200"><MapIcon className="h-8 w-8" /></div>}
                    </div>
                 </div>
              </div>
           </Card>

           <Card className="border-0 shadow-lg rounded-2xl bg-white p-6 text-start">
              <div className="flex items-center gap-2 mb-4">
                 <MessageSquare className="h-4 w-4 text-amber-600" />
                 <h3 className="text-sm font-black uppercase tracking-tight">{isRtl ? 'توثيق متابعة' : 'Log Visit'}</h3>
              </div>
              <Textarea 
                value={interaction} 
                onChange={e => setInteraction(e.target.value)}
                className="min-h-[80px] rounded-xl border-slate-200 text-sm p-4 focus:bg-slate-50 transition-all resize-none mb-3"
                placeholder={isRtl ? "اكتب تفاصيل الزيارة هنا..." : "Log details..."}
              />
              <div className="flex justify-end">
                 <Button onClick={handleLogVisit} disabled={logging || !interaction.trim()} size="sm" className="rounded-lg h-9 px-6 bg-slate-900 text-white font-bold text-xs">
                    {isRtl ? 'حفظ التوثيق' : 'Log Visit'}
                 </Button>
              </div>
           </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden flex flex-col h-full min-h-[500px]">
              <CardHeader className="bg-slate-50/50 border-b p-4">
                 <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-black">{isRtl ? 'سجل العمليات' : 'History Log'}</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide text-start">
                 <div className="relative p-6">
                    <div className={cn("absolute top-0 bottom-0 w-[1px] bg-slate-100", isRtl ? "right-9" : "left-9")} />
                    <div className="space-y-6">
                       {history?.map((event) => (
                          <div key={event.id} className="relative ps-10">
                             <div className={cn(
                               "absolute top-1 h-3 w-3 rounded-full border-2 border-white shadow-sm z-10",
                               event.type === 'status_change' ? "bg-blue-500" : "bg-amber-500",
                               isRtl ? "right-1" : "left-1"
                             )} />
                             <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                   <span className="text-[8px] font-black text-slate-400 uppercase">{event.type}</span>
                                   <span className="text-[8px] font-mono text-slate-300">{event.createdAt?.toDate().toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-700 leading-tight">{event.content}</p>
                                <p className="text-[8px] text-primary uppercase font-black">{event.userName}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
