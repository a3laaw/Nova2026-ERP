'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, Edit3, User, MapPin, Phone, Mail, 
  ShieldCheck, History, Clock, Loader2, AlertCircle,
  HardHat, FileText, ChevronRight, Activity, Plus,
  MessageSquare, UserCog
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client, ClientHistory } from '@/types/client';
import { cn } from '@/lib/utils';

/**
 * صفحة ملف العميل الشامل (Client Dossier)
 * تعرض كافة بيانات التواصل والموقع الجغرافي وسجل الحركات التاريخي.
 */
export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // 1. جلب بيانات العميل الأساسية
  const clientRef = useMemo(() => 
    companyId && db ? doc(db, paths.clients(companyId), clientId) : null, 
  [db, companyId, clientId]);

  // 2. جلب سجل الحركات التاريخي (Sub-collection) مرتباً تنازلياً
  const historyQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clientHistory(companyId, clientId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, clientId]);

  const { data: client, loading: clientLoading } = useDoc<Client>(clientRef);
  const { data: history, loading: historyLoading } = useCollection<ClientHistory>(historyQuery);

  // حالة التحميل
  if (clientLoading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
    </div>
  );

  // حالة "لم يتم العثور على العميل"
  if (!client) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
      <AlertCircle className="h-16 w-16 text-destructive/20" />
      <h2 className="text-2xl font-black text-slate-400">{isRtl ? 'عذراً، الملف غير موجود' : 'Client file not found'}</h2>
      <Button onClick={() => router.push('/dashboard/clients')} variant="outline" className="rounded-xl">
        {isRtl ? 'العودة لقاعدة البيانات' : 'Back to database'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      
      {/* الرأس: الهوية والإجراءات السريعة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard/clients')} 
            className="h-14 w-14 p-0 rounded-2xl bg-white shadow-sm border-2 hover:bg-slate-50 transition-all"
          >
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
                      <ShieldCheck className="h-4 w-4 text-primary" /> 
                      {isRtl ? 'الرقم الموحد للنظام:' : 'System ID:'} 
                      <span className="font-mono text-slate-800">{clientId}</span>
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
        
        {/* العمود الرئيسي: بيانات الملف */}
        <div className="lg:col-span-2 space-y-8">
           
           {/* بطاقة التواصل والعنوان */}
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-slate-50/50 border-b p-8 text-start">
                 <CardTitle className="text-xl font-black flex items-center gap-3">
                    <User className="h-6 w-6 text-primary" />
                    {isRtl ? 'بيانات التواصل والعنوان الجغرافي' : 'Contact & Address'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10 text-start">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                             <Phone className="h-6 w-6" />
                          </div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'رقم الهاتف' : 'Phone'}</p>
                             <p className="text-xl font-black text-slate-900">{client.mobile}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                             <Mail className="h-6 w-6" />
                          </div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'البريد الإلكتروني' : 'Email'}</p>
                             <p className="text-base font-bold text-slate-600 truncate max-w-[200px]">{client.email || '---'}</p>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-8">
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                             <MapPin className="h-6 w-6" />
                          </div>
                          <div className="text-start">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الموقع الجغرافي' : 'Location'}</p>
                             <p className="text-base font-black text-slate-900">{client.governorateName || '---'} - {client.areaName || '---'}</p>
                             <p className="text-xs font-bold text-slate-500 mt-1">قطعة {client.block}، شارع {client.street}، منزل {client.houseNumber}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner text-start space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الحالة التشغيلية' : 'Operating Status'}</p>
                       <Badge className={cn(
                          "font-black px-4 py-1.5 rounded-xl border-0 shadow-sm uppercase text-[10px]",
                          client.status === 'contracted' ? 'bg-emerald-500 text-white' : 
                          client.status === 'registered' ? 'bg-blue-500 text-white' :
                          client.status === 'prospective' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                       )}>{client.status}</Badge>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner text-start space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'المهندس المسؤول' : 'Assigned Engineer'}</p>
                       <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <HardHat className="h-4 w-4 text-primary" /> {client.assignedEngineerName || (isRtl ? 'لم يتم التعيين بعد' : 'Not assigned yet')}
                       </p>
                    </div>
                 </div>

                 <div className="space-y-3 pt-4">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'ملاحظات إضافية' : 'Notes & Remarks'}</Label>
                    <div className="p-6 rounded-2xl border-2 border-dashed bg-slate-50/30">
                       <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                          {client.notes || (isRtl ? 'لا توجد ملاحظات مسجلة لهذا العميل.' : 'No notes recorded for this client.')}
                       </p>
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* مؤشرات الأداء السريعة */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white p-8 flex items-center justify-between group hover:shadow-xl transition-all">
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{isRtl ? 'إجمالي المعاملات' : 'Total Trans'}</p>
                    <h3 className="text-5xl font-black font-headline text-slate-900">{client.transactionCounter || 0}</h3>
                 </div>
                 <Activity className="h-12 w-12 text-primary/10 group-hover:scale-110 transition-transform" />
              </Card>
              <Card className="border-0 shadow-lg rounded-[2.5rem] bg-slate-900 text-white p-8 flex items-center justify-between">
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{isRtl ? 'العقود النشطة' : 'Active Contracts'}</p>
                    <h3 className="text-5xl font-black font-headline text-emerald-400">0</h3>
                 </div>
                 <FileText className="h-12 w-12 text-white/5" />
              </Card>
              <Card className="border-0 shadow-lg rounded-[2.5rem] bg-white p-8 flex items-center justify-between group hover:shadow-xl transition-all">
                 <div className="text-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{isRtl ? 'إجمالي المحصل' : 'Collected'}</p>
                    <h3 className="text-2xl font-black font-headline text-slate-900">0.000 <span className="text-xs">KWD</span></h3>
                 </div>
                 <ChevronRight className="h-12 w-12 text-primary/10" />
              </Card>
           </div>
        </div>

        {/* العمود الجانبي: سجل الحركات التاريخي */}
        <div className="space-y-8">
           <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 flex flex-col h-full min-h-[600px]">
              <CardHeader className="bg-slate-50 border-b p-8 text-start flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm border">
                       <History className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg font-black">{isRtl ? 'سجل العمليات' : 'History Log'}</CardTitle>
                 </div>
                 <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-white"><Plus className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[750px] scrollbar-hide">
                 {historyLoading ? (
                   <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
                 ) : (
                   <div className="relative">
                      {/* الخط العمودي للشريط الزمني */}
                      <div className={cn(
                        "absolute top-0 bottom-0 w-[2px] bg-slate-100",
                        isRtl ? "right-10" : "left-10"
                      )} />

                      <div className="divide-y divide-slate-50">
                        {history?.length === 0 ? (
                          <div className="p-20 text-center text-slate-300 font-bold italic text-sm">{isRtl ? 'لا توجد سجلات تاريخية بعد.' : 'No history events yet.'}</div>
                        ) : (
                          history?.map((event) => (
                            <div key={event.id} className="p-8 relative group hover:bg-slate-50/50 transition-colors text-start">
                               {/* عقدة الشريط الزمني */}
                               <div className={cn(
                                 "absolute top-10 h-4 w-4 rounded-full border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125",
                                 event.type === 'status_change' ? "bg-blue-500" : 
                                 event.type === 'system_log' ? "bg-primary" : 
                                 event.type === 'note_added' ? "bg-amber-500" : "bg-slate-400",
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
                                  <p className="text-sm font-bold text-slate-700 leading-relaxed mb-4">
                                     {event.content}
                                  </p>
                                  <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                                     <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                        {event.userName?.charAt(0) || <UserCog className="h-3 w-3" />}
                                     </div>
                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.userName || 'System'}</span>
                                  </div>
                               </div>
                            </div>
                          ))
                        )}
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
