'use client';

import { useMemo, useState } from 'react';
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
  if (!visit) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  const DetailTable = ({ title, columns, data }: any) => (
    <Card className="border-2 shadow-sm rounded-2xl overflow-hidden bg-white h-full print:border-slate-300 print:shadow-none">
      <CardHeader className="bg-slate-50 border-b py-3 px-6 text-start">
        <CardTitle className="text-[11px] font-black uppercase text-slate-600 tracking-widest">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="w-full">
          <TableHeader className="bg-white">
            <TableRow className="border-b-2">
              {columns.map((col: string, i: number) => (
                <TableHead key={i} className="h-10 text-[10px] font-black text-slate-400 uppercase text-center border-e last:border-0">{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
               <TableRow><TableCell colSpan={columns.length} className="py-8 text-center text-slate-300 italic text-xs">--- No Records Registered ---</TableCell></TableRow>
            ) : data?.map((row: any, idx: number) => (
              <TableRow key={idx} className="border-b last:border-0">
                {Object.values(row).map((val: any, i: number) => (
                  <TableCell key={i} className="py-3 px-4 border-e last:border-0 text-center font-bold text-xs text-slate-700">{val}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 w-full max-w-full pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      
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

      <div className="px-8">
        <PrintWrapper title={t('construction.fieldProgressStatement')}>
           <div className="space-y-12 text-start">
              
              <div className="p-12 rounded-[3.5rem] bg-white border-2 border-primary/10 flex flex-col md:flex-row justify-between items-center gap-12 relative overflow-hidden shadow-2xl ring-1 ring-black/[0.03]">
                 <div className="absolute top-0 right-0 p-12 opacity-5"><Landmark className="h-60 w-60 text-primary" /></div>
                 <div className="space-y-5 relative z-10 text-start">
                    <div className="space-y-2">
                       <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em]">{t('projects.clientName')}</p>
                       <h2 className="text-5xl font-black font-headline text-slate-900 tracking-tight">{visit.clientName}</h2>
                    </div>
                    <div className="flex gap-6 items-center">
                       <Badge className="bg-slate-900 text-white border-0 font-black px-8 py-2 rounded-2xl uppercase text-[11px] shadow-xl">#{visit.transactionNumber}</Badge>
                       <div className="flex items-center gap-3 text-slate-500 font-black text-sm border-s-2 border-slate-100 ps-6">
                          <History className="h-5 w-5 text-primary" /> {visit.activeStageName || 'Project Execution'}
                       </div>
                    </div>
                 </div>
                 <div className="text-center md:text-end relative z-10 shrink-0">
                    <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-white shadow-inner ring-1 ring-black/[0.02]">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('common.date')}</p>
                       <p className="text-4xl font-black text-slate-900 font-mono">{visit.visitDate}</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <h3 className="text-2xl font-black font-headline text-slate-900 flex items-center gap-4 border-b-4 pb-4 border-primary/10">
                    <Hammer className="h-8 w-8 text-primary" /> {isRtl ? 'إنجاز بنود المقايسة الموثق' : 'Certified BOQ Work Execution'}
                 </h3>
                 <div className="border-2 border-slate-100 rounded-[3rem] bg-white overflow-hidden shadow-2xl ring-1 ring-black/[0.02] print:shadow-none print:border-slate-300">
                    <Table className="w-full">
                       <TableHeader className="bg-slate-50/80">
                          <TableRow className="border-0">
                             <TableHead className="py-8 ps-12 text-slate-500 font-black uppercase text-xs tracking-widest w-[80px]">#</TableHead>
                             <TableHead className="text-slate-500 font-black uppercase text-xs tracking-widest">{isRtl ? 'وصف بند العمل' : 'Work Item Description'}</TableHead>
                             <TableHead className="text-center text-primary font-black uppercase text-xs tracking-widest w-[200px]">{t('common.quantity')}</TableHead>
                             <TableHead className="pe-12 text-slate-500 font-black uppercase text-xs tracking-widest">{t('common.notes')}</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {visit.items?.map((item: any, i: number) => (
                             <TableRow key={i} className="border-b-2 border-slate-50 hover:bg-slate-50/50 transition-all">
                                <td className="py-8 ps-12 font-black text-slate-300 text-lg">{i + 1}</td>
                                <td className="py-8 text-start">
                                   <p className="font-black text-xl text-slate-900 leading-tight">{item.itemName}</p>
                                   <Badge variant="outline" className="mt-2 h-6 px-3 border-slate-200 text-[10px] font-black text-slate-400 uppercase bg-white">ID: {item.boqItemId?.slice(-6)}</Badge>
                                </td>
                                <td className="py-8 text-center">
                                   <div className="inline-flex flex-col items-center">
                                      <span className="text-4xl font-black text-primary font-mono tabular-nums leading-none">{item.quantity}</span>
                                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-2">{item.unit || 'UNITS'}</span>
                                   </div>
                                </td>
                                <td className="py-8 pe-12 font-bold text-base text-slate-500 italic max-w-sm">
                                   {item.notes ? `"${item.notes}"` : '---'}
                                </td>
                             </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10">
                  <DetailTable 
                    title="I. STAFF RESOURCES" 
                    columns={[isRtl ? 'الموظف' : 'EMPLOYEE', isRtl ? 'المسمى' : 'POSITION', isRtl ? 'العدد' : 'COUNT']} 
                    data={visit.staffDetails} 
                  />
                  <DetailTable 
                    title="III. EQUIPMENT DEPLOYED" 
                    columns={[isRtl ? 'اسم المعدة' : 'EQUIPMENT', isRtl ? 'العدد' : 'COUNT', isRtl ? 'ساعات' : 'HOURS']} 
                    data={visit.equipmentUsed} 
                  />
                  <div className="md:col-span-2">
                    <DetailTable 
                        title="IV. MATERIAL RECEIPTS" 
                        columns={[isRtl ? 'نوع المادة' : 'MATERIAL TYPE', isRtl ? 'الوحدة' : 'UNIT', isRtl ? 'الكمية' : 'QTY']} 
                        data={visit.materialsDelivered} 
                    />
                  </div>
              </div>

              <div className="p-12 bg-white border-2 border-slate-100 rounded-[3.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-12 border-t-8 border-primary text-start ring-1 ring-black/[0.02]">
                 <div className="flex items-center gap-8 text-start relative group">
                    <Avatar className="h-24 w-24 rounded-[2rem] border-4 border-white shadow-2xl transition-transform group-hover:scale-105">
                       <AvatarFallback className="bg-primary text-white font-black text-3xl">{visit.engineerName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{isRtl ? 'المهندس الموثق' : 'Authorized Engineer'}</p>
                       <h4 className="text-3xl font-black font-headline text-slate-900">{visit.engineerName}</h4>
                       <div className="flex items-center gap-2 text-slate-400 font-bold text-xs">
                          <ShieldCheck className="h-4 w-4 text-emerald-500" /> {tSafe('inline.verified.record', 'سجل ميداني موثق', 'Verified Field Record')}
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                    <div className="bg-slate-50 px-8 py-4 rounded-2xl border-2 border-white shadow-inner text-center md:text-end">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{isRtl ? 'تاريخ الحفظ الرقمي' : 'System Timestamp'}</p>
                       <p className="text-sm font-mono font-bold text-slate-700">{visit.createdAt?.toDate().toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className="h-8 px-6 rounded-xl font-mono text-[10px] border-2 border-slate-100 font-black text-slate-300">
                       REF: {visit.id?.toUpperCase()}
                    </Badge>
                 </div>
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}
