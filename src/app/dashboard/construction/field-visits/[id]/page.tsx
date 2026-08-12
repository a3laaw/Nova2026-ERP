'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const visitRef = useMemo(() => 
    companyId && db && visitId ? doc(db, paths.fieldVisits(companyId), visitId) : null, [db, companyId, visitId]);
  
  const { data: visit, loading } = useDoc<any>(visitRef);

  if (loading) return <div className="h-[40vh] flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!visit) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  const DetailTable = ({ title, columns, data }: any) => (
    <Card className="border-2 shadow-sm rounded-xl overflow-hidden bg-white h-full print:shadow-none print:border-slate-300">
      <CardHeader className="bg-slate-50 border-b py-3 px-4 text-start">
        <CardTitle className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-white">
            <TableRow className="border-b-2">
              {columns.map((col: string, i: number) => (
                <TableHead key={i} className="h-8 text-[9px] font-black text-slate-400 uppercase text-center border-e last:border-0">{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
               <TableRow><TableCell colSpan={columns.length} className="py-4 text-center text-slate-300 italic text-[10px]">---</TableCell></TableRow>
            ) : data?.map((row: any, idx: number) => (
              <TableRow key={idx} className="border-b last:border-0">
                {Object.values(row).map((val: any, i: number) => (
                  <TableCell key={i} className="p-2 border-e last:border-0 text-center font-bold text-[11px] text-slate-700">{val}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 w-full max-w-full mx-auto pb-20 animate-in fade-in duration-500 text-start" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4 print:hidden px-4 pt-4 text-start">
        <div className="flex items-center gap-4 text-start">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl border-2 bg-white text-slate-400 shadow-sm">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-2xl font-black font-headline text-slate-900">{t('construction.fieldLog')}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{visit.clientName} | {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => window.print()} className="h-11 px-8 rounded-xl border-2 bg-white shadow-sm font-black gap-2">
              <Printer className="h-4 w-4 text-primary" /> {t('common.print')}
           </Button>
        </div>
      </div>

      <PrintWrapper title={t('construction.fieldProgressStatement')}>
         <div className="space-y-10 text-start">
            {/* Header Box */}
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
                        <History className="h-3.5 w-3.5 text-primary" /> {visit.activeStageName || '---'}
                     </div>
                  </div>
               </div>
               <div className="text-center md:text-end relative z-10">
                  <div className="bg-slate-50 p-6 rounded-3xl border-2 border-white shadow-inner">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('common.date')}</p>
                     <p className="text-2xl font-black text-slate-900 font-mono">{visit.visitDate}</p>
                  </div>
               </div>
            </div>

            {/* BOQ Work Done Section */}
            <div className="space-y-6">
               <h3 className="text-xl font-black font-headline text-slate-900 flex items-center gap-3 border-b-2 pb-2 border-slate-100">
                  <Hammer className="h-6 w-6 text-primary" /> {isRtl ? 'إنجاز بنود المقايسة' : 'BOQ Work Execution'}
               </h3>
               <div className="border-2 border-slate-100 rounded-[2.5rem] bg-white overflow-hidden shadow-xl ring-1 ring-black/[0.02] print:shadow-none">
                  <Table>
                     <TableHeader className="bg-slate-50/80">
                        <TableRow className="border-0">
                           <TableHead className="py-6 ps-10 text-slate-500 font-black uppercase text-[10px] tracking-widest">#</TableHead>
                           <TableHead className="text-slate-500 font-black uppercase text-[10px] tracking-widest">{isRtl ? 'بند العمل' : 'Work Item'}</TableHead>
                           <TableHead className="text-center text-slate-500 font-black uppercase text-[10px] tracking-widest w-[150px]">{t('common.quantity')}</TableHead>
                           <TableHead className="pe-10 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('common.notes')}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {visit.items?.map((item: any, i: number) => (
                           <TableRow key={i} className="border-b-slate-50">
                              <td className="py-6 ps-10 font-black text-slate-300">{i + 1}</td>
                              <td className="py-6 text-start">
                                 <p className="font-black text-sm text-slate-900">{item.itemName}</p>
                              </td>
                              <td className="py-6 text-center">
                                 <span className="text-2xl font-black text-primary font-mono">{item.quantity}</span>
                                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{item.unit}</p>
                              </td>
                              <td className="py-6 pe-10 font-bold text-xs text-slate-500 italic">"{item.notes || '---'}"</td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>

            {/* The 2x2 Resource Grid for Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                <DetailTable 
                  title="STAFF" 
                  columns={[isRtl ? 'الوظيفة' : 'POSITION', isRtl ? 'العدد' : 'NO']} 
                  data={visit.staffDetails} 
                />
                <DetailTable 
                  title="LABOUR" 
                  columns={[isRtl ? 'التخصص' : 'TRADE', isRtl ? 'المنطقة' : 'AREA', isRtl ? 'العدد' : 'NO']} 
                  data={visit.laborDetails} 
                />
                <DetailTable 
                  title="EQUIPMENT (Available at site today)" 
                  columns={[isRtl ? 'النوع' : 'TYPE', isRtl ? 'العدد' : 'NO', isRtl ? 'ساعات' : 'HOURS']} 
                  data={visit.equipmentUsed} 
                />
                <DetailTable 
                  title="MATERIAL (Delivered to site today)" 
                  columns={[isRtl ? 'النوع' : 'TYPE', isRtl ? 'الوحدة' : 'UNIT', isRtl ? 'الكمية' : 'QTY']} 
                  data={visit.materialsDelivered} 
                />
            </div>

            {/* Official Signature Footer */}
            <div className="p-10 bg-white border-2 border-slate-100 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border-t-8 border-primary text-start">
               <div className="flex items-center gap-6 text-start">
                  <Avatar className="h-16 w-16 rounded-2xl border-2 border-primary shadow-xl">
                     <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{visit.engineerName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-primary uppercase tracking-widest">{isRtl ? 'المهندس المسؤول الموثق' : 'Reporting Engineer'}</p>
                     <h4 className="text-xl font-black text-slate-900">{visit.engineerName}</h4>
                  </div>
               </div>
               <div className="flex gap-10 items-center">
                  <div className="text-center md:text-end space-y-1">
                     <p className="text-[8px] font-black text-slate-500 uppercase">{isRtl ? 'تاريخ الحفظ' : 'System Timestamp'}</p>
                     <p className="text-xs font-mono font-bold text-slate-400">{visit.createdAt?.toDate().toLocaleString()}</p>
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
