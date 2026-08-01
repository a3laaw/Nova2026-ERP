'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Loader2, ArrowRight, 
  MapPinned, UserCircle,
  MessageSquare, Hammer, Clock,
  CalendarDays, CheckCircle2,
  Printer, Filter, LayoutGrid, X,
  AlertTriangle, History, ShieldCheck, Phone,
  RotateCcw, HardHat, Camera, Landmark,
  Users, Zap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { Appointment } from '@/types/appointment';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function ClientVisitsReportPage() {
  const { globalUser } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [unifiedTimeline, setUnifiedTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // جلب قائمة العملاء للبحث
  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);
  const { data: allClients, loading: clientsLoading } = useCollection<Client>(clientsQuery);

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return (allClients || []).filter(c => 
      c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.mobile?.includes(searchTerm) ||
      c.fileNumber.includes(searchTerm)
    ).slice(0, 5);
  }, [allClients, searchTerm]);

  // محرك دمج البيانات التخصصي
  useEffect(() => {
    async function fetchFullHistory() {
      if (!selectedClientId || !db || !companyId) return;
      setLoadingTimeline(true);
      try {
        // 1. جلب المواعيد (معماري وقاعات)
        const apptsQuery = query(
          collection(db, paths.appointments(companyId)), 
          where('clientId', '==', selectedClientId)
        );
        const apptsSnap = await getDocs(apptsQuery);
        
        // 2. جلب تقارير الموقع (ميداني)
        const fieldVisitsQuery = query(
          collectionGroup(db, 'fieldVisits'), 
          where('companyId', '==', companyId),
          where('clientId', '==', selectedClientId)
        );
        const fieldSnap = await getDocs(fieldVisitsQuery);

        const appts = apptsSnap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(), 
          entryType: 'appointment',
          displayDate: d.data().start.split('T')[0]
        }));

        const fieldVisits = fieldSnap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(), 
          entryType: 'field_report',
          displayDate: d.data().visitDate
        }));

        const merged = [...appts, ...fieldVisits].sort((a, b) => b.displayDate.localeCompare(a.displayDate));

        // جلب البيانات الإضافية (تعديلات وتعليقات) لكل حركة
        const detailedData = await Promise.all(merged.map(async (item: any) => {
           let revisions: any[] = [];
           let comments: any[] = [];

           if (item.transactionId) {
              const timelineQuery = query(
                 collection(db, paths.transactionTimeline(companyId, item.transactionId)), 
                 where('appointmentId', '==', item.id),
                 where('type', '==', 'revision_logged')
              );
              const timelineSnap = await getDocs(timelineQuery);
              revisions = timelineSnap.docs.map(d => d.data());

              const commentsQuery = query(
                 collection(db, paths.transactionComments(companyId, item.transactionId)), 
                 where('appointmentId', '==', item.id)
              );
              const commentsSnap = await getDocs(commentsQuery);
              comments = commentsSnap.docs.map(d => d.data());
           }
           return { ...item, revisions, comments };
        }));

        setUnifiedTimeline(detailedData);
      } catch (e) {
        console.error("Unified fetch failed", e);
      } finally {
        setLoadingTimeline(false);
      }
    }
    fetchFullHistory();
  }, [selectedClientId, db, companyId]);

  // محرك التبويبات التخصصي المطلوب
  const tabData = useMemo(() => {
    return {
      all: unifiedTimeline,
      field: unifiedTimeline.filter(i => i.entryType === 'field_report'), // التاب الميداني
      architectural: unifiedTimeline.filter(i => i.entryType === 'appointment' && i.type !== 'hall_meeting'), // التاب المعماري
      halls: unifiedTimeline.filter(i => i.entryType === 'appointment' && i.type === 'hall_meeting') // تاب القاعات
    };
  }, [unifiedTimeline]);

  const selectedClient = allClients?.find(c => c.id === selectedClientId);

  const formatSovereignDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRtl ? 'ar-KW' : 'en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const renderTimelineTable = (data: any[]) => (
    <div className="border-2 border-slate-900 rounded-2xl overflow-hidden bg-white shadow-2xl animate-in fade-in duration-500">
      <Table>
        <TableHeader className="bg-slate-900">
          <TableRow className="hover:bg-slate-900 border-0">
            <TableHead className="py-6 ps-8 text-white font-black uppercase text-[10px] tracking-widest w-[180px]">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</TableHead>
            <TableHead className="text-white font-black uppercase text-[10px] tracking-widest w-[140px]">{isRtl ? 'نوع الزيارة' : 'Visit Type'}</TableHead>
            <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'التفاصيل والمخرجات الفنية' : 'Details & Technical Outputs'}</TableHead>
            <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المسؤول الموثق' : 'Responsible Staff'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const isAppt = item.entryType === 'appointment';
            const isHall = item.type === 'hall_meeting';

            return (
              <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                <td className="py-6 ps-8 align-top text-start">
                  <div className="space-y-1">
                    <p className="font-black text-slate-900 text-sm">{formatSovereignDate(item.displayDate)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {isAppt ? new Date(item.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Field Log'}
                    </p>
                  </div>
                </td>
                <td className="align-top py-6 text-start">
                  <Badge className={cn(
                    "font-black text-[8px] uppercase px-4 py-1.5 rounded-lg border-0 shadow-sm",
                    isAppt ? (isHall ? "bg-indigo-600 text-white" : "bg-orange-500 text-white") : "bg-emerald-600 text-white"
                  )}>
                    {isAppt ? (isHall ? (isRtl ? "اجتماع قاعة" : "Hall Session") : (isRtl ? "زيارة معمارية" : "Arch Visit")) : (isRtl ? "تقرير ميداني" : "Field Report")}
                  </Badge>
                </td>
                <td className="align-top py-6 text-start">
                  <div className="space-y-4">
                    {item.entryType === 'field_report' && (
                      <div className="space-y-3">
                        <div className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 flex items-start gap-4 shadow-sm">
                          <HardHat className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-start space-y-1">
                            <p className="text-xs font-black text-slate-800 leading-relaxed">{item.completedWork || (isRtl ? 'توثيق إنجاز ميداني' : 'Site Progress Log')}</p>
                            <div className="flex items-center gap-3 pt-1">
                              <Badge className="bg-emerald-600 text-white font-black text-[8px] h-5 px-3">+{item.progressPercentage}% Completion</Badge>
                              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Users className="h-3 w-3" /> {item.workersCount} Workers</span>
                            </div>
                          </div>
                        </div>
                        {item.photoUrls && item.photoUrls.length > 0 && (
                          <div className="flex gap-2 flex-wrap px-1">
                            {item.photoUrls.map((url: string, i: number) => (
                              <div key={i} className="h-12 w-12 rounded-xl border-2 border-white shadow-md overflow-hidden bg-slate-100 hover:scale-110 transition-transform cursor-pointer">
                                <img src={url} alt="Site" className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {isAppt && (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{item.title}</p>
                        {item.revisions?.length > 0 && item.revisions.map((rev: any, i: number) => (
                          <div key={`rev-${i}`} className="flex items-start gap-3 bg-orange-50/50 p-3 rounded-xl border-2 border-orange-100 animate-in zoom-in-95">
                            <RotateCcw className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                            <div className="text-start">
                               <p className="text-[10px] font-black text-orange-900 uppercase tracking-tighter">Design Revision Logged</p>
                               <p className="text-xs font-bold text-orange-800 mt-0.5">{rev.content}</p>
                            </div>
                          </div>
                        ))}
                        {item.comments?.length > 0 && (
                           <div className="space-y-2 pt-2">
                              {item.comments.map((c: any, i: number) => (
                                <div key={`c-${i}`} className="ps-4 border-s-4 border-primary/20 bg-slate-50/50 p-2 rounded-lg">
                                  <p className="text-[11px] font-bold text-slate-600 italic">"{c.content}"</p>
                                </div>
                              ))}
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="align-top py-6 text-start">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-2xl border-2 border-white shadow-md">
                       <AvatarImage src={`https://picsum.photos/seed/${item.engineerId || item.id}/40/40`} />
                       <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">{item.engineerName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-start">
                      <p className="font-black text-xs text-slate-800">{item.engineerName}</p>
                      <p className="text-[8px] font-black text-primary uppercase mt-0.5 tracking-widest">Sovereign Authority</p>
                    </div>
                  </div>
                </td>
              </TableRow>
            );
          })}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-32 text-center text-slate-300 italic font-bold">
                {isRtl ? 'لا يوجد سجلات تخصصية في هذا القسم للعميل المختار.' : 'No specialized records found in this section.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20" dir={dir}>
      <div className="flex flex-col gap-6 print:hidden">
        <div className="text-start">
           <h1 className="text-4xl font-black font-headline flex items-center gap-3 text-slate-900">
             <History className="h-12 w-12 text-primary" />
             {isRtl ? 'سجل تفاعل العملاء الشامل' : 'Universal Client Dossier'}
           </h1>
           <p className="text-muted-foreground font-bold text-sm opacity-70 italic">
              {isRtl ? 'رادار موحد يدمج الزيارات المعمارية، القاعات، والتقارير الميدانية لضمان السيادة المعلوماتية.' : 'Unified radar merging architectural, halls, and field visits.'}
           </p>
        </div>

        <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-visible z-50">
           <CardContent className="p-8">
              <div className="relative max-w-2xl mx-auto">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 block text-start">
                    {isRtl ? 'البحث عن عميل بالاسم أو الهاتف' : 'Search Client by Name or Phone'}
                 </Label>
                 <div className="relative">
                    <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                    <Input 
                      placeholder={isRtl ? 'اكتب اسم العميل أو رقم هاتفه...' : 'Search by name or phone...'} 
                      className="h-16 rounded-2xl border-2 border-slate-100 ps-14 text-xl font-bold bg-slate-50 focus:bg-white focus:border-primary/40 transition-all shadow-inner" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
                 {filteredClients.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-3xl border-2 border-slate-50 overflow-hidden animate-in zoom-in-95 duration-200">
                      {filteredClients.map(c => (
                        <div key={c.id} onClick={() => { setSelectedClientId(c.id!); setSearchTerm(""); }} className="p-5 hover:bg-primary/5 cursor-pointer transition-all border-b last:border-0 flex items-center justify-between group">
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
           <UserCircle className="h-32 w-32 text-slate-200 mb-4" />
           <p className="text-2xl font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'يرجى اختيار عميل لبدء التحليل الشامل' : 'Select Client to begin full audit'}</p>
        </div>
      ) : loadingTimeline ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 print:hidden">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Merging Sovereign Site Logs (123 Scale)...</p>
        </div>
      ) : (
        <PrintWrapper title={isRtl ? "كشف سجل تفاعل العميل الشامل" : "Universal Client Dossier Statement"}>
           <div className="space-y-10">
              <div className="p-10 rounded-[3rem] bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden text-start shadow-2xl">
                 <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-48 w-48 text-primary" /></div>
                 <div className="space-y-3 relative z-10">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{isRtl ? 'ملف العميل المعتمد' : 'Client Authority Record'}</p>
                    <h2 className="text-4xl font-black font-headline">{selectedClient?.nameAr}</h2>
                    <div className="flex gap-4 items-center">
                       <Badge className="bg-primary text-white border-0 font-black px-6 py-1.5 rounded-xl uppercase text-[11px] tracking-widest shadow-lg">{selectedClient?.fileNumber}</Badge>
                       <span className="text-slate-400 font-bold text-sm flex items-center gap-2 border-s border-white/10 ps-4"><Phone className="h-4 w-4" /> {selectedClient?.mobile}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="text-center bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 min-w-[150px] shadow-2xl">
                       <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Audit Entries</p>
                       <p className="text-4xl font-black text-white font-mono">{unifiedTimeline.length}</p>
                    </div>
                 </div>
              </div>

              {/* نظام التبويبات التخصصي المطلوب (الميداني، المعماري، القاعات) */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white border-2 border-slate-100 p-1.5 rounded-2xl h-16 w-full md:w-fit gap-2 shadow-xl mb-10 print:hidden ring-1 ring-black/[0.02]">
                   <TabsTrigger value="all" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all gap-2 h-full">
                      <LayoutGrid className="h-4 w-4" /> {isRtl ? 'الكل' : 'Combined'}
                   </TabsTrigger>
                   <TabsTrigger value="field" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all gap-2 h-full">
                      <HardHat className="h-4 w-4" /> {isRtl ? 'الميداني' : 'Field'}
                   </TabsTrigger>
                   <TabsTrigger value="architectural" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-2 h-full">
                      <Zap className="h-4 w-4" /> {isRtl ? 'المعماري' : 'Arch'}
                   </TabsTrigger>
                   <TabsTrigger value="halls" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all gap-2 h-full">
                      <Landmark className="h-4 w-4" /> {isRtl ? 'القاعات' : 'Halls'}
                   </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.all)}</TabsContent>
                <TabsContent value="field" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.field)}</TabsContent>
                <TabsContent value="architectural" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.architectural)}</TabsContent>
                <TabsContent value="halls" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.halls)}</TabsContent>
              </Tabs>

              <div className="p-10 rounded-[3rem] bg-slate-50 border-2 border-dashed border-primary/20 flex items-start gap-6 text-start shadow-inner">
                 <ShieldCheck className="h-8 w-8 text-primary shrink-0 mt-1" />
                 <div className="space-y-2">
                    <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest">{isRtl ? 'إقرار وحدة المرجع المعلوماتي' : 'Unified Data Integrity Clause'}</h5>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                       {isRtl 
                         ? 'هذا التقرير هو المرجع السيادي الوحيد لكافة حركات العميل الموثقة بنظام الأرقام القياسية (123). يتم دمج سجلات رادار الميدان ورادار القاعات ورادار المعماري آلياً لضمان عدم حدوث تضارب في المسؤوليات أو المواعيد، ولتمكين الإدارة من مراجعة جودة الخدمة المقدمة للعميل في كافة مراحل التعاقد والتنفيذ.' 
                         : 'This report is the sole sovereign reference for all client interactions indexed by 123 standards. Field, Hall, and Arch logs are merged automatically to prevent responsibility overlaps and enable executive quality audits across all contracting and execution stages.'}
                    </p>
                 </div>
              </div>
           </div>
        </PrintWrapper>
      )}
    </div>
  );
}
