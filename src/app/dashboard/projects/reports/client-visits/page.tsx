
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
  User, History, ShieldCheck, Phone,
  RotateCcw
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { Appointment } from '@/types/appointment';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PrintWrapper } from '@/components/layout/print-wrapper';

/**
 * @fileOverview تقرير سجل تفاعل العملاء (The Sovereign Visit Dossier V2).
 * واجهة مبسطة مع بحث علوي بالاسم/الهاتف وجدول مخرجات شامل يشمل التعديلات الفنية.
 * فرض الأرقام القياسية (123) في كافة البيانات.
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

  // 1. جلب قائمة العملاء للبحث
  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);
  const { data: allClients, loading: clientsLoading } = useCollection<Client>(clientsQuery);

  // 2. تصفية قائمة العملاء للبحث العلوي
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return (allClients || []).filter(c => 
      c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.mobile?.includes(searchTerm) ||
      c.fileNumber.includes(searchTerm)
    ).slice(0, 5); // عرض أول 5 نتائج فقط كقائمة منبثقة
  }, [allClients, searchTerm]);

  // 3. محرك جلب بيانات الزيارات الشامل (Deep Visit Analytics)
  useEffect(() => {
    async function fetchFullHistory() {
      if (!selectedClientId || !db || !companyId) return;
      setLoadingVisits(true);
      try {
        const apptsRef = collection(db, paths.appointments(companyId));
        const apptsQuery = query(apptsRef, where('clientId', '==', selectedClientId));
        const apptsSnap = await getDocs(apptsQuery);
        
        const allAppts = apptsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Appointment))
          .sort((a, b) => b.start.localeCompare(a.start));

        const fullData = await Promise.all(allAppts.map(async (appt) => {
           // جلب الإنجازات (كميات BOQ)
           const execsRef = collection(db, paths.executions(companyId));
           const execsQuery = query(execsRef, where('appointmentId', '==', appt.id));
           const execsSnap = await getDocs(execsQuery);
           const achievements = execsSnap.docs.map(d => d.data());

           // جلب التعديلات الفنية (Revisions) من التايم لاين
           let revisions: any[] = [];
           if (appt.transactionId) {
              const timelineRef = collection(db, paths.transactionTimeline(companyId, appt.transactionId));
              const timelineQuery = query(timelineRef, where('appointmentId', '==', appt.id), where('type', '==', 'revision_logged'));
              const timelineSnap = await getDocs(timelineQuery);
              revisions = timelineSnap.docs.map(d => d.data());
           }

           // جلب التعليقات البشرية
           let comments: any[] = [];
           if (appt.transactionId) {
              const commentsRef = collection(db, paths.transactionComments(companyId, appt.transactionId));
              const commentsQuery = query(commentsRef, where('appointmentId', '==', appt.id));
              const commentsSnap = await getDocs(commentsQuery);
              comments = commentsSnap.docs.map(d => d.data()).filter(c => c.commentType !== 'note'); // استبعاد الملاحظات التي تم جلبها كتعديلات
           }

           return { ...appt, achievements, revisions, comments };
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

  const selectedClient = allClients?.find(c => c.id === selectedClientId);

  // دالة لتنسيق التاريخ بالأرقام القياسية (123) دوماً
  const formatSovereignDate = (dateIso: string) => {
    return new Date(dateIso).toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      
      {/* Search Header */}
      <div className="flex flex-col gap-6 print:hidden">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <History className="h-10 w-10 text-primary" />
             {isRtl ? 'سجل تفاعل العملاء (Dossier)' : 'Client Interaction Ledger'}
           </h1>
        </div>

        <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-visible z-50">
           <CardContent className="p-8">
              <div className="relative max-w-2xl mx-auto">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 block text-start">
                    {isRtl ? 'البحث عن عميل (بالاسم أو الهاتف)' : 'Search Client (Name or Mobile)'}
                 </Label>
                 <div className="relative">
                    <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                    <Input 
                      placeholder={isRtl ? 'اكتب اسم العميل أو رقم هاتفه هنا...' : 'Search by name or phone...'} 
                      className="h-16 rounded-2xl border-2 border-slate-100 ps-14 text-xl font-bold bg-slate-50 focus:bg-white focus:border-primary/40 transition-all shadow-inner" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>

                 {filteredClients.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-3xl border-2 border-slate-50 overflow-hidden animate-in zoom-in-95 duration-200">
                      {filteredClients.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => {
                            setSelectedClientId(c.id!);
                            setSearchTerm("");
                          }}
                          className="p-5 hover:bg-primary/5 cursor-pointer transition-all border-b last:border-0 flex items-center justify-between group"
                        >
                           <div className="text-start">
                              <p className="font-black text-slate-800 text-lg group-hover:text-primary transition-colors">{c.nameAr}</p>
                              <div className="flex items-center gap-4 mt-1">
                                 <span className="text-xs font-mono font-bold text-slate-400">{c.fileNumber}</span>
                                 <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {c.mobile}</span>
                              </div>
                           </div>
                           <ArrowRight className={cn("h-5 w-5 text-slate-200 group-hover:text-primary transition-all", isRtl && "rotate-180")} />
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           </CardContent>
        </Card>
      </div>

      {!selectedClientId ? (
        <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-30 animate-pulse print:hidden">
           <UserCircle className="h-24 w-24 text-slate-200 mb-4" />
           <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'يرجى اختيار عميل لبدء التقرير' : 'Select Client to start report'}</p>
        </div>
      ) : loadingVisits ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 print:hidden">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Analyzing Field Data (123 Scale)...</p>
        </div>
      ) : (
        <PrintWrapper title={isRtl ? "كشف سجل تفاعل العميل والزيارات" : "Client Interaction Dossier"}>
           <div className="space-y-8">
              
              {/* Report Hero */}
              <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-white shadow-inner flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden text-start">
                 <div className="space-y-2 relative z-10">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">{isRtl ? 'العميل المالك' : 'Client Profile'}</p>
                    <h2 className="text-3xl font-black text-slate-900">{selectedClient?.nameAr}</h2>
                    <div className="flex gap-4 items-center">
                       <Badge className="bg-slate-900 text-white border-0 font-black px-4 py-1 rounded-lg uppercase text-[10px] tracking-widest">{selectedClient?.fileNumber}</Badge>
                       <span className="text-slate-400 font-bold text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedClient?.mobile}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="text-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'إجمالي المواعيد' : 'Total Visits'}</p>
                       <p className="text-2xl font-black text-slate-900">{visitsData.length}</p>
                    </div>
                    <div className="text-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{isRtl ? 'مكتملة' : 'Completed'}</p>
                       <p className="text-2xl font-black text-emerald-600">{visitsData.filter(v => v.status === 'completed').length}</p>
                    </div>
                 </div>
              </div>

              {/* Main Ledger Table */}
              <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xl">
                 <Table>
                    <TableHeader className="bg-slate-900">
                       <TableRow className="hover:bg-slate-900 border-0">
                          <TableHead className="py-6 ps-8 text-white font-black uppercase text-[10px] tracking-widest w-[150px]">{isRtl ? 'تاريخ الزيارة' : 'Visit Date'}</TableHead>
                          <TableHead className="text-white font-black uppercase text-[10px] tracking-widest w-[100px]">{isRtl ? 'الحالة' : 'Status'}</TableHead>
                          <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المخرجات والإنجاز الفني / التعديلات' : 'Technical Achievements & Revisions'}</TableHead>
                          <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'ملاحظات وتوجيهات المهندس' : 'Engineer Notes'}</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {visitsData.map((visit) => (
                         <TableRow key={visit.id} className={cn(
                           "hover:bg-slate-50 transition-colors border-b-slate-100",
                           visit.status === 'cancelled' && "bg-rose-50/20"
                         )}>
                            <TableCell className="py-6 ps-8 align-top text-start">
                               <div className="space-y-1">
                                  <p className="font-black text-slate-900 text-sm">{formatSovereignDate(visit.start)}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(visit.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                  <div className="mt-3 flex items-center gap-1.5 text-[8px] font-black text-primary uppercase">
                                     <User className="h-2.5 w-2.5" /> {visit.engineerName}
                                  </div>
                               </div>
                            </TableCell>
                            <TableCell className="align-top text-start">
                               <Badge className={cn(
                                 "font-black text-[8px] uppercase px-2 py-0.5 rounded-md border-0 shadow-sm",
                                 visit.status === 'completed' ? "bg-emerald-500 text-white" : 
                                 visit.status === 'cancelled' ? "bg-rose-500 text-white" : 
                                 'bg-blue-500 text-white'
                               )}>
                                  {visit.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="align-top py-6 text-start">
                               <div className="space-y-2">
                                  {/* 1. الإنجازات الكمية (BOQ) */}
                                  {visit.achievements.length > 0 && visit.achievements.map((ex: any, i: number) => (
                                    <div key={`ex-${i}`} className="flex items-start gap-2 bg-emerald-50/40 p-2 rounded-lg border border-emerald-100">
                                       <Hammer className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                                       <div className="text-start">
                                          <p className="text-[10px] font-black text-slate-800 leading-tight">{ex.boqItemName}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                             <span className="text-[9px] font-bold text-emerald-700">+{ex.quantity}</span>
                                             {ex.notes && <span className="text-[8px] text-slate-400 italic">"{ex.notes}"</span>}
                                          </div>
                                       </div>
                                    </div>
                                  ))}
                                  
                                  {/* 2. تعديلات التصميم (Revisions) */}
                                  {visit.revisions.length > 0 && visit.revisions.map((rev: any, i: number) => (
                                    <div key={`rev-${i}`} className="flex items-start gap-2 bg-amber-50/40 p-2 rounded-lg border border-amber-100">
                                       <RotateCcw className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                                       <div className="text-start">
                                          <p className="text-[10px] font-black text-slate-800 leading-tight">{isRtl ? 'تعديل مخطط / مراجعة فنية' : 'Design Revision'}</p>
                                          <p className="text-[9px] font-bold text-amber-700 mt-1">{rev.content}</p>
                                       </div>
                                    </div>
                                  ))}

                                  {visit.achievements.length === 0 && visit.revisions.length === 0 && (
                                    <span className="text-[9px] text-slate-300 font-bold italic">{isRtl ? 'لم يتم تسجيل مخرجات فنية' : 'No technical outputs'}</span>
                                  )}
                               </div>
                            </TableCell>
                            <TableCell className="align-top py-6 text-start">
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

              {/* Disclaimer Footnote */}
              <div className="p-8 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner flex items-start gap-4 text-start">
                 <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-1" />
                 <div className="space-y-1">
                    <h5 className="font-black text-xs text-slate-800 uppercase tracking-widest">{isRtl ? 'إقرار صحة البيانات الميدانية' : 'Field Data Validation Statement'}</h5>
                    <p className="text-[9px] text-slate-400 font-bold leading-relaxed italic">
                       {isRtl 
                         ? 'تم استخراج هذا التقرير آلياً بنظام الأرقام القياسية (123). كافة المخرجات الفنية بما فيها تعديلات التصميم تم ربطها بمعرف الموعد (ID) لحظة الحدوث لضمان دقة الأرشفة والامتثال المهني.' 
                         : 'Report auto-generated in 123 standard numerals. All technical outputs including design revisions are linked to appointment IDs to ensure archiving accuracy.'}
                    </p>
                 </div>
              </div>
           </div>
        </PrintWrapper>
      )}
    </div>
  );
}
