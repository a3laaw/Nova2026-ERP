
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowRight, MapPin, 
  Calendar, HardHat, Target, Users, 
  Truck, CheckCircle2, ShieldCheck,
  Camera, Info, Scale, Clock,
  DollarSign
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { FieldVisit } from '@/types/field-visit';
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

  // جلب بيانات الزيارة باستخدام collectionGroup (لأنها مجموعة فرعية)
  // ملاحظة: بما أننا نعرف الـ transactionId من الرابط أو التوجيه، يفضل استخدامه مباشرة لسرعة الجلب
  // هنا سنفترض أننا سنستخدم محرك البحث الذكي للعثور عليها
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
      toast({ title: isRtl ? "تم اعتماد الإنجاز للصرف مالياً" : "Progress Verified for Billing" });
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
              <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تفاصيل الإنجاز الميداني' : 'Field Execution Details'}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LOG ID: {visit.id?.slice(-8)}</p>
           </div>
        </div>
        
        <div className="flex gap-3">
           {!visit.isVerified && isAdmin && (
             <Button 
               onClick={handleVerify} 
               disabled={verifying}
               className="h-14 px-10 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 gap-3 border-b-8 border-emerald-800"
             >
                {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                {isRtl ? 'اعتماد للاستحقاق المالي' : 'Verify for Billing'}
             </Button>
           )}
           <Button variant="outline" onClick={() => window.print()} className="h-14 px-8 rounded-2xl border-2 font-black gap-2 bg-white">
              <Clock className="h-5 w-5" /> {isRtl ? 'طباعة التقرير' : 'Print Log'}
           </Button>
        </div>
      </div>

      <PrintWrapper title={isRtl ? "تقرير إنجاز ميداني معتمد" : "Verified Field Progress Report"} className="mx-4">
         <div className="space-y-10 text-start">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card className="border-0 shadow-lg rounded-[2rem] p-8 bg-slate-900 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Target className="h-24 w-24" /></div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{isRtl ? 'الكمية المنفذة' : 'Executed Qty'}</p>
                  <h3 className="text-4xl font-black">{visit.quantity} <span className="text-sm opacity-40 uppercase">{visit.unitSymbol || 'unit'}</span></h3>
                  <div className="mt-6 flex items-center gap-2">
                     {visit.isVerified ? (
                        <Badge className="bg-emerald-500 text-white font-black text-[8px] px-3 h-5">VERIFIED FOR IPC</Badge>
                     ) : (
                        <Badge className="bg-amber-500 text-white font-black text-[8px] px-3 h-5">AWAITING AUDIT</Badge>
                     )}
                  </div>
               </Card>

               <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-[2rem] bg-white border-2 border-slate-50 shadow-sm flex items-center gap-5">
                     <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm"><HardHat className="h-6 w-6" /></div>
                     <div className="text-start">
                        <p className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'المهندس المسؤول' : 'Recording Engineer'}</p>
                        <p className="text-base font-black text-slate-800">{visit.recordedByName}</p>
                     </div>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-white border-2 border-slate-50 shadow-sm flex items-center gap-5">
                     <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm"><Calendar className="h-6 w-6" /></div>
                     <div className="text-start">
                        <p className="text-[9px] font-black text-slate-400 uppercase">{isRtl ? 'تاريخ التوثيق' : 'Entry Date'}</p>
                        <p className="text-base font-black text-slate-800">{visit.createdAt?.toDate().toLocaleDateString()}</p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t pt-10">
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2">
                     <Users className="h-4 w-4 text-primary" /> {isRtl ? 'تحليل القوى العاملة' : 'Labor Allocation'}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                     {visit.laborDetails?.map((l: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50/50 border-2 border-white shadow-inner flex justify-between items-center">
                           <span className="text-sm font-black text-slate-700">{l.trade}</span>
                           <Badge className="bg-slate-900 text-white font-black">{l.count}</Badge>
                        </div>
                     ))}
                     {(!visit.laborDetails || visit.laborDetails.length === 0) && (
                        <p className="text-xs font-bold text-slate-300 italic py-4">No labor records.</p>
                     )}
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2">
                     <Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment Utilization'}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                     {visit.equipmentUsed?.map((e: any, i: number) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50/50 border-2 border-white shadow-inner flex justify-between items-center">
                           <span className="text-sm font-black text-slate-700">{e.name}</span>
                           <Badge variant="outline" className="border-primary/20 text-primary font-black">{e.hoursUsed} hrs</Badge>
                        </div>
                     ))}
                     {(!visit.equipmentUsed || visit.equipmentUsed.length === 0) && (
                        <p className="text-xs font-bold text-slate-300 italic py-4">No equipment records.</p>
                     )}
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" /> {isRtl ? 'الملاحظات الفنية الميدانية' : 'Technical Site Notes'}
               </h4>
               <p className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed italic">
                  {visit.notes || 'No notes recorded.'}
               </p>
            </div>

            <div className="p-10 rounded-[3rem] bg-emerald-50/30 border-2 border-dashed border-emerald-200 flex items-start gap-6 text-start shadow-inner">
               <Scale className="h-8 w-8 text-emerald-600 shrink-0 mt-1" />
               <div className="space-y-2">
                  <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest">{isRtl ? 'شهادة مطابقة الميدان والمالية' : 'Field-Finance Certification'}</h5>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                     {isRtl 
                       ? 'يتم استخدام هذه البيانات كمرجع أساسي لتوليد المستخلصات الشهرية وحساب تكاليف الإنتاج المباشرة (COGS). أي تعديل في هذه البيانات يتطلب تدقيقاً من مدير المشاريع.' 
                       : 'This data is the primary reference for monthly IPC generation and COGS calculation. Any modifications require project manager audit.'}
                  </p>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
