'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Loader2, ArrowRight, 
  MapPinned, UserCircle, Calculator,
  MessageSquare, Hammer, Clock,
  CalendarDays, ChevronDown, CheckCircle2,
  Printer, Filter, LayoutGrid, Zap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { Appointment } from '@/types/appointment';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * @fileOverview تقرير تحليل تفاعل العملاء (Client Visit Dossier).
 * يربط المواعيد بالإنجازات الفنية والتعليقات الميدانية.
 */
export default function ClientVisitsReportPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [visitsData, setVisitsData] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // 1. جلب العملاء
  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);
  const { data: clients, loading: clientsLoading } = useCollection<Client>(clientsQuery);

  // 2. محرك جلب تفاصيل الزيارات للعميل المختار
  useEffect(() => {
    async function fetchDetails() {
      if (!selectedClientId || !db || !companyId) return;
      setLoadingVisits(true);
      try {
        // أ. جلب المواعيد المكتملة للعميل
        const apptsRef = collection(db, paths.appointments(companyId));
        const apptsQuery = query(apptsRef, where('clientId', '==', selectedClientId), where('status', '==', 'completed'), orderBy('start', 'desc'));
        const apptsSnap = await getDocs(apptsQuery);
        const appts = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));

        // ب. جلب الإنجازات والتعليقات المربوطة بكل موعد
        const fullData = await Promise.all(appts.map(async (appt) => {
           // جلب الإنجازات (Executions) المربوطة بهذا الموعد
           const execsRef = collection(db, paths.executions(companyId));
           const execsQuery = query(execsRef, where('appointmentId', '==', appt.id));
           const execsSnap = await getDocs(execsQuery);
           const achievements = execsSnap.docs.map(d => d.data());

           // جلب التعليقات الميدانية المربوطة بهذا الموعد
           // ملاحظة: نحتاج جلب التعليقات من المعاملة المرتبطة بالموعد
           let comments: any[] = [];
           if (appt.transactionId) {
              const commentsRef = collection(db, paths.transactionComments(companyId, appt.transactionId));
              const commentsQuery = query(commentsRef, where('appointmentId', '==', appt.id));
              const commentsSnap = await getDocs(commentsQuery);
              comments = commentsSnap.docs.map(d => d.data());
           }

           return { ...appt, achievements, comments };
        }));

        setVisitsData(fullData);
      } catch (e) {
        console.error("Failed to load visit details", e);
      } finally {
        setLoadingVisits(false);
      }
    }
    fetchDetails();
  }, [selectedClientId, db, companyId]);

  const filteredClients = (clients || []).filter(c => 
    c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.fileNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <MapPinned className="h-10 w-10 text-primary" />
             {isRtl ? 'سجل تفاعل العملاء (Dossier)' : 'Client Interaction Ledger'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? 'تحليل زيارات المواقع وربط الحضور بالنتائج الفنية والتعليقات.' : 'Analyze site visits and link attendance to technical outcomes.'}
           </p>
        </div>
        <Button onClick={() => window.print()} className="rounded-xl font-black gap-2 h-12 px-6 print:hidden">
           <Printer className="h-5 w-5" /> {isRtl ? 'طباعة التقرير' : 'Print Dossier'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         
         {/* القائمة الجانبية للعملاء */}
         <div className="lg:col-span-4 space-y-4 print:hidden">
            <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="relative">
                     <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                     <Input 
                       placeholder={isRtl ? 'بحث في العملاء...' : 'Search clients...'} 
                       className="ps-12 h-12 rounded-2xl border-2 border-slate-100 font-bold" 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                     />
                  </div>
               </CardHeader>
               <CardContent className="p-2 space-y-1 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {clientsLoading ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/30" /></div>
                  ) : filteredClients.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-bold italic text-xs">{isRtl ? 'لا توجد نتائج.' : 'No clients found.'}</div>
                  ) : filteredClients.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedClientId(c.id!)}
                      className={cn(
                        "p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between group border-2 border-transparent",
                        selectedClientId === c.id ? "bg-primary/5 border-primary/20 shadow-md" : "hover:bg-slate-50"
                      )}
                    >
                       <div className="text-start">
                          <p className={cn("font-black text-sm", selectedClientId === c.id ? "text-primary" : "text-slate-700")}>{c.nameAr}</p>
                          <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{c.fileNumber}</p>
                       </div>
                       <ChevronRight className={cn("h-4 w-4 transition-transform", isRtl && "rotate-180", selectedClientId === c.id ? "text-primary scale-125" : "text-slate-200")} />
                    </div>
                  ))}
               </CardContent>
            </Card>
         </div>

         {/* عرض تفاصيل الزيارات */}
         <div className="lg:col-span-8">
            {!selectedClientId ? (
               <div className="h-[600px] rounded-[3rem] border-4 border-dashed border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center text-center p-10 animate-pulse">
                  <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center text-slate-200 shadow-sm mb-6"><UserCircle className="h-12 w-12" /></div>
                  <h3 className="text-2xl font-black text-slate-400">{isRtl ? 'اختر عميلاً لعرض سجل تفاعلاته' : 'Select a Client to View Ledger'}</h3>
               </div>
            ) : loadingVisits ? (
               <div className="h-[600px] flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Indexing Site Intelligence...</p>
               </div>
            ) : (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                 {/* ملخص العميل */}
                 <Card className="border-0 shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-10 opacity-5"><LayoutGrid className="h-32 w-32" /></div>
                    <CardContent className="p-10 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                       <div className="text-start space-y-1">
                          <h2 className="text-3xl font-black font-headline">{clients?.find(c => c.id === selectedClientId)?.nameAr}</h2>
                          <div className="flex gap-4 items-center">
                             <Badge className="bg-white/10 text-primary border-0 font-black px-4">{clients?.find(c => c.id === selectedClientId)?.fileNumber}</Badge>
                             <span className="text-slate-500 font-bold text-xs uppercase">{isRtl ? 'عدد الزيارات المكتملة:' : 'Total Completed Visits:'} {visitsData.length}</span>
                          </div>
                       </div>
                       <div className="h-20 w-20 rounded-[2rem] bg-white/5 flex items-center justify-center shadow-inner border border-white/10">
                          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                       </div>
                    </CardContent>
                 </Card>

                 {/* الخط الزمني للزيارات */}
                 <div className="space-y-8 relative ps-8">
                    <div className="absolute top-0 bottom-0 left-3.5 w-1 bg-slate-100 rounded-full" />
                    
                    {visitsData.length === 0 ? (
                      <div className="py-20 text-center text-slate-400 font-bold italic">{isRtl ? 'لا يوجد زيارات مكتملة مسجلة لهذا العميل.' : 'No completed visits for this client.'}</div>
                    ) : visitsData.map((visit, vIdx) => (
                      <div key={visit.id} className="relative group">
                         {/* مؤشر الزيارة */}
                         <div className="absolute -left-8 top-0 h-8 w-8 rounded-xl bg-white border-4 border-slate-100 flex items-center justify-center z-10 shadow-lg group-hover:border-primary transition-colors">
                            <span className="text-[10px] font-black text-slate-400 group-hover:text-primary">{visitsData.length - vIdx}</span>
                         </div>

                         <Card className="border-0 shadow-xl rounded-[2rem] bg-white overflow-hidden group-hover:ring-2 group-hover:ring-primary/10 transition-all">
                            <CardHeader className="bg-slate-50/50 p-6 border-b flex flex-row justify-between items-center text-start">
                               <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary border border-primary/10">
                                     <CalendarDays className="h-5 w-5" />
                                  </div>
                                  <div className="text-start">
                                     <h4 className="font-black text-slate-800 text-sm">{visit.title}</h4>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(visit.start).toLocaleDateString()} | {new Date(visit.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                  </div>
                               </div>
                               <Badge variant="outline" className="bg-white font-black text-[9px] px-3">{visit.engineerName}</Badge>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8 text-start">
                               
                               {/* نتائج الإنجاز الفني */}
                               <div className="space-y-4">
                                  <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                                     <Hammer className="h-3.5 w-3.5" /> {isRtl ? 'المخرجات الفنية والإنجاز' : 'Technical Achievements'}
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {visit.achievements.length > 0 ? visit.achievements.map((ex: any, i: number) => (
                                       <div key={i} className="p-4 rounded-2xl bg-emerald-50/30 border-2 border-white shadow-inner flex justify-between items-center">
                                          <div className="text-start">
                                             <p className="text-[10px] font-black text-emerald-800">{ex.boqItemName || (isRtl ? 'بند عمل' : 'Work Item')}</p>
                                             {ex.notes && <p className="text-[9px] font-bold text-slate-500 italic mt-0.5">"{ex.notes}"</p>}
                                          </div>
                                          <Badge className="bg-emerald-600 text-white border-0 font-black text-[10px]">+{ex.quantity}</Badge>
                                       </div>
                                     )) : (
                                       <div className="col-span-full py-4 text-center text-[10px] font-bold text-slate-300 italic">{isRtl ? 'لم يتم تسجيل كميات في هذه الزيارة.' : 'No quantities logged.'}</div>
                                     )}
                                  </div>
                               </div>

                               {/* الملاحظات والتعليقات */}
                               <div className="space-y-4 pt-4 border-t border-slate-50">
                                  <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                                     <MessageSquare className="h-3.5 w-3.5" /> {isRtl ? 'التوثيق المعرفي والملاحظات' : 'Knowledge Documentation'}
                                  </h5>
                                  <div className="space-y-3">
                                     {visit.comments.length > 0 ? visit.comments.map((c: any, i: number) => (
                                       <div key={i} className="p-4 rounded-2xl bg-blue-50/30 border-2 border-white shadow-inner">
                                          <p className="text-xs font-bold text-slate-700 leading-relaxed">{c.content}</p>
                                          <div className="mt-2 flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase">
                                             <UserCircle className="h-2.5 w-2.5" /> {c.createdByName}
                                          </div>
                                       </div>
                                     )) : (
                                       <div className="py-4 text-center text-[10px] font-bold text-slate-300 italic">{isRtl ? 'لا يوجد ملاحظات مسجلة.' : 'No notes logged.'}</div>
                                     )}
                                  </div>
                               </div>

                            </CardContent>
                         </Card>
                      </div>
                    ))}
                 </div>
              </div>
            )}
         </div>

      </div>
    </div>
  );
}
