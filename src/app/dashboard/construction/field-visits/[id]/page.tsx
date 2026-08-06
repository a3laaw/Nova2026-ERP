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
  LayoutGrid, Save, MessageSquare, ShieldAlert
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

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
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
      toast({ title: isRtl ? "تم تسجيل ردود المسؤول بنجاح" : "Engineer Responses Saved" });
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
      toast({ title: isRtl ? "تم اعتماد الإنجاز" : "Progress Verified" });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="h-[40vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!visit) return <div className="p-20 text-center font-bold">404 - Not Found</div>;

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 print:hidden">
        <div className="flex items-center gap-3">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 rounded-md border border-slate-200 text-slate-400">
             <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{isRtl ? 'سجل إنجاز ميداني' : 'Field Log'}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{visit.clientName} | Project: {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-2">
           {!visit.isVerified && isAdmin && !isReviewing && (
             <Button onClick={handleVerify} disabled={verifying} size="sm" className="h-9 px-4 font-bold bg-emerald-600 text-white">
                {verifying ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {isRtl ? 'اعتماد للاستحقاق' : 'Verify'}
             </Button>
           )}
           {!isReviewing ? (
             <Button onClick={() => setIsReviewing(true)} variant="outline" size="sm" className="h-9 px-4 font-bold border-slate-200">
               <MessageSquare className="h-3.5 w-3.5 me-2" /> {isRtl ? 'رد المسؤول' : 'Response'}
             </Button>
           ) : (
             <div className="flex gap-2">
               <Button onClick={() => setIsReviewing(false)} variant="outline" size="sm" className="h-9 font-bold border-slate-200">إلغاء</Button>
               <Button onClick={handleSaveResponse} disabled={saving} size="sm" className="h-9 px-4 font-bold">
                 {saving ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />} {isRtl ? 'حفظ الردود' : 'Save'}
               </Button>
             </div>
           )}
           <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 px-4 font-bold border-slate-200">
              <Printer className="h-3.5 w-3.5" />
           </Button>
        </div>
      </div>

      <PrintWrapper title={isRtl ? "سجل إنجاز ميداني" : "Field Progress Statement"}>
         <div className="space-y-8 text-start">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-6">
               <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Client Name</p>
                  <p className="text-lg font-bold text-slate-900">{visit.clientName}</p>
               </div>
               <div className="md:text-end space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Execution Date</p>
                  <p className="text-lg font-bold text-slate-900">{visit.visitDate}</p>
               </div>
            </div>

            <div className="space-y-4">
               <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
                  <LayoutGrid className="h-4 w-4 text-primary" /> {isRtl ? 'تحليل الإنجاز الفني' : 'Technical Progress'}
               </h3>
               <Card className="rounded-lg border shadow-sm bg-white overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50">
                        <TableRow className="border-0">
                           <TableHead className="ps-4 text-[10px] font-bold uppercase w-[50px]">#</TableHead>
                           <TableHead className="text-[10px] font-bold uppercase">بند العمل</TableHead>
                           <TableHead className="text-center text-[10px] font-bold uppercase w-[80px]">الكمية</TableHead>
                           <TableHead className="text-[10px] font-bold uppercase">رد المسؤول</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {editItems.map((item: any, i: number) => (
                           <TableRow key={i} className="border-b-slate-100 hover:bg-slate-50">
                              <td className="ps-4 py-3 text-slate-300 font-bold">{i + 1}</td>
                              <td className="py-3">
                                 <p className="font-bold text-xs text-slate-800">{item.itemName}</p>
                                 <p className="text-[9px] text-slate-400 italic">"{item.notes}"</p>
                              </td>
                              <td className="py-3 text-center font-bold text-sm text-primary">{item.quantity}</td>
                              <td className="py-3">
                                 {isReviewing ? (
                                    <div className="flex gap-2">
                                       <Select value={item.executionStatus || 'pending'} onValueChange={v => handleUpdateResponse(i, 'executionStatus', v)}>
                                          <SelectTrigger className="h-8 text-[10px] font-bold rounded-md"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="pending">بانتظار المراجعة</SelectItem>
                                             <SelectItem value="completed" className="text-emerald-600">إنجاز كامل</SelectItem>
                                             <SelectItem value="partial" className="text-amber-600">جزئي</SelectItem>
                                             <SelectItem value="not_completed" className="text-rose-600">مرفوض</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    </div>
                                 ) : (
                                    <Badge className={cn(
                                       "text-[8px] font-bold border-0 uppercase h-5 rounded-md",
                                       item.executionStatus === 'completed' ? "bg-emerald-500 text-white" :
                                       item.executionStatus === 'partial' ? "bg-amber-500 text-white" :
                                       "bg-slate-100 text-slate-400"
                                    )}>
                                       {item.executionStatus || 'Pending'}
                                    </Badge>
                                 )}
                              </td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="h-3.5 w-3.5 text-primary" /> {t('common.labor')}</h4>
                  <div className="space-y-1.5">
                     {visit.laborDetails?.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                           <span className="font-bold text-slate-700">{l.trade}</span>
                           <span className="font-bold text-slate-400">{l.count} Staff</span>
                        </div>
                     ))}
                     {!visit.laborDetails?.length && <p className="text-[10px] text-slate-300 italic">No labor logs.</p>}
                  </div>
               </div>
               <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-primary" /> {t('common.equipment')}</h4>
                  <div className="space-y-1.5">
                     {visit.equipmentUsed?.map((e: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                           <span className="font-bold text-slate-700">{e.name}</span>
                           <span className="font-bold text-primary">{e.hoursUsed} hrs</span>
                        </div>
                     ))}
                     {!visit.equipmentUsed?.length && <p className="text-[10px] text-slate-300 italic">No equipment logs.</p>}
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
