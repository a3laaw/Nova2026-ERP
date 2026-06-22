'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, Edit3, User, MapPin, Phone, Mail, 
  ShieldCheck, History, Clock, Loader2, AlertCircle,
  HardHat, FileText, ChevronRight, Activity, Plus,
  MessageSquare, UserCog, ExternalLink, Globe,
  Navigation
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ClientService } from '@/services/client-service';
import { toast } from '@/hooks/use-toast';

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

  const clientRef = useMemo(() => 
    companyId && db ? doc(db, paths.clients(companyId), clientId) : null, 
  [db, companyId, clientId]);

  const historyQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clientHistory(companyId, clientId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, clientId]);

  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);
  const { data: history, loading: historyLoading } = useCollection<ClientHistory>(historyQuery);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all">
            <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/10 shadow-inner">
                   {client.fileNumber}
                </div>
                <div>
                   <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">{client.nameAr}</h1>
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

        <div className="flex gap-4">
           <Button onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)} className="h-14 px-8 rounded-2xl bg-white border-2 text-slate-800 font-black gap-2 hover:bg-slate-50 transition-all">
              <Edit3 className="h-5 w-5 text-primary" /> {isRtl ? 'تعديل الملف' : 'Edit'}
           </Button>
           <Button 
             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/new`)}
             className="h-14 px-8 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2"
           >
              <Activity className="h-5 w-5" /> {isRtl ? 'فتح معاملة فنية' : 'Open Transaction'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           
           {/* Location Card - PRO UI */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <MapPin className="h-6 w-6 text-primary" />
                    {isRtl ? 'الموقع الجغرافي والعنوان' : 'Location & Address'}
                 </CardTitle>
                 {client.locationUrl && (
                    <Button 
                      asChild 
                      className="bg-blue-600 text-white font-black rounded-xl h-10 px-6 gap-2 shadow-lg shadow-blue-100 hover:scale-105 transition-all"
                    >
                       <a href={client.locationUrl} target="_blank" rel="noopener noreferrer">
                          <Navigation className="h-4 w-4" /> {isRtl ? 'فتح في خرائط جوجل' : 'Open in Maps'}
                       </a>
                    </Button>
                 )}
              </CardHeader>
              <CardContent className="p-8 text-start">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="p-6 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRtl ? 'المحافظة والمنطقة' : 'Gov & Area'}</p>
                          <p className="text-lg font-black text-slate-900">{client.governorateName || '---'} - {client.areaName || '---'}</p>
                       </div>
                       <div className="grid grid-cols-3 gap-3">
                          <div className="p-4 rounded-2xl bg-slate-50 border text-center">
                             <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'قطعة' : 'Block'}</p>
                             <p className="font-black text-slate-800">{client.block || '-'}</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-slate-50 border text-center">
                             <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'شارع' : 'Street'}</p>
                             <p className="font-black text-slate-800">{client.street || '-'}</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-slate-50 border text-center">
                             <p className="text-[8px] font-black text-slate-400 uppercase">{isRtl ? 'منزل' : 'House'}</p>
                             <p className="font-black text-slate-800">{client.houseNumber || '-'}</p>
                          </div>
                       </div>
                    </div>

                    <div className="relative group">
                       <div className="absolute inset-0 bg-blue-500/5 rounded-[2rem] blur-xl group-hover:bg-blue-500/10 transition-all" />
                       <div className={cn(
                          "relative h-full min-h-[150px] rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all",
                          client.locationUrl ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-slate-50/50"
                       )}>
                          <div className={cn("h-16 w-16 rounded-3xl flex items-center justify-center mb-4 shadow-sm", client.locationUrl ? "bg-blue-600 text-white" : "bg-white text-slate-200")}>
                             <Globe className="h-8 w-8" />
                          </div>
                          {client.locationUrl ? (
                            <div className="text-center">
                               <p className="text-xs font-black text-blue-900">{isRtl ? 'رابط الموقع مفعل' : 'Location Link Active'}</p>
                               <p className="text-[9px] font-bold text-blue-500/70 mt-1">جاهز للملاحة الميدانية</p>
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-slate-300 italic">{isRtl ? 'لا يوجد رابط خرائط' : 'No Maps Link'}</p>
                          )}
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* Interaction Logger */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-amber-50/50 border-b p-8 text-start">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-amber-600" />
                    {isRtl ? 'توثيق متابعة / زيارة ميدانية' : 'Log Visit / Interaction'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
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

        {/* Sidebar History */}
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
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[750px] scrollbar-hide">
                 {historyLoading ? (
                   <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
                 ) : (
                   <div className="relative">
                      <div className={cn("absolute top-0 bottom-0 w-[2px] bg-slate-100", isRtl ? "right-10" : "left-10")} />
                      <div className="divide-y divide-slate-50">
                        {history?.map((event) => (
                          <div key={event.id} className="p-8 relative group hover:bg-slate-50/50 transition-colors text-start">
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
