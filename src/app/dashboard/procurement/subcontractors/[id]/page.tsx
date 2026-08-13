
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowRight, Loader2, HardHat, Phone, Mail, 
  Handshake, Wallet, TrendingUp, Gavel, 
  History, Calendar, Info, Landmark, 
  CheckCircle2, Clock, ExternalLink,
  ShieldCheck, Briefcase, DollarSign,
  Plus, Star
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function SubcontractorDossierPage() {
  const params = useParams();
  const subId = params.id as string;
  const { globalUser } = useAuthContext();
  const { t, lang, dir, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // 1. جلب بيانات المقاول الأساسية
  const subRef = useMemo(() => 
    companyId && db ? doc(db, paths.subcontractors(companyId), subId) : null, [db, companyId, subId]);
  const { data: subcontractor, loading: subLoading } = useDoc<any>(subRef);

  // 2. جلب كافة العقود المرتبطة بهذا المقاول
  const contractsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subconContracts(companyId)), where('subcontractorId', '==', subId), orderBy('createdAt', 'desc')) : null, 
  [db, companyId, subId]);
  const { data: contracts, loading: contractsLoading } = useCollection<any>(contractsQuery);

  // 3. جلب كافة المستخلصات المدفوعة للمقاول (لأغراض التحليل المالي)
  const ipcsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subIpcs(companyId)), where('subcontractorId', '==', subId)) : null, 
  [db, companyId, subId]);
  const { data: ipcs } = useCollection<any>(ipcsQuery);

  const stats = useMemo(() => {
    const totalAwarded = contracts?.reduce((acc, c) => acc + (c.totalAmount || 0), 0) || 0;
    const totalPaid = ipcs?.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.netPayable || 0), 0) || 0;
    return {
      awarded: totalAwarded,
      paid: totalPaid,
      pending: totalAwarded - totalPaid,
      activeContracts: contracts?.filter(c => c.status === 'active').length || 0
    };
  }, [contracts, ipcs]);

  if (subLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!subcontractor) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 text-start" dir={dir}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 px-1">
        <div className="flex items-center gap-6 text-start">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white shadow-sm border hover:bg-slate-50">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start space-y-1">
             <h1 className="text-4xl font-black font-headline text-slate-900">{subcontractor.name}</h1>
             <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 font-black text-[9px] uppercase px-4 h-6">
                   <HardHat className="h-3 w-3 me-2" /> {subcontractor.trade}
                </Badge>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SUB-CON ID: {subId.slice(-6).toUpperCase()}</span>
             </div>
           </div>
        </div>
        
        <div className="flex gap-3">
           <Button variant="outline" className="h-12 px-6 rounded-xl border-2 font-black gap-2 bg-white text-slate-600">
              <Phone className="h-4 w-4" /> {subcontractor.phone}
           </Button>
           <Button onClick={() => router.push(`/dashboard/procurement/subcontractors/contracts/new?subcontractorId=${subId}`)} className="h-12 px-8 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 border-b-4 border-orange-700">
              <Plus className="h-5 w-5 me-2" /> {tSafe('subcon.awardNew', 'إسناد عمل جديد', 'Award New Work')}
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-0 shadow-lg rounded-[2.5rem] p-8 bg-white border-b-8 border-slate-900 ring-1 ring-black/5 group hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.totalAwarded', 'إجمالي قيمة التعاقدات', 'Total Awarded')}</p>
               <TrendingUp className="h-5 w-5 text-primary opacity-20" />
            </div>
            <h3 className="text-3xl font-black text-slate-900">{stats.awarded.toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2.5rem] p-8 bg-white border-b-8 border-emerald-500 ring-1 ring-black/5 group hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.totalPaid', 'إجمالي المبالغ المصروفة', 'Total Paid')}</p>
               <Wallet className="h-5 w-5 text-emerald-500 opacity-20" />
            </div>
            <h3 className="text-3xl font-black text-emerald-600">{stats.paid.toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">KWD</span></h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2.5rem] p-8 bg-white border-b-8 border-blue-500 ring-1 ring-black/5 group hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.activeContracts', 'العقود النشطة', 'Active Awards')}</p>
               <Handshake className="h-5 w-5 text-blue-500 opacity-20" />
            </div>
            <h3 className="text-3xl font-black text-blue-600">{stats.activeContracts}</h3>
         </Card>
         <Card className="border-0 shadow-lg rounded-[2.5rem] p-8 bg-white border-b-8 border-orange-400 ring-1 ring-black/5 group hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.pendingBalance', 'الرصيد المتبقي المستحق', 'Pending Balance')}</p>
               <DollarSign className="h-5 w-5 text-orange-500 opacity-20" />
            </div>
            <h3 className="text-3xl font-black text-orange-600">{stats.pending.toLocaleString()} <span className="text-xs font-bold text-slate-400 uppercase">KWD</span></h3>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         <div className="lg:col-span-8 space-y-8">
            <Card className="border-0 shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/5">
               <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4 text-start">
                     <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/10"><Gavel className="h-6 w-6" /></div>
                     <div>
                        <CardTitle className="text-xl font-black font-headline">{tSafe('subcon.contractsArchive', 'أرشيف الاتفاقيات المسندة', 'Contracts & Award History')}</CardTitle>
                        <p className="text-xs font-bold text-slate-400 italic mt-1">{tSafe('subcon.contractsArchiveDesc', 'تتبع تفصيلي لمواعيد ومبالغ وحالات التعاقد مع المقاول.', 'Detailed tracking of award dates, amounts, and statuses.')}</p>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto">
                  <Table>
                     <TableHeader className="bg-muted/10 border-b">
                        <TableRow>
                           <TableHead className="py-6 ps-10 text-start text-[10px] font-black uppercase tracking-widest">{tSafe('common.project', 'المشروع / العقد', 'Project / Award')}</TableHead>
                           <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{tSafe('common.date', 'التاريخ', 'Date')}</TableHead>
                           <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{tSafe('common.amount', 'القيمة', 'Value')}</TableHead>
                           <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('common.status', 'الحالة', 'Status')}</TableHead>
                           <TableHead className="pe-10"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {contractsLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                        ) : contracts?.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-black italic">{tSafe('subcon.noContracts', 'لا يوجد عقود مبرمة حالياً مع هذا المقاول.', 'No contracts awarded to this subcontractor yet.')}</TableCell></TableRow>
                        ) : contracts?.map((contract: any) => (
                          <TableRow key={contract.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 group">
                             <TableCell className="py-6 ps-10 text-start">
                                <div className="text-start">
                                   <p className="font-black text-slate-800 text-sm leading-tight">{contract.name}</p>
                                   <div className="flex items-center gap-2 mt-1.5">
                                      <Badge variant="outline" className="h-5 px-2 bg-white text-slate-400 border-slate-100 text-[8px] font-black uppercase">{contract.projectTitle}</Badge>
                                      {contract.pricingMode && <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest italic">{t(contract.pricingMode)}</span>}
                                   </div>
                                </div>
                             </TableCell>
                             <TableCell className="text-start">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                   <Calendar className="h-3 w-3" />
                                   {contract.createdAt?.toDate().toLocaleDateString()}
                                </div>
                             </TableCell>
                             <TableCell className="text-end">
                                <span className="font-mono font-black text-slate-900 text-lg">
                                   {contract.totalAmount?.toLocaleString()} <span className="text-[10px] opacity-40">KWD</span>
                                </span>
                             </TableCell>
                             <TableCell className="text-center">
                                <Badge className={cn(
                                  "font-black px-4 py-1 rounded-xl border-0 shadow-sm uppercase text-[9px]",
                                  contract.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                                )}>
                                   {contract.status}
                                </Badge>
                             </TableCell>
                             <TableCell className="pe-10 text-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-10 w-10 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-sm"
                                  onClick={() => router.push(`/dashboard/procurement/subcontractors/contracts/${contract.id}`)}
                                >
                                   <ExternalLink className="h-5 w-5" />
                                </Button>
                             </TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>

            <div className="p-10 rounded-[3rem] bg-primary/5 border-2 border-dashed border-primary/20 flex items-start gap-6 text-start shadow-inner">
               <ShieldCheck className="h-8 w-8 text-primary shrink-0 mt-1" />
               <div className="space-y-1">
                  <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest">{tSafe('subcon.compliance', 'امتثال القوى العاملة الخارجية', 'Labor Compliance Status')}</h5>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                     {tSafe('subcon.complianceDesc', 'يتم مراجعة كافة المبالغ المسندة للمقاول ومطابقتها مع الإنجاز الميداني الموثق في رادار التنفيذ لضمان صحة الصرف.', 'All awarded amounts are cross-referenced with field execution logs to ensure disbursement integrity.')}
                  </p>
               </div>
            </div>
         </div>

         <aside className="lg:col-span-4 space-y-6">
            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/5 text-start">
               <CardHeader className="bg-slate-50 border-b p-8 text-start">
                  <CardTitle className="text-base font-black flex items-center gap-3 uppercase tracking-widest text-slate-700">
                     <Info className="h-4 w-4 text-primary" /> {tSafe('common.info', 'بيانات التعريف', 'Identity Profile')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.civilId', 'الرقم المدني / السجل', 'Civil ID / Registration')}</p>
                     <p className="text-sm font-black text-slate-800 font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">{subcontractor.civilId || '---'}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tSafe('common.email', 'البريد الإلكتروني', 'Email')}</p>
                     <p className="text-sm font-black text-slate-800">{subcontractor.email || '---'}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.performance', 'تقييم الأداء العام', 'Performance Rating')}</p>
                     <div className="flex items-center gap-1.5 bg-amber-50 p-3 rounded-xl border border-amber-100 w-fit px-6">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-black text-lg text-amber-700">{subcontractor.rating || '5.0'}</span>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-[2.5rem] bg-slate-900 p-10 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5"><Landmark className="h-32 w-32" /></div>
               <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3 text-primary">
                     <History className="h-6 w-6" />
                     <h4 className="font-black text-lg uppercase tracking-tight">{tSafe('subcon.activity', 'الموقف الميداني', 'Field Status')}</h4>
                  </div>
                  <div className="space-y-6 pt-4">
                     <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <p className="text-xs font-bold text-slate-400">{tSafe('subcon.visitLogs', 'الزيارات الموثقة', 'Visit Logs')}</p>
                        <span className="font-black text-xl">0</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-400">{tSafe('subcon.activeWorkers', 'عمالة موقع جارية', 'Active Workers')}</p>
                        <span className="font-black text-xl text-primary">0</span>
                     </div>
                  </div>
               </div>
            </Card>
         </aside>
      </div>
    </div>
  );
}

