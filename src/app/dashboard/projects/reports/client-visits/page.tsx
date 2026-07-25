
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, Loader2, ArrowRight, 
  MapPinned, UserCircle, Calculator,
  MessageSquare, Hammer, Clock,
  CalendarDays, CheckCircle2,
  Printer, Filter, LayoutGrid, X,
  XCircle, AlertTriangle, FileText,
  User, History
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
import { PrintWrapper } from '@/components/layout/print-wrapper';

/**
 * @fileOverview تقرير سجل تفاعل العملاء (The Sovereign Visit Dossier).
 * تم تحويله إلى جدول موحد يشمل كافة الزيارات (مكتملة، ملغاة، مجدولة)
 * بأسلوب عرض تبسيطي واحترافي للطباعة.
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

  // 1. جلب قائمة العملاء
  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);
  const { data: clients, loading: clientsLoading } = useCollection<Client>(clientsQuery);

  // 2. محرك جلب بيانات الزيارات الشامل (Deep Visit Analytics)
  useEffect(() => {
    async function fetchFullHistory() {
      if (!selectedClientId || !db || !companyId) return;
      setLoadingVisits(true);
      try {
        const apptsRef = collection(db, paths.appointments(companyId));
        // جلب كافة المواعيد للعميل مهما كانت حالتها
        const apptsQuery = query(apptsRef, where('clientId', '==', selectedClientId));
        const apptsSnap = await getDocs(apptsQuery);
        
        const allAppts = apptsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Appointment))
          .sort((a, b) => b.start.localeCompare(a.start)); // الأحدث أولاً

        const fullData = await Promise.all(allAppts.map(async (appt) => {
           // جلب الإنجازات المرتبطة بهذا الموعد من المقايسة
           const execsRef = collection(db, paths.executions(companyId));
           const execsQuery = query(execsRef, where('appointmentId', '==', appt.id));
           const execsSnap = await getDocs(execsQuery);
           const achievements = execsSnap.docs.map(d => d.data());

           // جلب التعليقات البشرية من غرفة العمليات المرتبطة بهذا الموعد
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
        console.error("Failed to load visit history", e);
      } finally {
        setLoadingVisits(false);
      }
    }
    fetchFullHistory();
  }, [selectedClientId, db, companyId]);

  const filteredClients = (clients || []).filter(c => 
    c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.fileNumber.includes(searchTerm)
  );

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <History className="h-10 w-10 text-primary" />
             {isRtl ? 'سجل تفاعل العملاء (Dossier)' : 'Client Interaction Ledger'}
           </h1>
           <p className="text-muted-foreground mt-1 text-sm font-bold opacity-80 italic">
              {isRtl ? 'تقرير زمني موحد لزيارات الموقع، الإنجازات الفنية، والتوثيق المعرفي.' : 'Unified timeline of site visits, technical progress, and knowledge documentation.'}
           </p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="rounded-xl border-2 font-black gap-2 h-12 px-8 shadow-sm">
           <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'طباعة التقرير الشامل' : 'Print Official Dossier'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         
         {/* Left Side: Client Selector */}
         <div className="lg:col-span-3 space-y-4 print:hidden">
            <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 border-b p-5">
                  <div className="relative">
                     <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                     <Input 
                       placeholder={isRtl ? 'بحث في العملاء...' : 'Search clients...'} 
                       className="ps-10 h-10 rounded-xl border-2 border-slate-100 font-bold text-xs" 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                     />
                  </div>
               </CardHeader>
               <CardContent className="p-2 space-y-1 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {clientsLoading ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary/30" /></div>
                  ) : filteredClients.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-bold italic text-xs">{isRtl ? 'لا يوجد نتائج.' : 'No clients found.'}</div>
                  ) : filteredClients.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedClientId(c.id!)}
                      className={cn(
                        "p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between group border-2 border-transparent",
                        selectedClientId === c.id ? "bg-primary/5 border-primary/20 shadow-md" : "hover:bg-slate-50"
                      )}
                    >
                       <div className="text-start">
                          <p className={cn("font-black text-xs", selectedClientId === c.id ? "text-primary" : "text-slate-700")}>{c.nameAr}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-400 mt-0.5">{c.fileNumber}</p>
                       </div>
                       <ArrowRight className={cn("h-3.5 w-3.5 transition-transform", isRtl && "rotate-180", selectedClientId === c.id ? "text-primary scale-125" : "text-slate-200")} />
                    </div>
                  ))}
               </CardContent>
            </Card>
         </div>

         {/* Right Side: Analytical Ledger */}
         <div className="lg:col-span-9">
            {!selectedClientId ? (
               <div className="h-[600px] rounded-[3rem] border-4 border-dashed border-slate-100 bg-white flex flex-col items-center justify-center text-center p-10 animate-pulse print:hidden">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 shadow-sm mb-6"><UserCircle className="h-12 w-12" /></div>
                  <h3 className="text-2xl font-black text-slate-300">{isRtl ? 'اختر عميلاً لعرض سجل التفاعلات' : 'Select a Client to View Dossier'}</h3>
               </div>
            ) : loadingVisits ? (
               <div className="h-[600px] flex flex-col items-center justify-center gap-4 print:hidden">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Indexing Institutional Intelligence...</p>
               </div>
            ) : (
              <PrintWrapper title={isRtl ? "كشف سجل تفاعل العميل والزيارات الميدانية" : "Client Interaction & Field Visit Dossier"}>
                 <div className="space-y-8 text-start">
                    
                    {/* Client Info Header */}
                    <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><LayoutGrid className="h-32 w-32" /></div>
                       <div className="text-start space-y-2 relative z-10">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">{isRtl ? 'العميل المالك' : 'Client Profile'}</p>
                          <h2 className="text-3xl font-black text-slate-900">{selectedClient?.nameAr}</h2>
                          <div className="flex gap-4 items-center">
                             <Badge className="bg-slate-900 text-white border-0 font-black px-4 py-1 rounded-lg uppercase text-[10px] tracking-widest">{selectedClient?.fileNumber}</Badge>
                             <span className="text-slate-400 font-bold text-xs">{selectedClient?.mobile}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-6 relative z-10">
                          <div className="text-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                             <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي المواعيد' : 'Total Visits'}</p>
                             <p className="text-2xl font-black text-slate-900">{visitsData.length}</p>
                          </div>
                          <div className="text-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                             <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'زيارات مكتملة' : 'Completed'}</p>
                             <p className="text-2xl font-black text-emerald-600">{visitsData.filter(v => v.status === 'completed').length}</p>
                          </div>
                       </div>
                    </div>

                    {/* Main Analysis Table */}
                    <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xl">
                       <Table>
                          <TableHeader className="bg-slate-900">
                             <TableRow className="hover:bg-slate-900 border-0">
                                <TableHead className="py-6 ps-8 text-white font-black uppercase text-[10px] tracking-widest w-[140px]">{isRtl ? 'تاريخ الزيارة' : 'Date'}</TableHead>
                                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest w-[100px]">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المخرجات والإنجاز الفني' : 'Technical Achievements'}</TableHead>
                                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'تعليقات وتوجيهات المهندس' : 'Engineer Comments'}</TableHead>
                             </TableRow>
                          </TableHeader>
                          <TableBody>
                             {visitsData.map((visit) => (
                               <TableRow key={visit.id} className={cn(
                                 "hover:bg-slate-50 transition-colors border-b-slate-100",
                                 visit.status === 'cancelled' && "bg-rose-50/20"
                               )}>
                                  <TableCell className="py-6 ps-8 align-top">
                                     <div className="text-start">
                                        <p className="font-black text-slate-900 text-sm">{new Date(visit.start).toLocaleDateString(isRtl ? 'ar-KW' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{new Date(visit.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <div className="mt-3 flex items-center gap-1.5 text-[8px] font-black text-primary uppercase">
                                           <User className="h-2.5 w-2.5" /> {visit.engineerName}
                                        </div>
                                     </div>
                                  </TableCell>
                                  <TableCell className="align-top">
                                     <Badge className={cn(
                                       "font-black text-[8px] uppercase px-2 py-0.5 rounded-md border-0 shadow-sm",
                                       visit.status === 'completed' ? 'bg-emerald-500 text-white' : 
                                       visit.status === 'cancelled' ? 'bg-rose-500 text-white' : 
                                       'bg-blue-500 text-white'
                                     )}>
                                        {visit.status}
                                     </Badge>
                                  </TableCell>
                                  <TableCell className="align-top py-6">
                                     <div className="space-y-2">
                                        {visit.achievements.length > 0 ? visit.achievements.map((ex: any, i: number) => (
                                          <div key={i} className="flex items-start gap-2 bg-emerald-50/40 p-2 rounded-lg border border-emerald-100">
                                             <Hammer className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                                             <div className="text-start">
                                                <p className="text-[10px] font-black text-slate-800 leading-tight">{ex.boqItemName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                   <span className="text-[9px] font-bold text-emerald-700">+{ex.quantity}</span>
                                                   {ex.notes && <span className="text-[8px] text-slate-400 italic">"{ex.notes}"</span>}
                                                </div>
                                             </div>
                                          </div>
                                        )) : (
                                          <span className="text-[9px] text-slate-300 font-bold italic">{isRtl ? 'لم يتم تسجيل إنجاز' : 'No technical logs'}</span>
                                        )}
                                     </div>
                                  </TableCell>
                                  <TableCell className="align-top py-6">
                                     <div className="space-y-3">
                                        {visit.comments.length > 0 ? visit.comments.map((c: any, i: number) => (
                                          <div key={i} className="relative ps-4 border-s-2 border-primary/20">
                                             <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{c.content}</p>
                                             <div className="mt-1 flex items-center gap-1.5 text-[7px] font-black text-slate-300 uppercase">
                                                <UserCircle className="h-2 w-2" /> {c.createdByName}
                                             </div>
                                          </div>
                                        )) : (
                                          <span className="text-[9px] text-slate-300 font-bold italic">{isRtl ? 'لا يوجد ملاحظات مسجلة' : 'No comments logged'}</span>
                                        )}
                                     </div>
                                  </TableCell>
                               </TableRow>
                             ))}
                          </TableBody>
                       </Table>
                    </div>

                    {/* Disclaimer Footnote for Report */}
                    <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner flex items-start gap-4 text-start">
                       <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-1" />
                       <div className="space-y-1">
                          <h5 className="font-black text-xs text-slate-800 uppercase tracking-widest">{isRtl ? 'إقرار صحة البيانات الميدانية' : 'Field Data Validation Statement'}</h5>
                          <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                             {isRtl 
                               ? 'تم استخراج هذا التقرير آلياً من سجلات الميدان الموثقة. كافة الإنجازات والتعليقات تم ربطها بمعرف الموعد (ID) لحظة الحدوث لضمان دقة الأرشفة والامتثال المهني.' 
                               : 'This report is auto-generated from verified field logs. All achievements and comments are linked to the specific appointment ID to ensure archiving accuracy and professional compliance.'}
                          </p>
                       </div>
                    </div>
                 </div>
              </PrintWrapper>
            )}
         </div>

      </div>
    </div>
  );
}

