'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, ArrowRight, MapPin, 
  HardHat, Target, Users, 
  Truck, CheckCircle2, ShieldCheck,
  Camera, Info, DollarSign, Printer
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { BOQExecutionService } from '@/services/boq-execution-service';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PrintWrapper } from '@/components/layout/print-wrapper';

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [verifying, setVerifying] = useState(false);

  const visitRef = useMemo(() => 
    companyId && db ? doc(db, 'companies', companyId, 'executions', visitId) : null, 
  [db, companyId, visitId]);
  
  const { data: visit, loading } = useDoc<any>(visitRef);

  const handleVerify = async () => {
    if (!db || !companyId || !user || !visit) return;
    setVerifying(true);
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      await service.verifyExecutionForBilling(visitId, user.uid, globalUser?.fullName || 'Admin');
      toast({ title: isRtl ? "تم اعتماد الإنجاز للاستحقاق" : "Progress Verified" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!visit) return <div className="p-20 text-center font-black">404 - Log Not Found</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 bg-[#fdfaf3]" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 pt-4 print:hidden">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white border-2 text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقرير إنجاز ميداني متكامل' : 'Sovereign Field Log'}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{visit.clientName} | Project: {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-3">
           {!visit.isVerified && isAdmin && (
             <Button onClick={handleVerify} disabled={verifying} className="h-14 px-10 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 gap-3">
                {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                {isRtl ? 'اعتماد للاستحقاق المالي' : 'Verify for Billing'}
             </Button>
           )}
           <Button variant="outline" onClick={() => window.print()} className="h-14 px-8 rounded-2xl border-2 font-black gap-2 bg-white">
              <Printer className="h-5 w-5 text-primary" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
        </div>
      </div>

      <PrintWrapper title={isRtl ? "تقرير إنجاز ميداني وتحليل تكاليف" : "Verified Field Progress Log"}>
         <div className="space-y-10 text-start">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-4 border-primary/20 pb-8">
               <div className="space-y-4">
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase">Client</p><p className="text-2xl font-black text-slate-900">{visit.clientName}</p></div>
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase">Engineer</p><p className="text-xl font-bold text-primary">{visit.recordedByName || visit.engineerName}</p></div>
               </div>
               <div className="space-y-4 md:text-end">
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase">Execution Date</p><p className="text-2xl font-black text-slate-900">{visit.visitDate}</p></div>
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase">Status</p><Badge className={cn("bg-emerald-500 text-white font-black px-4", visit.isVerified ? "bg-emerald-600" : "bg-blue-500")}>{visit.isVerified ? 'VERIFIED' : 'SUBMITTED'}</Badge></div>
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="font-black text-xl flex items-center gap-3"><LayoutGrid className="h-6 w-6 text-primary" /> {isRtl ? 'بنود الإنجاز الميداني' : 'Executed Work Items'}</h3>
               <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                  <Table>
                     <TableHeader className="bg-slate-900 text-white">
                        <TableRow>
                           <TableHead className="ps-8 text-white font-black text-[10px] uppercase">#</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase">{isRtl ? 'البند' : 'Description'}</TableHead>
                           <TableHead className="text-center text-white font-black text-[10px] uppercase">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase">{isRtl ? 'الملاحظات الفنية' : 'Engineer Notes'}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {visit.items?.map((item: any, i: number) => (
                           <TableRow key={i} className="border-b-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="ps-8 py-6 font-black text-slate-300">{(i + 1).toString().padStart(2, '0')}</td>
                              <td className="py-6 text-start">
                                 <p className="font-black text-slate-800 text-sm">{item.itemName}</p>
                                 <Badge variant="outline" className="text-[8px] font-bold text-slate-400 border-slate-100 uppercase">{item.unit}</Badge>
                              </td>
                              <td className="py-6 text-center font-black text-lg text-primary">{item.quantity}</td>
                              <td className="py-6 text-xs font-bold text-slate-600 italic">"{item.notes || '---'}"</td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'توزيع العمالة' : 'Labor Summary'}</h4>
                  <div className="space-y-3">
                     {visit.laborDetails?.map((l: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50 border-2 border-white flex justify-between items-center shadow-inner">
                           <span className="font-black text-xs text-slate-700">{l.trade}</span>
                           <Badge className="bg-slate-900 text-white font-black">{l.count} Staff</Badge>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات' : 'Equipment'}</h4>
                  <div className="space-y-3">
                     {visit.equipmentUsed?.map((e: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50 border-2 border-white flex justify-between items-center shadow-inner">
                           <span className="font-black text-xs text-slate-700">{e.name}</span>
                           <Badge variant="outline" className="text-primary border-primary/20 font-black">{e.hoursUsed} hrs</Badge>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
