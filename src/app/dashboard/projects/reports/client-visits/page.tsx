'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Loader2, ArrowRight, 
  MapPinned, UserCircle, Calculator,
  MessageSquare, Hammer, Clock,
  CalendarDays, CheckCircle2,
  Printer, Filter, LayoutGrid, X,
  XCircle, AlertTriangle, FileText,
  User, History, ShieldCheck, Phone,
  RotateCcw, HardHat, Camera, Landmark,
  Layers, Zap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { Appointment } from '@/types/appointment';
import { FieldVisit } from '@/types/field-visit';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PrintWrapper } from '@/components/layout/print-wrapper';

/**
 * @fileOverview سجل تفاعل العملاء الشامل (Sovereign Universal Client Dossier).
 * تم تحديثه لدعم التبويبات المنفصلة (Tabs) لكل نوع من أنواع التفاعل.
 */
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

  // 1. جلب قائمة العملاء للبحث العلوي
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

  // 2. محرك دمج البيانات الشامل
  useEffect(() => {
    async function fetchFullHistory() {
      if (!selectedClientId || !db || !companyId) return;
      setLoadingTimeline(true);
      try {
        const apptsQuery = query(
          collection(db, paths.appointments(companyId)), 
          where('clientId', '==', selectedClientId)
        );
        const apptsSnap = await getDocs(apptsQuery);
        
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

  // 3. محرك الفلترة للتابات
  const tabData = useMemo(() => {
    return {
      all: unifiedTimeline,
      field: unifiedTimeline.filter(i => i.entryType === 'field_report'),
      meetings: unifiedTimeline.filter(i => i.entryType === 'appointment' && i.type !== 'hall_meeting'),
      halls: unifiedTimeline.filter(i => i.entryType === 'appointment' && i.type === 'hall_meeting')
    };
  }, [unifiedTimeline]);

  const selectedClient = allClients?.find(c => c.id === selectedClientId);

  const formatSovereignDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const renderTimelineTable = (data: any[]) => (
    <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xl animate-in fade-in duration-300">
      <Table>
        <TableHeader className="bg-slate-900">
          <TableRow className="hover:bg-slate-900 border-0">
            <TableHead className="py-6 ps-8 text-white font-black uppercase text-[10px] tracking-widest w-[160px]">{isRtl ? 'التاريخ' : 'Date'}</TableHead>
            <TableHead className="text-white font-black uppercase text-[10px] tracking-widest w-[120px]">{isRtl ? 'النوع' : 'Category'}</TableHead>
            <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المخرجات الفنية / الإنجاز' : 'Outputs & Progress'}</TableHead>
            <TableHead className="text-white font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المهندس / التوثيق' : 'Engineer / Log'}</TableHead>
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
                      {isAppt ? new Date(item.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Site Log'}
                    </p>
                  </div>
                </td>
                <td className="align-top py-6 text-start">
                  <Badge className={cn(
                    "font-black text-[8px] uppercase px-3 py-1 rounded-md border-0 shadow-sm",
                    isAppt ? (isHall ? "bg-indigo-500 text-white" : "bg-blue-500 text-white") : "bg-emerald-500 text-white"
                  )}>
                    {isAppt ? (isHall ? "Hall Meeting" : "Site Visit") : "Field Report"}
                  </Badge>
                </td>
                <td className="align-top py-6 text-start">
                  <div className="space-y-3">
                    {item.entryType === 'field_report' && (
                      <div className="space-y-2">
                        <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-start gap-3">
                          <Hammer className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-start">
                            <p className="text-[11px] font-black text-slate-800 leading-tight">{item.completedWork || (isRtl ? 'تقرير إنجاز موقع' : 'Site Progress Report')}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-600 font-black text-[9px] h-5 px-2">+{item.progressPercentage}% Progress</Badge>
                              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Users className="h-3 w-3" /> {item.workersCount} Workers</span>
                            </div>
                          </div>
                        </div>
                        {item.photoUrls && item.photoUrls.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            {item.photoUrls.slice(0, 4).map((url: string, i: number) => (
                              <div key={i} className="h-10 w-10 rounded-lg border-2 border-white shadow-sm overflow-hidden bg-slate-100">
                                <img src={url} alt="Site" className="h-full w-full object-cover" />
                              </div>
                            ))}
                            {item.photoUrls.length > 4 && <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[9px] font-black">+{item.photoUrls.length - 4}</div>}
                          </div>
                        )}
                      </div>
                    )}
                    {isAppt && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">{item.title}</p>
                        {item.revisions?.length > 0 && item.revisions.map((rev: any, i: number) => (
                          <div key={`rev-${i}`} className="flex items-start gap-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                            <RotateCcw className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-black text-amber-800 leading-tight">{rev.content}</p>
                          </div>
                        ))}
                        {item.comments?.length > 0 && item.comments.map((c: any, i: number) => (
                          <div key={`c-${i}`} className="ps-4 border-s-2 border-primary/20">
                            <p className="text-[11px] font-medium text-slate-500 italic">"{c.content}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="align-top py-6 text-start">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-400">
                      <HardHat className="h-5 w-5" />
                    </div>
                    <div className="text-start">
                      <p className="font-black text-xs text-slate-800">{item.engineerName}</p>
                      <p className="text-[8px] font-black text-primary uppercase mt-0.5">Sovereign Signature</p>
                    </div>
                  </div>
                </td>
              </TableRow>
            );
          })}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-20 text-center text-slate-300 italic font-bold">
                {isRtl ? 'لا توجد سجلات في هذا القسم.' : 'No records in this section.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir={dir}>
      <div className="flex flex-col gap-6 print:hidden">
        <div className="text-start">
           <h1 className="text-3xl font-black font-headline flex items-center gap-3 text-slate-900">
             <History className="h-10 w-10 text-primary" />
             {isRtl ? 'سجل تفاعل العملاء (Universal Dossier)' : 'Unified Client Ledger'}
           </h1>
           <p className="text-muted-foreground font-bold text-sm opacity-70 italic">
              {isRtl ? 'تتبع تاريخ العميل الموحد: لقاءات، قاعات، وتقارير إنجاز ميدانية.' : 'Track unified history: meetings, halls, and field progress.'}
           </p>
        </div>

        <Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-black/5 overflow-visible z-50">
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
           <UserCircle className="h-24 w-24 text-slate-200 mb-4" />
           <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'يرجى اختيار عميل لبدء التحليل' : 'Select Client to begin dossier'}</p>
        </div>
      ) : loadingTimeline ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 print:hidden">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Merging All Site Logs (Standard 123)...</p>
        </div>
      ) : (
        <PrintWrapper title={isRtl ? "كشف سجل تفاعل العميل الموحد" : "Universal Client Interaction Ledger"}>
           <div className="space-y-10">
              <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-white shadow-inner flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden text-start">
                 <div className="space-y-2 relative z-10">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">{isRtl ? 'ملف العميل المالك' : 'Client Profile'}</p>
                    <h2 className="text-3xl font-black text-slate-900">{selectedClient?.nameAr}</h2>
                    <div className="flex gap-4 items-center">
                       <Badge className="bg-slate-900 text-white border-0 font-black px-4 py-1 rounded-lg uppercase text-[10px] tracking-widest">{selectedClient?.fileNumber}</Badge>
                       <span className="text-slate-400 font-bold text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedClient?.mobile}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 relative z-10">
                    <div className="text-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100 min-w-[120px]">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Interactions</p>
                       <p className="text-3xl font-black text-slate-900">{unifiedTimeline.length}</p>
                    </div>
                 </div>
              </div>

              {/* Tabs System for different visit types */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white border-2 border-slate-100 p-1 rounded-xl h-14 w-full md:w-fit gap-2 shadow-sm mb-6 print:hidden">
                   <TabsTrigger value="all" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all gap-2 h-full">
                      <LayoutGrid className="h-4 w-4" /> {isRtl ? 'الكل' : 'All'}
                   </TabsTrigger>
                   <TabsTrigger value="field" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all gap-2 h-full">
                      <HardHat className="h-4 w-4" /> {isRtl ? 'الميدانية' : 'Field Reports'}
                   </TabsTrigger>
                   <TabsTrigger value="meetings" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all gap-2 h-full">
                      <CalendarDays className="h-4 w-4" /> {isRtl ? 'اللقاءات' : 'Meetings'}
                   </TabsTrigger>
                   <TabsTrigger value="halls" className="rounded-lg font-black text-xs px-8 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all gap-2 h-full">
                      <Landmark className="h-4 w-4" /> {isRtl ? 'القاعات' : 'Halls'}
                   </TabsTrigger>
                </TabsList>

                <TabsContent value="all">{renderTimelineTable(tabData.all)}</TabsContent>
                <TabsContent value="field">{renderTimelineTable(tabData.field)}</TabsContent>
                <TabsContent value="meetings">{renderTimelineTable(tabData.meetings)}</TabsContent>
                <TabsContent value="halls">{renderTimelineTable(tabData.halls)}</TabsContent>
              </Tabs>

              <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-primary/20 flex items-start gap-4 text-start">
                 <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-1" />
                 <div className="space-y-1">
                    <h5 className="font-black text-xs text-slate-800 uppercase tracking-widest">{isRtl ? 'إقرار صحة البيانات الموحدة' : 'Unified Data Validation'}</h5>
                    <p className="text-[9px] text-slate-400 font-bold leading-relaxed italic">
                       {isRtl 
                         ? 'تم استخراج هذا التقرير الشامل بنظام الأرقام القياسية الموحد (123). يدمج هذا السجل كافة الحركات الميدانية والمكتبية المسجلة للعميل عبر كافة موديولات النظام لضمان شفافية الأداء والرقابة.' 
                         : 'Universal report generated in 123 standard numerals. This dossier merges all field and office interactions recorded for the client across all system modules to ensure performance transparency and oversight.'}
                    </p>
                 </div>
              </div>
           </div>
        </PrintWrapper>
      )}
    </div>
  );
}
