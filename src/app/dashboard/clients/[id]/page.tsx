'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Edit3, User, MapPin, Phone, Mail, 
  ShieldCheck, History, Clock, Loader2, AlertCircle,
  HardHat, FileText, ChevronRight, Activity, Plus
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { cn } from '@/lib/utils';

export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const clientRef = useMemo(() => companyId && db ? doc(db, paths.clients(companyId), clientId) : null, [db, companyId, clientId]);
  const historyQuery = useMemo(() => companyId && db ? query(collection(db, paths.clientHistory(companyId, clientId)), orderBy('createdAt', 'desc')) : null, [db, companyId, clientId]);

  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);
  const { data: history, loading: historyLoading } = useCollection<ClientHistory>(historyQuery);

  if (clientLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!client) return <div className="p-20 text-center"><AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" /><h2 className="text-2xl font-black">{isRtl ? 'الملف غير موجود' : 'Client file not found'}</h2></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      
      {/* Header Profile */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <Button variant="ghost" onClick={() => router.push('/dashboard/clients')} className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all">
            <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
          </Button>
          <div className="text-start">
             <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-primary/10">
                   {client.fileNumber}
                </div>
                <div>
                   <h1 className="text-4xl font-black font-headline text-slate-900 tracking-tight">{client.nameAr}</h1>
                   <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> {isRtl ? 'رقم السجل الموحد:' : 'System ID:'} <span className="font-mono text-slate-800">{clientId}</span>
                   </p>
                </div>
             </div>
          </div>
        </div>

        <div className="flex gap-4">
           <Button 
             onClick={() => router.push(`/dashboard/clients/${clientId}/edit`)}
             className="h-14 px-8 rounded-2xl bg-white border-2 text-slate-800 font-black gap-2 hover:bg-slate-50 transition-all"
           >
              <Edit3 className="h-5 w-5 text-primary" /> {isRtl ? 'تعديل الملف' : 'Edit Profile'}
           </Button>
           <Button className="h-14 px-8 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all gap-2">
              <Activity className="h-5 w-5" /> {isRtl ? 'فتح معاملة فنية' : 'Open Transaction'}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <User className="h-6 w-6 text-primary" />
                    {isRtl ? 'بيانات التواصل والعنوان' : 'Contact & Address'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10 text-start">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Phone className="h-6 w-6" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'رقم الهاتف' : 'Phone'}</p>
                             <p className="text-xl font-black text-slate-900">{client.mobile}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Mail className="h-6 w-6" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'البريد الإلكتروني' : 'Email'}</p>
                             <p className="text-base font-bold text-slate-600">{client.email || '---'}</p>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><MapPin className="h-6 w-6" /></div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الموقع والعنوان' : 'Location'}</p>
                             <p className="text-base font-black text-slate-900">{client.governorateName} - {client.areaName}</p>
                             <p className="text-xs font-bold text-slate-500">قطعة {client.block}، شارع {client.street}، منزل {client.houseNumber}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 border-t border-slate-100 grid grid-cols-2 gap-8">
                    <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner text-start space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'الحالة التشغيلية' : 'Status'}</p>
                       <Badge className={cn(
                          "font-black px-4 py-1.5 rounded-xl border-0 shadow-sm uppercase text-[10px]",
                          client.status === 'contracted' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                       )}>{client.status}</Badge>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner text-start space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'المهندس المسؤول' : 'Assigned Engineer'}</p>
                       <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <HardHat className="h-4 w-4 text-primary" /> {client.assignedEngineerName || (isRtl ? 'غير معين' : 'Not assigned')}
                       </p>
                    </div>
                 </div>

                 <div className="space-y-3 pt-4">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">{isRtl ? 'ملاحظات إضافية' : 'Notes'}</Label>
                    <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-2xl border italic">
                       {client.notes || (isRtl ? 'لا توجد ملاحظات مسجلة.' : 'No notes available.')}
                    </p>
                 </div>
              </CardContent>
           </Card>

           {/* مؤشرات الأداء للعميل */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg rounded-[2rem] bg-white p-8 flex items-center justify-between">
                 <div className="text-start">
                    <p className="text-xs font-black text-slate-400 uppercase mb-2">{isRtl ? 'إجمالي المعاملات' : 'Total Trans'}</p>
                    <h3 className="text-5xl font-black font-headline text-slate-900">{client.transactionCounter || 0}</h3>
                 </div>
                 <Activity className="h-12 w-12 text-primary/20" />
              </Card>
              <Card className="border-0 shadow-lg rounded-[2rem] bg-slate-900 text-white p-8 flex items-center justify-between">
                 <div className="text-start">
                    <p className="text-xs font-black text-slate-400 uppercase mb-2">{isRtl ? 'العقود النشطة' : 'Active Contracts'}</p>
                    <h3 className="text-5xl font-black font-headline text-emerald-400">0</h3>
                 </div>
                 <FileText className="h-12 w-12 text-white/10" />
              </Card>
           </div>
        </div>

        {/* Right Column: History & Events */}
        <div className="space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[600px]">
              <CardHeader className="bg-slate-50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                       <History className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg font-black">{isRtl ? 'سجل التفاعلات' : 'History Log'}</CardTitle>
                 </div>
                 <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-white"><Plus className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[700px] scrollbar-hide">
                 {historyLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div> : (
                   <div className="divide-y divide-slate-100">
                      {history?.length === 0 ? (
                        <div className="p-20 text-center text-slate-300 font-bold italic text-sm">{isRtl ? 'لا يوجد تفاعلات مسجلة بعد.' : 'No history events yet.'}</div>
                      ) : (
                        history?.map((event) => (
                          <div key={event.id} className="p-6 hover:bg-slate-50 transition-colors text-start group">
                             <div className="flex justify-between items-start mb-2">
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase h-5">
                                   {event.type.replace('_', ' ')}
                                </Badge>
                                <span className="text-[10px] font-mono text-slate-400 font-bold">
                                   {event.createdAt?.toDate().toLocaleDateString(isRtl ? 'ar-KW' : 'en-US')}
                                </span>
                             </div>
                             <p className="text-sm font-bold text-slate-700 leading-relaxed mb-3">
                                {event.content}
                             </p>
                             <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                   {event.userName?.charAt(0)}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.userName}</span>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
