'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Edit3, MapPin, Phone, History, Loader2, Activity, PlayCircle, Compass, Map as MapIcon, Target, Layers } from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';

import dynamic from 'next/dynamic';
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

export default function ClientDetailsPage() {
  const clientId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

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

  if (cLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!client) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="h-9 w-9 p-0 rounded-xl bg-white shadow-sm border border-slate-200"><ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /></Button>
          <div className="text-start">
             <div className="flex items-center gap-3">
                <div className="px-3 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-xs border border-primary/10">{client.fileNumber}</div>
                <h1 className="text-lg font-black font-headline text-slate-900">{client.nameAr}</h1>
                <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5">{client.status}</Badge>
             </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} variant="outline" className="h-9 px-4 rounded-lg font-bold text-[10px] gap-2"><Edit3 className="h-3.5 w-3.5" /> {isRtl ? 'تعديل' : 'Edit'}</Button>
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`)} className="h-9 px-4 rounded-lg bg-primary text-white font-black text-[10px] gap-2 shadow-lg shadow-primary/10"><Activity className="h-3.5 w-3.5" /> {isRtl ? 'فتح معاملة' : 'New Trans'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-4 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3"><Layers className="h-4 w-4 text-primary" /><CardTitle className="text-xs font-black uppercase tracking-widest">{isRtl ? 'المعاملات الفنية' : 'Technical Transactions'}</CardTitle></div>
                 <Badge className="bg-slate-900 text-white font-black rounded-full h-5 px-2.5 flex items-center justify-center text-[9px]">{transactions?.length || 0}</Badge>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                 {transactions?.map((t) => (
                    <div key={t.id} onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${t.id}`)} className="p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shadow-sm", t.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}><PlayCircle className="h-5 w-5" /></div>
                          <div className="text-start"><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{t.transactionNumber}</p><h4 className="font-black text-[12px] text-slate-800 leading-tight">{t.subServiceName}</h4><p className="text-[9px] font-bold text-primary mt-0.5">{t.activityTypeName}</p></div>
                       </div>
                       <ArrowRight className={cn("h-4 w-4 text-slate-200 group-hover:text-primary transition-all", isRtl && "rotate-180")} />
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
                    <div onClick={() => client.locationUrl && window.open(client.locationUrl, '_blank')} className={cn("relative h-32 w-full rounded-[2.5rem] overflow-hidden shadow-lg border-2", coordinates ? "bg-white border-blue-500/10 cursor-pointer hover:ring-4 hover:ring-blue-500/5 transition-all" : "bg-white/50 border-dashed border-slate-200")}>
                       {coordinates ? (
                          <>
                             <MapContainer center={coordinates} zoom={15} style={{height:'100%',width:'100%'}} zoomControl={false} dragging={false} scrollWheelZoom={false}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={coordinates} />
                             </MapContainer>
                             <div className="absolute bottom-2 left-0 right-0 px-2"><Badge className="w-full bg-blue-600 text-white font-black text-[7px] h-4 border-0 justify-center">GPS LOCKED</Badge></div>
                          </>
                       ) : <div className="h-full flex items-center justify-center text-slate-200"><MapIcon className="h-8 w-8" /></div>}
                    </div>
                 </div>
              </div>
           </Card>
        </div>

        <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden flex flex-col min-h-[400px]">
           <CardHeader className="bg-slate-50/50 border-b p-4 flex items-center gap-2"><History className="h-4 w-4 text-primary" /><CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isRtl ? 'سجل الأحداث' : 'History Log'}</CardTitle></CardHeader>
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
    </div>
  );
}
