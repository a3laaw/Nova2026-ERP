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
  ShieldAlert, Edit3, Save, X, Copy
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

export default function FieldVisitDetailsPage() {
  const visitId = useParams().id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { isAdmin, permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isEditing, setIsEditing] = useState(false);
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

  const handleUpdateItem = (idx: number, field: string, val: any) => {
    const newItems = [...editItems];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setEditItems(newItems);
  };

  const handleSaveEdit = async () => {
    if (!db || !companyId || !visitId) return;
    setSaving(true);
    try {
      await updateDoc(visitRef!, {
        items: editItems,
        isEdited: true,
        updatedAt: serverTimestamp(),
        updatedByName: globalUser?.fullName || user?.displayName || 'Admin'
      });
      toast({ title: isRtl ? "تم تحديث التقرير بنجاح" : "Report Updated" });
      setIsEditing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
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
      toast({ title: isRtl ? "تم اعتماد الإنجاز للاستحقاق" : "Progress Verified" });
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
              <h1 className="text-3xl font-black font-headline text-slate-900">{isRtl ? 'تقرير إنجاز ميداني متكامل' : 'Sovereign Field Log'}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{visit.clientName} | Project: {visit.transactionNumber}</p>
           </div>
        </div>
        
        <div className="flex gap-3">
           {!visit.isVerified && isAdmin && !isEditing && (
             <Button onClick={handleVerify} disabled={verifying} className="h-14 px-8 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-100 gap-2">
                {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                {isRtl ? 'اعتماد للاستحقاق' : 'Verify Billing'}
             </Button>
           )}
           {!isEditing ? (
             <>
               <Button onClick={() => setIsEditing(true)} variant="outline" className="h-14 px-8 rounded-2xl border-2 font-black gap-2 bg-white shadow-sm">
                 <Edit3 className="h-5 w-5" /> {isRtl ? 'تعديل التقرير' : 'Edit Report'}
               </Button>
               <Button onClick={handleClone} variant="outline" className="h-14 px-8 rounded-2xl border-2 font-black gap-2 bg-blue-50 text-blue-600 border-blue-100">
                 <Copy className="h-5 w-5" /> {isRtl ? 'استنساخ لتاريخ آخر' : 'Clone to Date'}
               </Button>
             </>
           ) : (
             <div className="flex gap-2">
               <Button onClick={() => setIsEditing(false)} variant="outline" className="h-14 px-6 rounded-2xl border-2 font-bold">إلغاء</Button>
               <Button onClick={handleSaveEdit} disabled={saving} className="h-14 px-10 rounded-2xl bg-primary text-white font-black shadow-xl gap-2">
                 {saving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
               </Button>
             </div>
           )}
           <Button variant="outline" onClick={() => window.print()} className="h-14 px-6 rounded-2xl border-2 font-black gap-2 bg-slate-900 text-white shadow-xl">
              <Printer className="h-5 w-5" /> {isRtl ? 'طباعة' : 'Print'}
           </Button>
        </div>
      </div>

      <PrintWrapper title={isRtl ? "تقرير إنجاز ميداني وتحليل موارد" : "Verified Field Progress Log"}>
         <div className="space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-b-4 border-primary/20 pb-10">
               <div className="space-y-4 text-start">
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client Name</p><p className="text-2xl font-black text-slate-900">{visit.clientName}</p></div>
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Site Engineer</p><p className="text-xl font-bold text-primary">{visit.recordedByName || visit.engineerName}</p></div>
               </div>
               <div className="space-y-4 md:text-end">
                  <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Execution Date</p><p className="text-2xl font-black text-slate-900">{visit.visitDate}</p></div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verification Status</p>
                    <Badge className={cn("font-black px-6 py-1 rounded-xl shadow-sm", visit.isVerified ? "bg-emerald-600 text-white" : "bg-blue-600 text-white")}>
                      {visit.isVerified ? 'OFFICIALLY VERIFIED' : 'PENDING REVIEW'}
                    </Badge>
                  </div>
               </div>
            </div>

            <div className="space-y-6 text-start">
               <h3 className="font-black text-xl flex items-center gap-3"><LayoutGrid className="h-6 w-6 text-primary" /> {isRtl ? 'جدول الأعمال المنجزة (BOQ)' : 'Executed Work Grid'}</h3>
               <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-xl">
                  <Table>
                     <TableHeader className="bg-slate-900">
                        <TableRow className="hover:bg-slate-900 border-0">
                           <TableHead className="ps-8 text-white font-black text-[10px] uppercase">#</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase w-[250px]">{isRtl ? 'البند المنفذ' : 'Description'}</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase w-[180px]">{isRtl ? 'رد المهندس (الحالة)' : 'Engineer Reply'}</TableHead>
                           <TableHead className="text-center text-white font-black text-[10px] uppercase w-[100px]">{isRtl ? 'الكمية' : 'Qty'}</TableHead>
                           <TableHead className="text-white font-black text-[10px] uppercase">{isRtl ? 'الملاحظات الفنية' : 'Technical Notes'}</TableHead>
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
                              <td className="py-6">
                                 {isEditing ? (
                                    <Select value={item.executionStatus} onValueChange={v => handleUpdateItem(i, 'executionStatus', v)}>
                                       <SelectTrigger className="h-9 border-2 font-black text-[9px] bg-white"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                          <SelectItem value="completed" className="text-emerald-600 font-bold text-[10px]">تم الإنجاز بالكامل</SelectItem>
                                          <SelectItem value="partial" className="text-amber-600 font-bold text-[10px]">إنجاز جزئي</SelectItem>
                                          <SelectItem value="not_completed" className="text-rose-600 font-bold text-[10px]">لم يتم الإنجاز</SelectItem>
                                       </SelectContent>
                                    </Select>
                                 ) : (
                                    <Badge className={cn(
                                       "font-black text-[8px] border-0",
                                       item.executionStatus === 'completed' ? "bg-emerald-50 text-emerald-600" :
                                       item.executionStatus === 'partial' ? "bg-amber-50 text-amber-600" :
                                       "bg-rose-50 text-rose-600"
                                    )}>
                                       {item.executionStatus === 'completed' ? 'تم الإنجاز' : item.executionStatus === 'partial' ? 'إنجاز جزئي' : 'لم يتم'}
                                    </Badge>
                                 )}
                              </td>
                              <td className="py-6 text-center">
                                 {isEditing ? (
                                    <Input type="number" value={item.quantity} onChange={e => handleUpdateItem(i, 'quantity', Number(e.target.value))} className="h-9 text-center font-black border-2" />
                                 ) : <span className="font-black text-lg text-primary">{item.quantity}</span>}
                              </td>
                              <td className="py-6 text-start">
                                 {isEditing ? (
                                    <Input value={item.notes} onChange={e => handleUpdateItem(i, 'notes', e.target.value)} className="h-9 border-2 text-xs font-bold" />
                                 ) : <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{item.notes}"</p>}
                              </td>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-start">
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2"><Users className="h-4 w-4 text-primary" /> {isRtl ? 'توزيع الموارد البشرية' : 'Labor Summary'}</h4>
                  <div className="space-y-3">
                     {visit.laborDetails?.map((l: any, i: number) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border-2 border-white flex justify-between items-center shadow-inner group hover:bg-white transition-all">
                           <span className="font-black text-xs text-slate-700">{l.trade}</span>
                           <Badge className="bg-slate-900 text-white font-black px-4">{l.count} Staff</Badge>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/10 pb-2"><Truck className="h-4 w-4 text-primary" /> {isRtl ? 'المعدات والآليات' : 'Equipment & Fleet'}</h4>
                  <div className="space-y-3">
                     {visit.equipmentUsed?.map((e: any, i: number) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border-2 border-white flex justify-between items-center shadow-inner group hover:bg-white transition-all">
                           <span className="font-black text-xs text-slate-700">{e.name}</span>
                           <Badge variant="outline" className="text-primary border-primary/20 font-black px-4 bg-white">{e.hoursUsed} hrs</Badge>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {visit.items?.some((i:any) => i.photoUrls?.length > 0) && (
              <div className="space-y-6 text-start pt-6 border-t border-slate-50">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Camera className="h-4 w-4 text-primary" /> {isRtl ? 'معرض صور الإنجاز الميداني' : 'Photo Evidence Gallery'}</h4>
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
