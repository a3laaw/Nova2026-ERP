'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, ArrowRight, MapPin, 
  HardHat, Target, Users, 
  Truck, CheckCircle2, ShieldCheck,
  Camera, Info, DollarSign, Printer,
  LayoutGrid, ExternalLink,
  ShieldAlert, Edit3, Save, X, Copy,
  MessageSquare, UserCircle
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  // وضع "رد المسؤول" (The Response Mode)
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
      toast({ title: isRtl ? "تم تسجيل ردود المسؤول بنجاح" : "Engineer Responses Saved" });
      setIsReviewing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!db || !companyId || !user || !visit) return;
    
    // التحقق من أن كافة البنود تم الرد عليها
    if (editItems.some(i => i.executionStatus === 'pending')) {
       toast({ variant: "destructive", title: isRtl ? "تنبيه" : "Alert", description: isRtl ? "يجب الرد على كافة البنود وتحديد حالتها قبل الاعتماد المالي." : "All items must have a status before verification." });
       return;
    }

    setVerifying(true);
    try {
      const service = new BOQExecutionService(db, companyId, permissions);
      await service.verifyExecutionForBilling(visit.id, user.uid, globalUser?.fullName || 'Admin');
      toast({ title: isRtl ? "تم اعتماد الإنجاز للاستحقاق المالي" : "Progress Verified for Billing" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setVerifying(false);
    }
  };

  const handleClone = () => {
    router.push(`/dashboard/construction/field-visits/new?cloneId=${visitId}`);
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!visit) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-6 text-center">
       <div className="h-20 w-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="h-10 w-10" />
       </div>
       <div><h2 className="text-xl font-black text-slate-800">404 - التقرير غير موجود</h2></div>
       <Button onClick={() => router.push('/dashboard/construction/field-visits')} variant="outline" className="rounded-xl px-8 h-10">العودة للسجل</Button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 bg-[#fdfaf3]" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 pt-4 print:hidden">
        <div className="flex items-center gap-4">
           <Button variant="ghost" onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl bg-white border-2 text-slate-400">
             <ArrowRight className={cn("h-5 w-5", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقرير إنجاز ميداني سيادي' : 'Sovereign Field Log'}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{visit.clientName} | Project: {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-3">
           {!visit.isVerified && isAdmin && !isReviewing && (
             <Button onClick={handleVerify} disabled={verifying} className="h-14 px-8 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-100 gap-2">
                {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                {isRtl ? 'اعتماد للاستحقاق المالي' : 'Verify for Billing'}
             </Button>
           )}
           {!isReviewing ? (
             <>
               <Button onClick={() => setIsReviewing(true)} variant="outline" className="h-14 px-8 rounded-2xl border-2 font-black gap-2 bg-primary text-white shadow-xl shadow-primary/10 hover:scale-105 transition-all">
                 <MessageSquare className="h-5 w-5" /> {isRtl ? 'تقديم رد المسؤول' : 'Engineer Response'}
               </Button>
               <Button onClick={handleClone} variant="outline" className="h-14 px-8 rounded-2xl border-2 font-black gap-2 bg-blue-50 text-blue-600 border-blue-100">
                 <Copy className="h-5 w-5" /> {isRtl ? 'استنساخ لتاريخ آخر' : 'Clone Log'}
               </Button>
             </>
           ) : (
             <div className="flex gap-2">
               <Button onClick={() => setIsReviewing(false)} variant="outline" className="h-14 px-6 rounded-2xl border-2 font-bold bg-white">إلغاء</Button>
               <Button onClick={handleSaveResponse} disabled={saving} className="h-14 px-10 rounded-2xl bg-primary text-white font-black shadow-xl gap-2">
                 {saving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} {isRtl ? 'اعتماد الردود والحفظ' : 'Confirm Responses'}
               </Button>
             </div>
           )}
           <Button variant="outline" onClick={() => window.print()} className="h-14 px-6 rounded-2xl border-2 font-black gap-2 bg-slate-900 text-white shadow-xl">
              <Printer className="h-5 w-5" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
        </div>
      </div>

      <PrintWrapper title={isRtl ? "سجل إنجاز ميداني معتمد" : "Verified Field Progress Statement"}>
         <div className="space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-b-4 border-primary/20 pb-10">
               <div className="space-y-4 text-start">
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client Name</p><p className="text-2xl font-black text-slate-900">{visit.clientName}</p></div>
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reporter (Field)</p><p className="text-xl font-bold text-primary">{visit.engineerName}</p></div>
               </div>
               <div className="space-y-4 md:text-end">
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Execution Date</p><p className="text-2xl font-black text-slate-900">{visit.visitDate}</p></div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Review Status</p>
                    <Badge className={cn("font-black px-6 py-1 rounded-xl shadow-sm", visit.isVerified ? "bg-emerald-600 text-white" : "bg-blue-600 text-white")}>
                      {visit.isVerified ? 'FINANCIALLY VERIFIED' : 'PENDING ENGINEER REPLY'}
                    </Badge>
                  </div>
               </div>
            </div>

            <div className="space-y-6 text-start">
               <div className="flex items-center gap-3">
                  <LayoutGrid className="h-6 w-6 text-primary" />
                  <h3 className="font-black text-xl">{isRtl ? 'تحليل الإنجاز الفني واعتماد المسؤول' : 'Technical Progress & Response'}</h3>
               </div>
               <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-xl">
                  <Table>
                     <TableHeader className="bg-slate-900">
                        <TableRow className="hover:bg-slate-900 border-0">
                           <TableHead className="ps-8 text-white font-black text-[10px] uppercase">#</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase w-[220px]">{isRtl ? 'البند المنفذ ميدانياً' : 'Reported Work Item'}</TableHead>
                           <TableHead className="text-center text-white font-black text-[10px] uppercase w-[80px]">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase">{isRtl ? 'ملاحظة الموقع' : 'Field Note'}</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase w-[220px] bg-primary/20">{isRtl ? 'رد المهندس المسؤول (الحالة)' : 'Engineer Reply (Status)'}</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {editItems.map((item: any, i: number) => (
                           <TableRow key={i} className="border-b-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="ps-8 py-6 font-black text-slate-300">{(i + 1).toString().padStart(2, '0')}</td>
                              <td className="py-6 text-start">
                                 <p className="font-black text-slate-800 text-sm leading-tight">{item.itemName}</p>
                                 <Badge variant="outline" className="text-[8px] font-black text-slate-400 border-slate-100 mt-1 uppercase">{item.unit || '---'}</Badge>
                              </td>
                              <td className="py-6 text-center font-black text-lg text-primary">{item.quantity}</td>
                              <td className="py-6 text-start">
                                 <p className="text-xs font-bold text-slate-600 leading-relaxed italic border-s-2 border-primary/20 ps-3">"{item.notes}"</p>
                              </td>
                              <td className="py-6 bg-primary/[0.02]">
                                 {isReviewing ? (
                                    <div className="space-y-3">
                                       <Select value={item.executionStatus || 'pending'} onValueChange={v => handleUpdateResponse(i, 'executionStatus', v)}>
                                          <SelectTrigger className="h-9 border-2 font-black text-[9px] bg-white"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="pending" className="text-slate-400 font-bold text-[10px]">بانتظار المراجعة</SelectItem>
                                             <SelectItem value="completed" className="text-emerald-600 font-bold text-[10px]">تم الإنجاز بالكامل</SelectItem>
                                             <SelectItem value="partial" className="text-amber-600 font-bold text-[10px]">إنجاز جزئي</SelectItem>
                                             <SelectItem value="not_completed" className="text-rose-600 font-bold text-[10px]">لم يتم الإنجاز</SelectItem>
                                          </SelectContent>
                                       </Select>
                                       <Input 
                                         value={item.engineerResponseNote || ''} 
                                         onChange={e => handleUpdateResponse(i, 'engineerResponseNote', e.target.value)} 
                                         placeholder={isRtl ? "ملاحظة المسؤول..." : "Response note..."}
                                         className="h-8 text-[9px] font-bold border-2 bg-white"
                                       />
                                    </div>
                                 ) : (
                                    <div className="space-y-2">
                                       <Badge className={cn(
                                          "font-black text-[8px] border-0",
                                          item.executionStatus === 'completed' ? "bg-emerald-500 text-white" :
                                          item.executionStatus === 'partial' ? "bg-amber-500 text-white" :
                                          item.executionStatus === 'not_completed' ? "bg-rose-500 text-white" :
                                          "bg-slate-100 text-slate-400"
                                       )}>
                                          {item.executionStatus === 'completed' ? 'معتمد: تم بالكامل' : 
                                           item.executionStatus === 'partial' ? 'معتمد: جزئي' : 
                                           item.executionStatus === 'not_completed' ? 'مرفوض: لم يتم' : 'بانتظار رد المسؤول'}
                                       </Badge>
                                       {item.engineerResponseNote && (
                                          <p className="text-[10px] font-black text-slate-800 flex items-center gap-1">
                                             <ShieldCheck className="h-3 w-3 text-emerald-500" /> {item.engineerResponseNote}
                                          </p>
                                       )}
                                    </div>
                                 )}
                              </td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-start">
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'توزيع الموارد البشرية' : 'Labor Allocation'}</h4>
                  <div className="space-y-3">
                     {visit.laborDetails?.map((l: any, i: number) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border-2 border-white flex justify-between items-center shadow-inner">
                           <span className="font-black text-xs text-slate-700">{l.trade}</span>
                           <Badge className="bg-slate-900 text-white font-black px-4">{l.count} Staff</Badge>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment Usage'}</h4>
                  <div className="space-y-3">
                     {visit.equipmentUsed?.map((e: any, i: number) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border-2 border-white flex justify-between items-center shadow-inner">
                           <span className="font-black text-xs text-slate-700">{e.name}</span>
                           <Badge variant="outline" className="text-primary border-primary/20 font-black px-4 bg-white">{e.hoursUsed} hrs</Badge>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {visit.items?.some((i:any) => i.photoUrls?.length > 0) && (
              <div className="space-y-6 text-start pt-6 border-t border-slate-50">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Camera className="h-4 w-4 text-primary" /> {isRtl ? 'معرض صور الموقع (إثبات ميداني)' : 'Site Evidence Gallery'}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {visit.items.flatMap((i:any) => i.photoUrls || []).map((url: string, idx: number) => (
                    <div key={idx} className="aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-xl group relative">
                       <img src={url} alt="Execution" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="ghost" onClick={() => window.open(url, '_blank')} className="text-white font-bold h-full w-full gap-2">
                             <ExternalLink className="h-4 w-4" /> Expand
                          </Button>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
         </div>
      </PrintWrapper>
    </div>
  );
}
