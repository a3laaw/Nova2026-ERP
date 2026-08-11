'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, ArrowRight, HardHat, Target, Users, 
  Truck, CheckCircle2, ShieldCheck, Printer,
  LayoutGrid, Save, MessageSquare, ShieldAlert,
  Workflow, History, Landmark, Clock, Camera
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { paths } from '@/firebase/multi-tenant';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isReviewing, setIsReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  const visitRef = useMemo(() => 
    companyId && db && visitId ? doc(db, paths.fieldVisits(companyId), visitId) : null, [db, companyId, visitId]);
  
  const { data: visit, loading } = useDoc<any>(visitRef);
  const [editItems, setEditItems] = useState<any[]>([]);

  useEffect(() => {
    if (visit) {
      setEditItems(visit.items || []);
    }
  }, [visit]);

  const handleUpdateResponse = (idx: number, field: string, val: any) => {
    const newItems = [...editItems];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setEditItems(newItems);
  };

  const handleSaveResponse = async () => {
    if (!db || !companyId || !visitId) return;
    setSaving(true);
    try {
      await updateDoc(visitRef!, {
        items: editItems,
        isEdited: true,
        updatedAt: serverTimestamp(),
        updatedByName: globalUser?.fullName || user?.displayName || 'Admin'
      });
      toast({ title: t('common.saved') });
      setIsReviewing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!db || !companyId || !user || !visit) return;
    setVerifying(true);
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      await service.verifyExecutionForBilling(visit.id, user.uid, globalUser?.fullName || 'Admin');
      toast({ title: t('construction.verify') });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="h-[40vh] flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!visit) return <div className="p-20 text-center font-black">{tSafe('inline.not.found', '404 - غير موجود', '404 - Not Found')}</div>;

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto pb-20 animate-in fade-in duration-500 bg-[#fdfaf3] text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4 print:hidden px-4 pt-4 text-start">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl border-2 bg-white text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-2xl font-black font-headline text-slate-900">{t('construction.fieldLog')}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{visit.clientName} | Project: {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-2">
           {!visit.isVerified && isAdmin && !isReviewing && (
             <Button onClick={handleVerify} disabled={verifying} size="sm" className="h-11 px-6 rounded-xl font-black bg-emerald-600 text-white shadow-lg shadow-emerald-100 border-b-4 border-emerald-800">
                {verifying ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {t('construction.verify')}
             </Button>
           )}
           {!isReviewing ? (
             <Button onClick={() => setIsReviewing(true)} variant="outline" size="sm" className="h-11 px-6 rounded-xl font-black border-2 bg-white gap-2">
               <MessageSquare className="h-4 w-4 text-primary" /> {t('common.response')}
             </Button>
           ) : (
             <div className="flex gap-2">
               <Button onClick={() => setIsReviewing(false)} variant="ghost" size="sm" className="h-11 px-6 font-bold">{t('common.cancel')}</Button>
               <Button onClick={handleSaveResponse} disabled={saving} size="sm" className="h-11 px-6 rounded-xl font-black bg-primary text-white border-b-4 border-orange-700">
                 {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} {t('common.save')}
               </Button>
             </div>
           )}
           <Button variant="outline" size="sm" onClick={() => window.print()} className="h-11 w-11 rounded-xl border-2 bg-white">
              <Printer className="h-4 w-4 text-slate-400" />
           </Button>
        </div>
      </div>

      <PrintWrapper title={t('construction.fieldProgressStatement')}>
         <div className="space-y-10 text-start">
            <div className="p-10 rounded-[3rem] bg-white border-2 border-primary/10 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-xl ring-1 ring-black/5">
               <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-48 w-48 text-primary" /></div>
               <div className="space-y-4 relative z-10 text-start">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{t('projects.clientName')}</p>
                     <h2 className="text-4xl font-black font-headline text-slate-900">{visit.clientName}</h2>
                  </div>
                  <div className="flex gap-4 items-center">
                     <Badge className="bg-slate-100 text-slate-900 border-0 font-black px-5 py-1 rounded-xl uppercase text-[9px] shadow-sm">#{visit.transactionNumber}</Badge>
                     <div className="flex items-center gap-2 text-slate-400 font-bold text-xs border-s-2 border-slate-100 ps-4">
                        <Workflow className="h-3.5 w-3.5 text-primary" /> {visit.activeStageName || '---'}
                     </div>
                  </div>
               </div>
               <div className="text-center md:text-end relative z-10 space-y-2">
                  <div className="bg-slate-50 p-6 rounded-3xl border-2 border-white shadow-inner">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('common.date')}</p>
                     <p className="text-2xl font-black text-slate-900 font-mono">{visit.visitDate}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="font-black text-lg flex items-center gap-3 text-slate-800 border-s-4 border-primary ps-4">
                  <LayoutGrid className="h-6 w-6 text-primary" /> {t('construction.technicalProgress')}
               </h3>
               <div className="border-2 border-slate-100 rounded-[2.5rem] bg-white overflow-hidden shadow-2xl ring-1 ring-black/[0.02]">
                  <Table>
                     <TableHeader className="bg-slate-50/80 border-b-2">
                        <TableRow className="hover:bg-slate-50 border-0">
                           <TableHead className="py-6 ps-10 text-primary font-black uppercase text-[10px] tracking-widest w-[60px]">#</TableHead>
                           <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest">{tSafe('inline.work.item', 'بند العمل', 'Work Item')}</TableHead>
                           <TableHead className="text-center text-primary font-black uppercase text-[10px] tracking-widest w-[120px]">{t('common.quantity')}</TableHead>
                           <TableHead className="pe-10 text-primary font-black uppercase text-[10px] tracking-widest">{t('common.response')}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {editItems.map((item: any, i: number) => (
                           <TableRow key={i} className="border-b-slate-50 hover:bg-primary/[0.01] transition-all">
                              <td className="py-6 ps-10 font-black text-slate-300">{i + 1}</td>
                              <td className="py-6 text-start">
                                 <p className="font-black text-sm text-slate-900">{item.itemName}</p>
                                 <p className="text-[11px] font-bold text-slate-400 leading-relaxed mt-1 italic">"{item.notes}"</p>
                                 {item.photoUrls?.length > 0 && (
                                   <div className="flex gap-2 mt-4">
                                      {item.photoUrls.map((url: string, pIdx: number) => (
                                        <div key={pIdx} className="h-12 w-12 rounded-xl border-2 border-white shadow-md overflow-hidden bg-slate-50 flex items-center justify-center">
                                           <img src={url} alt="Visit" className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                   </div>
                                 )}
                              </td>
                              <td className="py-6 text-center">
                                 <span className="text-2xl font-black text-primary font-mono">{item.quantity}</span>
                                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{item.unit}</p>
                              </td>
                              <td className="py-6 pe-10">
                                 {isReviewing ? (
                                    <div className="flex gap-2">
                                       <Select value={item.executionStatus || 'pending'} onValueChange={v => handleUpdateResponse(i, 'executionStatus', v)}>
                                          <SelectTrigger className="h-10 text-[10px] font-black rounded-xl border-2 bg-white"><SelectValue /></SelectTrigger>
                                          <SelectContent className="rounded-xl border-0 shadow-2xl z-[150]">
                                             <SelectItem value="pending" className="font-bold py-3">{tSafe('inline.pending.review', 'بانتظار المراجعة', 'Pending Review')}</SelectItem>
                                             <SelectItem value="completed" className="font-black text-emerald-600 py-3">{tSafe('inline.full.progress', 'إنجاز كامل', 'Full Progress')}</SelectItem>
                                             <SelectItem value="partial" className="font-black text-amber-600 py-3">{tSafe('inline.partial', 'جزئي', 'Partial')}</SelectItem>
                                             <SelectItem value="not_completed" className="font-black text-rose-600 py-3">{tSafe('inline.rejected', 'مرفوض', 'Rejected')}</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    </div>
                                 ) : (
                                    <Badge className={cn(
                                       "font-black px-6 py-1.5 rounded-xl border-0 shadow-sm uppercase text-[9px] gap-2",
                                       item.executionStatus === 'completed' ? "bg-emerald-500 text-white" :
                                       item.executionStatus === 'partial' ? "bg-amber-500 text-white" :
                                       "bg-slate-100 text-slate-400"
                                    )}>
                                       {item.executionStatus === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                                       {item.executionStatus ? tSafe(`inline.${item.executionStatus}`, item.executionStatus, item.executionStatus) : tSafe('inline.pending', 'بانتظار', 'Pending')}
                                    </Badge>
                                 )}
                              </td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-6 border-t-4 border-primary/10">
               <div className="space-y-6 text-start">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <Users className="h-4 w-4 text-primary" /> {isRtl ? 'الموارد البشرية والمشرفين' : 'Human Resources & Supervisors'}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                     {visit.laborDetails?.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-5 bg-slate-50 border-2 border-white rounded-[1.5rem] shadow-sm">
                           <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm border"><HardHat className="h-5 w-5" /></div>
                              <span className="font-black text-slate-800 text-sm">{l.trade}</span>
                           </div>
                           <Badge variant="outline" className="bg-white text-slate-900 border-2 font-black h-7 px-4 rounded-lg">{l.count} STAFF</Badge>
                        </div>
                     ))}
                     {!visit.laborDetails?.length && <p className="text-xs font-bold text-slate-300 italic p-10 text-center border-2 border-dashed rounded-3xl">لا توجد سجلات عمالة موثقة.</p>}
                  </div>
               </div>
               
               <div className="space-y-6 text-start">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات الثقيلة' : 'Heavy Equipment & Fleet'}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                     {visit.equipmentUsed?.map((e: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-5 bg-blue-50/30 border-2 border-white rounded-[1.5rem] shadow-sm">
                           <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm border"><Truck className="h-5 w-5" /></div>
                              <span className="font-black text-slate-800 text-sm">{e.name}</span>
                           </div>
                           <div className="text-end">
                              <span className="font-black text-blue-600 text-sm">{e.hoursUsed} HRS</span>
                           </div>
                        </div>
                     ))}
                     {!visit.equipmentUsed?.length && <p className="text-xs font-bold text-slate-300 italic p-10 text-center border-2 border-dashed rounded-3xl">لا توجد سجلات معدات موثقة.</p>}
                  </div>
               </div>
            </div>

            <div className="p-10 bg-white border-2 border-slate-100 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border-t-8 border-primary">
               <div className="flex items-center gap-6 text-start">
                  <Avatar className="h-16 w-16 rounded-2xl border-2 border-primary shadow-xl">
                     <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{visit.engineerName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-primary uppercase tracking-widest">{isRtl ? 'المهندس المسؤول الموثق' : 'Reporting Engineer'}</p>
                     <h4 className="text-xl font-black text-slate-900">{visit.engineerName}</h4>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="text-center md:text-end">
                     <p className="text-[8px] font-black text-slate-500 uppercase">{isRtl ? 'تاريخ الحفظ' : 'System Timestamp'}</p>
                     <p className="text-xs font-mono font-bold text-slate-400">{visit.createdAt?.toDate().toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-[1px] bg-slate-100" />
                  <div className="flex items-center gap-2">
                     <ShieldCheck className="h-6 w-6 text-emerald-400" />
                     <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">DATA SECURED</span>
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
