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
  Users, Zap, ExternalLink
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, orderBy, collectionGroup } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [indexError, setIndexError] = useState<string | null>(null);

  // تثبيت كائن الاستعلام لمنع أخطاء استقرار الحالة ca9
  const clientsQuery = useMemo(() => {
    if (!companyId || !db) return null;
    return query(collection(db, paths.clients(companyId)), orderBy('nameAr'));
  }, [db, companyId]);

  const { data: allClients, loading: clientsLoading } = useCollection<Client>(clientsQuery);

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return (allClients || []).filter(c => 
      c.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.mobile?.includes(searchTerm) ||
      c.fileNumber.includes(searchTerm)
    ).slice(0, 5);
  }, [allClients, searchTerm]);

  useEffect(() => {
    let isMounted = true;
    async function fetchFullHistory() {
      if (!selectedClientId || !db || !companyId) return;
      setLoadingTimeline(true);
      setIndexError(null);
      try {
        const apptsQuery = query(
          collection(db, paths.appointments(companyId)), 
          where('clientId', '==', selectedClientId)
        );
        const apptsSnap = await getDocs(apptsQuery);
        
        // جلب تقارير الموقع - محمي ضد غياب الفهارس
        const fieldVisitsQuery = query(
          collectionGroup(db, 'fieldVisits'), 
          where('companyId', '==', companyId),
          where('clientId', '==', selectedClientId)
        );
        
        let fieldSnap: any = { docs: [] };
        try {
          fieldSnap = await getDocs(fieldVisitsQuery);
        } catch (e: any) {
          if (e.message.includes('index')) {
            setIndexError(e.message);
          }
        }

        if (!isMounted) return;

        const appts = apptsSnap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(), 
          entryType: 'appointment',
          displayDate: d.data().start.split('T')[0]
        }));

        const fieldVisits = fieldSnap.docs.map((d: any) => ({ 
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

        if (isMounted) {
           setUnifiedTimeline(detailedData);
        }
      } catch (e) {
        console.error("Unified fetch failed", e);
      } finally {
        if (isMounted) setLoadingTimeline(false);
      }
    }
    fetchFullHistory();
    return () => { isMounted = false; };
  }, [selectedClientId, db, companyId]);

  const tabData = useMemo(() => {
    return {
      all: unifiedTimeline,
      field: unifiedTimeline.filter(i => i.entryType === 'field_report'),
      architectural: unifiedTimeline.filter(i => i.entryType === 'appointment' && i.type !== 'hall_meeting'),
      halls: unifiedTimeline.filter(i => i.entryType === 'appointment' && i.type === 'hall_meeting')
    };
  }, [unifiedTimeline]);

  const selectedClient = allClients?.find(c => c.id === selectedClientId);

  const renderTimelineTable = (data: any[]) => (
    <div className="border-2 border-primary/10 rounded-3xl overflow-hidden bg-white shadow-xl animate-in fade-in duration-500">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow className="hover:bg-slate-50 border-0">
            <TableHead className="py-6 ps-8 text-primary font-black uppercase text-[10px] tracking-widest w-[180px]">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</TableHead>
            <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest w-[140px]">{isRtl ? 'نوع الزيارة' : 'Visit Type'}</TableHead>
            <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest">{isRtl ? 'التفاصيل والمخرجات الفنية' : 'Details & Technical Outputs'}</TableHead>
            <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest">{isRtl ? 'المسؤول الموثق' : 'Responsible Staff'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const isAppt = item.entryType === 'appointment';
            const isHall = item.type === 'hall_meeting';

            return (
              <TableRow key={item.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-100">
                <td className="py-6 ps-8 align-top text-start">
                  <div className="space-y-1">
                    <p className="font-black text-slate-800 text-sm">{item.displayDate}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {isAppt ? new Date(item.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Field Log'}
                    </p>
                  </div>
                </td>
                <td className="align-top py-6 text-start">
                  <Badge className={cn(
                    "font-black text-[8px] uppercase px-4 py-1.5 rounded-lg border-0 shadow-sm",
                    isAppt ? (isHall ? "bg-secondary text-white" : "bg-primary text-white") : "bg-emerald-600 text-white"
                  )}>
                    {isAppt ? (isHall ? (isRtl ? "اجتماع قاعة" : "Hall Session") : (isRtl ? "زيارة معمارية" : "Arch Visit")) : (isRtl ? "تقرير ميداني" : "Field Report")}
                  </Badge>
                </td>
                <td className="align-top py-6 text-start">
                  <div className="space-y-4">
                    {item.entryType === 'field_report' && (
                      <div className="space-y-3">
                        <div className="p-5 bg-emerald-50/30 rounded-2xl border-2 border-emerald-100 flex items-start gap-4">
                          <HardHat className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-start space-y-1">
                            <p className="text-xs font-bold text-slate-700 leading-relaxed">{item.completedWork || (isRtl ? 'توثيق إنجاز ميداني' : 'Site Progress Log')}</p>
                            <div className="flex items-center gap-3 pt-1">
                              <Badge className="bg-emerald-600 text-white font-black text-[8px] h-5 px-3">+{item.progressPercentage}% Completion</Badge>
                            </div>
                          </div>
                        </div>
                        {item.photoUrls && item.photoUrls.length > 0 && (
                          <div className="flex gap-2 flex-wrap px-1">
                            {item.photoUrls.map((url: string, i: number) => (
                              <div key={i} className="h-12 w-12 rounded-xl border-2 border-white shadow-md overflow-hidden hover:scale-110 transition-transform cursor-pointer">
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
                          <div key={`rev-${i}`} className="flex items-start gap-3 bg-accent/10 p-3 rounded-xl border-2 border-accent/20">
                            <RotateCcw className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="text-start">
                               <p className="text-[10px] font-black text-primary uppercase">Design Revision Logged</p>
                               <p className="text-xs font-bold text-slate-600 mt-0.5">{rev.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="align-top py-6 text-start">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-2xl border-2 border-white shadow-md">
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
                {isRtl ? 'لا يوجد سجلات في هذا القسم.' : 'No specialized records found.'}
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
              رؤية موحدة لرحلة العميل من التصميم المعماري إلى التسليم الميداني.
           </p>
        </div>

        {indexError && (
          <div className="p-6 bg-orange-50 border-4 border-orange-100 rounded-[2rem] text-start space-y-4 shadow-xl">
             <div className="flex items-center gap-3 text-[#f97316]">
                <AlertTriangle className="h-8 w-8" />
                <h3 className="text-xl font-black">تنبيه: يتطلب النظام إنشاء فهرس سحابي</h3>
             </div>
             <p className="text-sm font-bold text-slate-700 leading-relaxed">
               يرجى الضغط على الرابط أدناه لمرة واحدة لتمكين البحث الشامل في سجلات الميدان والمكتب. هذا إجراء تقني لضمان سرعة البحث في السحاب:
             </p>
             <Button className="bg-white border-2 border-orange-200 text-[#f97316] font-bold h-12 shadow-sm hover:bg-orange-50" onClick={() => window.open(indexError.split(': ')[1], '_blank')}>
                إنشاء الفهرس الآن في Firebase Console
             </Button>
          </div>
        )}

        <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-visible z-50">
           <CardContent className="p-8">
              <div className="relative max-w-2xl mx-auto">
                 <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 block text-start">
                    البحث عن عميل بالاسم أو الهاتف
                 </Label>
                 <div className="relative">
                    <Search className="absolute start-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                    <Input 
                      placeholder="اكتب اسم العميل..." 
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
                              <p className="text-xs font-bold text-slate-400">{c.fileNumber} • {c.mobile}</p>
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
           <p className="text-2xl font-black text-slate-400 uppercase tracking-widest">اختر عميلاً لبدء مراجعة السجل</p>
        </div>
      ) : loadingTimeline ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 print:hidden">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">دمج السجلات السيادية...</p>
        </div>
      ) : (
        <PrintWrapper title={isRtl ? "كشف سجل تفاعل العميل الشامل" : "Universal Client Dossier Statement"}>
           <div className="space-y-10">
              <div className="p-10 rounded-[3rem] bg-white border-2 border-primary/10 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden text-start shadow-xl">
                 <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-48 w-48 text-primary" /></div>
                 <div className="space-y-3 relative z-10">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">ملف العميل المعتمد</p>
                    <h2 className="text-4xl font-black font-headline text-slate-900">{selectedClient?.nameAr}</h2>
                    <div className="flex gap-4 items-center">
                       <Badge className="bg-primary text-white border-0 font-black px-6 py-1.5 rounded-xl uppercase text-[11px] shadow-lg">{selectedClient?.fileNumber}</Badge>
                       <span className="text-slate-400 font-bold text-sm border-s border-primary/20 ps-4">{selectedClient?.mobile}</span>
                    </div>
                 </div>
                 <div className="relative z-10">
                    <div className="text-center bg-primary/5 p-6 rounded-3xl border-2 border-white shadow-inner min-w-[150px]">
                       <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total Entries</p>
                       <p className="text-4xl font-black text-primary font-mono">{unifiedTimeline.length}</p>
                    </div>
                 </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-50 border-2 border-primary/5 p-1.5 rounded-2xl h-16 w-full md:w-fit gap-2 shadow-sm mb-10 print:hidden">
                   <TabsTrigger value="all" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                      <LayoutGrid className="h-4 w-4" /> الكل
                   </TabsTrigger>
                   <TabsTrigger value="field" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all gap-2 h-full">
                      <HardHat className="h-4 w-4" /> الميداني
                   </TabsTrigger>
                   <TabsTrigger value="architectural" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-2 h-full">
                      <Zap className="h-4 w-4" /> المعماري
                   </TabsTrigger>
                   <TabsTrigger value="halls" className="rounded-xl font-black text-xs px-8 data-[state=active]:bg-secondary data-[state=active]:text-white transition-all gap-2 h-full">
                      <Landmark className="h-4 w-4" /> القاعات
                   </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.all)}</TabsContent>
                <TabsContent value="field" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.field)}</TabsContent>
                <TabsContent value="architectural" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.architectural)}</TabsContent>
                <TabsContent value="halls" className="animate-in fade-in zoom-in-95">{renderTimelineTable(tabData.halls)}</TabsContent>
              </Tabs>
           </div>
        </PrintWrapper>
      )}
    </div>
  );
}
