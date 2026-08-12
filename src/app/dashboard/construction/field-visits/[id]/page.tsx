'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, ArrowRight, Hammer, Users, 
  Truck, CheckCircle2, ShieldCheck, Printer,
  LayoutGrid, Package, Landmark, History
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const visitRef = useMemo(() => 
    companyId && db && visitId ? doc(db, paths.fieldVisits(companyId), visitId) : null, [db, companyId, visitId]);
  
  const { data: visit, loading } = useDoc<any>(visitRef);

  if (loading) return <div className="h-[60vh] flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!visit) return <div className="p-20 text-center font-black">{tSafe('inline.not.found', '404 - غير موجود', '404 - Not Found')}</div>;

  return (
    <div className="space-y-6 w-full max-w-full pb-20 animate-in fade-in duration-500 text-start bg-white" dir={dir}>
      
      {/* Header الثابت في الأعلى */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-6 print:hidden px-8 pt-6 bg-white shadow-sm">
        <div className="flex items-center gap-6 text-start">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-12 w-12 rounded-2xl border-2 bg-white text-slate-400 shadow-sm hover:text-primary transition-all">
             <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start space-y-1">
              <h1 className="text-3xl font-black font-headline text-slate-900">{t('construction.fieldLog')}</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">{visit.clientName} | {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-4">
           <Button variant="outline" size="sm" onClick={() => window.print()} className="h-12 px-10 rounded-2xl border-2 bg-white shadow-xl font-black gap-3 hover:scale-105 transition-all">
              <Printer className="h-5 w-5 text-primary" /> {t('common.print')}
           </Button>
        </div>
      </div>

      <div className="px-4 md:px-8">
        <PrintWrapper title={t('construction.fieldProgressStatement')} fullWidth={true}>
           <div className="space-y-12 text-start">
              
              {/* بطاقة معلومات المشروع */}
              <div className="p-10 rounded-[3rem] bg-white border-2 border-primary/10 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden shadow-xl ring-1 ring-black/[0.02]">
                 <div className="absolute top-0 right-0 p-12 opacity-5"><Landmark className="h-60 w-60 text-primary" /></div>
                 <div className="space-y-4 relative z-10 text-start">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">{t('projects.clientName')}</p>
                       <h2 className="text-4xl font-black font-headline text-slate-900 tracking-tight">{visit.clientName}</h2>
                    </div>
                    <div className="flex gap-6 items-center">
                       <Badge className="bg-slate-900 text-white border-0 font-black px-6 py-1.5 rounded-xl uppercase text-[10px] shadow-lg">#{visit.transactionNumber}</Badge>
                       <div className="flex items-center gap-3 text-slate-500 font-black text-sm border-s-2 border-slate-100 ps-6">
                          <History className="h-5 w-5 text-primary" /> {visit.activeStageName || tSafe('general.progress', 'التقدم العام', 'General Progress')}
                       </div>
                    </div>
                 </div>
                 <div className="text-center md:text-end relative z-10 shrink-0">
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-white shadow-inner ring-1 ring-black/[0.02]">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('common.date')}</p>
                       <p className="text-3xl font-black text-slate-900 font-mono">{visit.visitDate}</p>
                    </div>
                 </div>
              </div>

              {/* قسم إنجاز بنود المقايسة */}
              <div className="space-y-6">
                 <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-4 border-b-2 pb-4 border-primary/10">
                    <Hammer className="h-6 w-6 text-primary" /> 
                    {tSafe('inline.certified.boq.execution', 'إنجاز بنود المقايسة الموثق', 'Certified BOQ Work Execution')}
                 </h3>
                 <div className="border-2 border-slate-100 rounded-3xl bg-white overflow-hidden shadow-sm">
                    <Table className="w-full">
                       <TableHeader className="bg-slate-50/80">
                          <TableRow className="border-0">
                             <TableHead className="py-6 ps-8 text-slate-500 font-black uppercase text-[10px] tracking-widest w-[60px]">#</TableHead>
                             <TableHead className="text-slate-500 font-black uppercase text-[10px] tracking-widest">{tSafe('inline.work.item.desc', 'وصف بند العمل', 'Work Item Description')}</TableHead>
                             <TableHead className="text-center text-primary font-black uppercase text-[10px] tracking-widest w-[150px]">{t('common.quantity')}</TableHead>
                             <TableHead className="pe-8 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('common.notes')}</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {visit.items?.map((item: any, i: number) => (
                             <TableRow key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                                <td className="py-6 ps-8 font-black text-slate-300">{i + 1}</td>
                                <td className="py-6 text-start">
                                   <p className="font-black text-slate-800 text-sm leading-tight">{item.itemName}</p>
                                   <Badge variant="outline" className="mt-1 h-5 px-2 border-slate-200 text-[9px] font-black text-slate-400 uppercase bg-white">ID: {item.boqItemId?.slice(-6)}</Badge>
                                </td>
                                <td className="py-6 text-center">
                                   <div className="inline-flex flex-col items-center">
                                      <span className="text-2xl font-black text-primary font-mono">{item.quantity}</span>
                                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{item.unit || 'UNITS'}</span>
                                   </div>
                                </td>
                                <td className="py-6 pe-8 font-bold text-xs text-slate-500 italic">
                                   {item.notes || '---'}
                                </td>
                             </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </div>
              </div>

              {/* شبكة الموارد الرباعية (الموظفون، المعدات، المواد) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* جدول الموظفين */}
                  <Card className="border-2 shadow-none rounded-[2rem] overflow-hidden bg-white">
                     <CardHeader className="bg-slate-50 border-b py-4 px-6 text-start">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] flex items-center gap-2">
                           <Users className="h-3.5 w-3.5" /> {tSafe('inline.staff.resources', 'الموارد البشرية', 'Staff Resources')}
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                        <Table>
                           <TableHeader className="bg-white border-b">
                              <TableRow>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-start ps-6">{isRtl ? 'الموظف' : 'EMPLOYEE'}</TableHead>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-start">{isRtl ? 'المسمى' : 'POSITION'}</TableHead>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-center">{isRtl ? 'العدد' : 'COUNT'}</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {visit.staffDetails?.map((row: any, idx: number) => (
                                <TableRow key={idx} className="border-b last:border-0">
                                   <TableCell className="ps-6 py-4 font-black text-xs text-slate-800">{row.employeeName}</TableCell>
                                   <TableCell className="py-4 text-xs font-bold text-slate-500">{row.position}</TableCell>
                                   <TableCell className="py-4 text-center font-black text-sm">{row.count}</TableCell>
                                </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     </CardContent>
                  </Card>

                  {/* جدول المعدات */}
                  <Card className="border-2 shadow-none rounded-[2rem] overflow-hidden bg-white">
                     <CardHeader className="bg-slate-50 border-b py-4 px-6 text-start">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] flex items-center gap-2">
                           <Truck className="h-3.5 w-3.5" /> {tSafe('common.equipment', 'المعدات والآليات', 'Equipment')}
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                        <Table>
                           <TableHeader className="bg-white border-b">
                              <TableRow>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-start ps-6">{isRtl ? 'المعدة' : 'EQUIPMENT'}</TableHead>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-center">{isRtl ? 'العدد' : 'COUNT'}</TableHead>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-center">{isRtl ? 'ساعات' : 'HOURS'}</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {visit.equipmentUsed?.map((row: any, idx: number) => (
                                <TableRow key={idx} className="border-b last:border-0">
                                   <TableCell className="ps-6 py-4 font-black text-xs text-slate-800">{row.equipmentName}</TableCell>
                                   <TableCell className="py-4 text-center font-black text-sm">{row.count}</TableCell>
                                   <TableCell className="py-4 text-center font-black text-sm text-primary">{row.hours}</TableCell>
                                </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     </CardContent>
                  </Card>

                  {/* جدول المواد */}
                  <Card className="lg:col-span-2 border-2 shadow-none rounded-[2rem] overflow-hidden bg-white">
                     <CardHeader className="bg-slate-50 border-b py-4 px-6 text-start">
                        <CardTitle className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] flex items-center gap-2">
                           <Package className="h-3.5 w-3.5" /> {tSafe('inline.materials', 'المواد الموردة للموقع', 'Materials')}
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                        <Table>
                           <TableHeader className="bg-white border-b">
                              <TableRow>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-start ps-6">{isRtl ? 'نوع المادة' : 'MATERIAL TYPE'}</TableHead>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-center">{isRtl ? 'الوحدة' : 'UNIT'}</TableHead>
                                 <TableHead className="text-[9px] font-black text-slate-400 uppercase text-center">{isRtl ? 'الكمية' : 'QTY'}</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {visit.materialsDelivered?.map((row: any, idx: number) => (
                                <TableRow key={idx} className="border-b last:border-0">
                                   <TableCell className="ps-6 py-4 font-black text-xs text-slate-800">{row.type}</TableCell>
                                   <TableCell className="py-4 text-center font-bold text-xs uppercase text-slate-400">{row.unit}</TableCell>
                                   <TableCell className="py-4 text-center font-black text-sm text-emerald-600">{row.quantity}</TableCell>
                                </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     </CardContent>
                  </Card>
              </div>

              {/* التوقيع والاعتماد الفني */}
              <div className="p-10 bg-white border-2 border-slate-100 rounded-[3rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-10 border-t-8 border-primary text-start ring-1 ring-black/[0.02]">
                 <div className="flex items-center gap-8 text-start">
                    <Avatar className="h-20 w-20 rounded-[1.5rem] border-4 border-white shadow-xl">
                       <AvatarFallback className="bg-primary/5 text-primary font-black text-2xl">{visit.engineerName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">{tSafe('inline.authorized.engineer', 'المهندس الموثق', 'Authorized Engineer')}</p>
                       <h4 className="text-2xl font-black font-headline text-slate-900">{visit.engineerName}</h4>
                       <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px]">
                          <ShieldCheck className="h-4 w-4 text-emerald-500" /> {tSafe('inline.verified.record', 'سجل ميداني موثق', 'Verified Field Record')}
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                    <div className="bg-slate-50 px-6 py-3 rounded-2xl border-2 border-white shadow-inner text-center md:text-end">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{isRtl ? 'بصمة النظام الرقمية' : 'System Timestamp'}</p>
                       <p className="text-xs font-mono font-bold text-slate-700">{visit.createdAt?.toDate().toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className="h-7 px-4 rounded-xl font-mono text-[9px] border-2 border-slate-100 font-black text-slate-300">
                       REF: {visit.id?.toUpperCase().slice(-8)}
                    </Badge>
                 </div>
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}