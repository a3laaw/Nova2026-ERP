'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Edit3, User, MapPin, Phone, Mail, 
  ShieldCheck, History, Clock, Loader2, AlertCircle,
  HardHat, FileText, ChevronRight, Activity, Plus,
  MessageSquare, UserCog, ExternalLink, Globe,
  Navigation, Map as MapIcon, Compass, LocateFixed,
  Layers, CheckCircle2, PlayCircle
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ClientService } from '@/services/client-service';
import { toast } from '@/hooks/use-toast';

// استيراد الخرائط ديناميكياً لمعاينة الموقع في صفحة التفاصيل
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

  // 1. جلب بيانات العميل
  const clientRef = useMemo(() => 
    companyId && db ? doc(db, paths.clients(companyId), clientId) : null, 
  [db, companyId, clientId]);

  // 2. جلب سجل العمليات
  const historyQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clientHistory(companyId, clientId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, clientId]);

  // 3. جلب المعاملات الفنية المرتبطة بهذا العميل
  const transactionsQuery = useMemo(() => 
    companyId && db ? query(
      collection(db, paths.transactions(companyId)), 
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    ) : null, 
  [db, companyId, clientId]);

  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);
  const { data: history, loading: historyLoading } = useCollection<ClientHistory>(historyQuery);
  const { data: transactions, loading: transLoading } = useCollection<Transaction>(transactionsQuery);

  // دالة ذكية لاستخراج الإحداثيات من رابط جوجل ماب
  const coordinates = useMemo(() => {
    if (!client?.locationUrl) return null;
    try {
      const url = client.locationUrl;
      const match = url.match(/q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/) || 
                    url.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
      
      if (match) {
        return [parseFloat(match[1]), parseFloat(match[2])] as [number, number];
      }
    } catch (e) {
      console.error("Failed to parse coordinates", e);
    }
    return null;
  }, [client?.locationUrl]);

  const handleLogVisit = async () => {
    if (!db || !companyId || !user || !interaction.trim()) return;
    setLogging(true);
    try {
      const service = new ClientService(db, companyId);
      await service.logInteraction(clientId, interaction, user.uid, user.displayName || 'User');
      setInteraction('');
      toast({ title: isRtl ? "تم توثيق الزيارة" : "Visit Logged" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setLogging(false);
    }
  };

  if (clientLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  if (!client) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
      <AlertCircle className="h-16 w-16 text-destructive/20" />
      <h2 className="text-2xl font-black text-slate-400">{isRtl ? 'عذراً، الملف غير موجود' : 'Client file not found'}</h2>
      <Button onClick={() => router.push('/dashboard/clients')} variant="outline" className="rounded-xl">العودة</Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4 md:gap-8 flex-wrap">
          <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all shrink-0">
            <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-4 flex-wrap">
                <div className="h-16 px-6 w-fit min-w-[4rem] rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/10 shadow-inner">
                   {client.fileNumber}
                </div>
                <div className="min-w-[200px]">
                   <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight leading-tight">{client.nameAr}</h1>
                   <Badge className={cn(
                      "font-black px-4 py-1.5 rounded-xl border-0 shadow-sm uppercase text-[10px] mt-2",
                      client.status === 'contracted' ? 'bg-emerald-500 text-white' : 
                      client.status === 'prospective' ? 'bg-blue-500 text-white' :
                      client.status === 'new' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                   )}>{client.status}</Badge>
                </div>
             </div>
          </div>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-white border-2 text-slate-800 font-black gap-2 hover:bg-slate-50 transition-all">
              <Edit3 className="h-5 w-5 text-primary" /> {isRtl ? 'تعديل الملف' : 'Edit'}
           </Button>
           <Button 
             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`)}
             className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2"
           >
              <Activity className="h-5 w-5" /> {isRtl ? 'فتح معاملة فنية' : 'Open Transaction'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           
           {/* Section: Technical Transactions List - NEW */}
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                       <Layers className="h-6 w-6" />
                    </div>
                    <div>
                       <CardTitle className="text-xl font-black">{isRtl ? 'المعاملات الفنية والتعاقدات' : 'Technical Transactions'}</CardTitle>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRtl ? 'تتبع مسارات التنفيذ المفتوحة' : 'Execution Pipeline Tracking'}</p>
                    </div>
                 </div>
                 <Badge className="bg-slate-900 text-white font-black rounded-full h-8 px-4 flex items-center justify-center">{transactions?.length || 0}</Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                 {transLoading ? (
                    <div className="p-10 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
                 ) : transactions?.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center gap-4 opacity-40">
                       <div className="p-6 rounded-[2rem] bg-slate-50 border-2 border-dashed">
                          <Activity className="h-12 w-12 text-slate-300" />
                       </div>
                       <p className="text-sm font-black text-slate-400 italic">{isRtl ? 'لا توجد معاملات فنية مفتوحة حالياً.' : 'No active transactions found.'}</p>
                       <Button variant="link" onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`)} className="text-primary font-black uppercase text-xs">Open First Transaction</Button>
                    </div>
                 ) : (
                    transactions?.map((trans) => (
                       <div 
                         key={trans.id} 
                         onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${trans.id}`)}
                         className="p-6 rounded-[2.5rem] border-2 border-slate-50 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group flex items-center justify-between"
                       >
                          <div className="flex items-center gap-6">
                             <div className={cn(
                               "h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm transition-colors",
                               trans.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                               trans.status === 'in-progress' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                             )}>
                                {trans.status === 'completed' ? <CheckCircle2 className="h-7 w-7" /> : <PlayCircle className="h-7 w-7" />}
                             </div>
                             <div className="text-start">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{trans.transactionNumber}</p>
                                <h4 className="font-black text-lg text-slate-800 leading-tight">{trans.subServiceName}</h4>
                                <div className="flex items-center gap-3 mt-1.5">
                                   <Badge variant="secondary" className="bg-white border text-[8px] font-black uppercase px-2">{trans.activityTypeName}</Badge>
                                   <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                      <HardHat className="h-3 w-3 text-primary" /> {trans.assignedEngineerName}
                                   </span>
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="hidden md:block text-end">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{isRtl ? 'حالة المسار' : 'Path Status'}</p>
                                <p className={cn(
                                   "text-xs font-black uppercase",
                                   trans.status === 'completed' ? "text-emerald-600" : 
                                   trans.status === 'in-progress' ? "text-blue-600" : "text-amber-600"
                                )}>{trans.status}</p>
                             </div>
                             <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all h-10 w-10">
                                <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-0", isRtl && "rotate-180")} />
                             </Button>
                          </div>
                       </div>
                    ))
                 )}
              </CardContent>
           </Card>
           
           <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5 group">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 w-full" />
              <CardHeader className="bg-slate-50/30 border-b p-8 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                       <Compass className="h-6 w-6" />
                    </div>
                    <div>
                       <CardTitle className="text-xl font-black">{isRtl ? 'الرادار الجغرافي للعنوان' : 'Geographic Title Radar'}</CardTitle>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRtl ? 'إحداثيات القسيمة والمنطقة' : 'Plot Coordinates & Sector'}</p>
                    </div>
                 </div>
                 {client.locationUrl && (
                    <Button 
                      asChild 
                      className="bg-blue-600 text-white font-black rounded-2xl h-12 px-8 gap-3 shadow-2xl shadow-blue-200 hover:scale-110 active:scale-95 transition-all"
                    >
                       <a href={client.locationUrl} target="_blank" rel="noopener noreferrer">
                          <Navigation className="h-5 w-5 animate-pulse" /> {isRtl ? 'ملاحة ميدانية' : 'Field Navigation'}
                       </a>
                    </Button>
                 )}
              </CardHeader>
              
              <CardContent className="p-0">
                 <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="p-10 space-y-8 text-start border-e border-slate-50">
                       <div className="space-y-4">
                          <div className="p-6 rounded-[2.5rem] bg-slate-50 border-2 border-white shadow-inner relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Globe className="h-16 w-16" />
                             </div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{isRtl ? 'الموقع العام' : 'General Location'}</p>
                             <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                {client.governorateName || '---'}
                                <span className="mx-2 text-primary opacity-30">/</span>
                                {client.areaName || '---'}
                             </p>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                             {[
                               { label: isRtl ? 'قطعة' : 'Block', val: client.block },
                               { label: isRtl ? 'شارع' : 'Street', val: client.street },
                               { label: isRtl ? 'قسيمة' : 'Plot', val: client.houseNumber }
                             ].map((item, i) => (
                               <div key={i} className="p-5 rounded-3xl bg-white border-2 border-slate-50 shadow-sm text-center group-hover:border-blue-100 transition-colors">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                  <p className="text-lg font-black text-slate-800">{item.val || '-'}</p>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="relative p-10 bg-slate-50/50 flex flex-col items-center justify-center min-h-[350px] overflow-hidden">
                       <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1e1b4b 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                       
                       <div className={cn(
                          "relative h-64 w-full md:w-64 rounded-[3.5rem] overflow-hidden transition-all duration-500 shadow-2xl border-4",
                          coordinates 
                            ? "bg-white border-blue-500/20 scale-105 hover:ring-8 hover:ring-blue-100 cursor-pointer" 
                            : "bg-white/50 border-4 border-dashed border-slate-200 opacity-50 flex flex-col items-center justify-center"
                       )}>
                          {coordinates ? (
                             <a 
                               href={client.locationUrl} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="h-full w-full block"
                             >
                                <div className="h-full w-full pointer-events-none">
                                   <MapContainer center={coordinates} zoom={15} style={{ height: '100%', width: '100%', borderRadius: '3.5rem' }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
                                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                      <Marker position={coordinates} />
                                   </MapContainer>
                                   <div className="absolute bottom-4 left-0 right-0 px-4 z-20">
                                      <Badge className="w-full bg-blue-600 text-white font-black text-[8px] uppercase py-1 border-0 shadow-xl opacity-90 backdrop-blur-sm">
                                         {isRtl ? 'اضغط للملاحة الخارجية' : 'Click to Open Google Maps'}
                                      </Badge>
                                   </div>
                                </div>
                             </a>
                          ) : (
                             <>
                                <div className="h-20 w-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4 text-slate-300">
                                   <MapIcon className="h-10 w-10" />
                                </div>
                                <div className="text-center px-4">
                                   <p className="text-xs font-bold text-slate-300 italic">{isRtl ? 'لا توجد بيانات موقع' : 'NO GPS DATA'}</p>
                                   <Button variant="link" size="sm" onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} className="text-primary text-[10px] font-black uppercase mt-1">Add Location</Button>
                                </div>
                             </>
                          )}
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-amber-50/50 border-b p-8 text-start">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-amber-600" />
                    {isRtl ? 'توثيق متابعة / زيارة ميدانية' : 'Log Visit / Interaction'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4 text-start">
                 <Textarea 
                   value={interaction} 
                   onChange={e => setInteraction(e.target.value)}
                   className="min-h-[120px] rounded-[2rem] border-2 p-6 text-lg focus:bg-slate-50 transition-all resize-none shadow-inner"
                   placeholder={isRtl ? "اكتب تفاصيل الزيارة أو المتابعة هنا..." : "Log visit details..."}
                 />
                 <div className="flex justify-end">
                    <Button 
                      onClick={handleLogVisit} 
                      disabled={logging || !interaction.trim()}
                      className="bg-slate-900 text-white font-black rounded-xl h-12 px-10 gap-2 shadow-xl hover:scale-105 transition-all"
                    >
                       {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                       {isRtl ? 'حفظ التوثيق' : 'Log Interaction'}
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>

        <div className="space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[600px]">
              <CardHeader className="bg-slate-50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm border">
                       <History className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg font-black">{isRtl ? 'سجل العمليات' : 'History Log'}</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[750px] scrollbar-hide text-start">
                 {historyLoading ? (
                   <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
                 ) : (
                   <div className="relative">
                      <div className={cn("absolute top-0 bottom-0 w-[2px] bg-slate-100", isRtl ? "right-10" : "left-10")} />
                      <div className="divide-y divide-slate-50">
                        {history?.map((event) => (
                          <div key={event.id} className="p-8 relative group hover:bg-slate-50/50 transition-colors">
                             <div className={cn(
                               "absolute top-10 h-4 w-4 rounded-full border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125",
                               event.type === 'status_change' ? "bg-blue-500" : 
                               event.type === 'visit_logged' ? "bg-amber-500" :
                               event.type === 'transaction_created' ? "bg-emerald-500" : "bg-slate-400",
                               isRtl ? "right-[33px]" : "left-[33px]"
                             )} />
                             <div className={cn(isRtl ? "pr-10" : "pl-10")}>
                                <div className="flex justify-between items-start mb-2">
                                   <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase h-5 tracking-tighter">
                                      {event.type.replace('_', ' ')}
                                   </Badge>
                                   <span className="text-[10px] font-mono text-slate-400 font-bold">
                                      {event.createdAt?.toDate().toLocaleDateString(isRtl ? 'ar-KW' : 'en-US')}
                                   </span>
                                </div>
                                <p className="text-sm font-bold text-slate-700 leading-relaxed mb-4">{event.content}</p>
                                <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                                   <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                                      {event.userName?.charAt(0)}
                                   </div>
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.userName}</span>
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                   </div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
