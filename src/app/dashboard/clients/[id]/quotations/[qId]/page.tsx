'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, FileText, 
  ShieldCheck, 
  Loader2, Save,
  Edit3, Trash2, Calculator,
  Percent,
  CheckCircle2,
  Workflow,
  LayoutGrid,
  Plus,
  ArrowRight,
  X,
  Gavel,
  Clock
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Quotation } from '@/types/documents';
import { TechnicalStage } from '@/types/reference';
import { PricingMode, QuotationItem, MilestoneTiming } from '@/types/templates';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * صفحة عرض عرض السعر (Official Quotation View).
 * تم تطهير اللون الكحلي بالكامل واستبداله بتصميم فاتح ومشرق.
 */
export default function QuotationViewPage() {
  const params = useParams();
  const quotationId = params.qId as string;
  const clientId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isEditing, setIsEditing] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [editData, setEditForm] = useState<Partial<Quotation>>({});

  const quoteRef = useMemo(() => 
    companyId && db ? doc(db, paths.quotations(companyId), quotationId) : null, 
  [db, companyId, quotationId]);

  const { data: quote, loading } = useDoc<Quotation>(quoteRef);

  useEffect(() => {
    if (quote && !hasAutoOpened) {
      setEditForm(quote);
      if (quote.status === 'draft' && !quote.isHistoryRecorded) {
        setIsEditing(true);
      }
      setHasAutoOpened(true);
    }
  }, [quote, hasAutoOpened]);

  const stagesQuery = useMemo(() => {
    if (!companyId || !db || !editData.activityTypeId || !editData.serviceId || !editData.subServiceId) return null;
    return query(collection(db, paths.technicalStages(companyId, editData.activityTypeId!, editData.serviceId!, editData.subServiceId!)), orderBy('order'));
  }, [db, companyId, editData.activityTypeId, editData.serviceId, editData.subServiceId]);
  
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const stats = useMemo(() => {
    const items = editData.items || [];
    const activeItems = items.filter((i: any) => !i.deleted);
    const totalPercentage = activeItems.reduce((acc, item) => acc + (item.percentage || 0), 0);
    const totalItemizedAmount = activeItems.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 1)), 0);
    const isPercentageMode = editData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;
    return { totalPercentage, totalItemizedAmount, isValid };
  }, [editData.items, editData.pricingMode]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (editData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "خطأ في الميزانية" : "Budget Mismatch", 
        description: isRtl ? `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)` : `Total percentage must be 100%` 
      });
      return;
    }

    setSaving(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const finalAmount = editData.pricingMode === 'itemized' 
        ? stats.totalItemizedAmount 
        : (editData.totalAmount || quote?.totalAmount || 0);
      
      const { id, createdAt, updatedAt, ...sanitizedData } = editData as any;
      const finalItems = (editData.items || [])
        .filter((i: any) => !i.deleted)
        .map(i => {
           const { deleted, ...cleanItem } = i;
           return cleanItem;
        });

      await service.updateQuotation(quotationId, {
        ...sanitizedData,
        items: finalItems,
        totalAmount: finalAmount,
        updatedByName: globalUser?.username || user.displayName || 'Admin'
      }, user.uid);
      
      toast({ title: isRtl ? "تم اعتماد وحفظ العرض بنجاح" : "Quotation Saved & Committed" });
      setIsEditing(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToContract = async () => {
    if (!db || !companyId || !user) return;
    setConverting(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const contractId = await service.convertQuotationToContract(
        quotationId, 
        user.uid, 
        globalUser?.username || user.displayName || 'Admin'
      );
      toast({ title: isRtl ? "تم تحويل العرض إلى عقد رسمي" : "Quotation converted to Contract" });
      router.push(`/dashboard/clients/${clientId}/contracts/${contractId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setConverting(false);
    }
  };

  const handleCancel = () => {
    if (quote && !quote.isHistoryRecorded) {
      router.push(`/dashboard/clients/${clientId}/transactions/${quote.transactionId}`);
    } else {
      setIsEditing(false);
      setEditForm(quote || {});
    }
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const newItems = [...(editData.items || [])];
    (newItems[idx] as any)[field] = val;
    setEditForm({ ...editData, items: newItems });
  };

  const addItem = () => {
    const activeItems = (editData.items || []).filter((i: any) => !i.deleted);
    const nextIdx = activeItems.length;
    setEditForm({
      ...editData,
      items: [...(editData.items || []), { 
        label: getOrdinalLabel(nextIdx), 
        percentage: 0, 
        unitPrice: 0, 
        quantity: 1, 
        description: '',
        timing: 'at',
        technicalStageId: ''
      }]
    });
  };

  const getOrdinalLabel = (index: number) => {
    const arOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const enOrdinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const base = isRtl ? "الدفعة" : "Installment";
    const ordinal = isRtl ? (arOrdinals[index] || `#${index + 1}`) : (enOrdinals[index] || `#${index + 1}`);
    return `${base} ${ordinal}`;
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!quote) return <div className="p-20 text-center font-black">{isRtl ? 'المستند غير موجود' : 'Quotation not found'}</div>;

  const activeItemsForDisplay = (editData.items || []).filter((i: any) => !i.deleted);
  const currentDisplayAmount = isEditing 
    ? (editData.pricingMode === 'itemized' ? stats.totalItemizedAmount : (editData.totalAmount || quote.totalAmount || 0))
    : (quote.totalAmount || 0);

  const getTimingLabel = (time: MilestoneTiming) => {
    return t(time);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-[#fdfaf3]" dir={dir}>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-6 pt-6 text-start">
        <div className="flex items-center gap-4">
           <Button 
             variant="ghost" 
             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${quote.transactionId}`)} 
             className="h-10 w-10 p-0 rounded-xl border-2 bg-white text-slate-400 hover:text-slate-900 transition-all shadow-sm shrink-0"
           >
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-2">
                 <h1 className="text-xl font-black text-slate-900">{isRtl ? 'عرض سعر رسمي' : 'Official Quotation'}</h1>
                 <Badge variant="outline" className="h-6 px-4 font-black text-[9px] uppercase bg-primary text-white border-0 shadow-sm">{editData.status || quote.status}</Badge>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {quote.id.slice(-8).toUpperCase()} | {editData.pricingMode}</p>
           </div>
        </div>
        <div className="flex gap-2">
           {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" size="sm" className="h-10 px-6 font-bold bg-white border-2 rounded-xl">
                   {isRtl ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="h-10 px-8 rounded-xl font-black gap-2 shadow-xl border-b-4 border-orange-700">
                   {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                   {quote.status === 'draft' && !quote.isHistoryRecorded ? (isRtl ? 'اعتماد وحفظ عرض السعر' : 'Commit & Save') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}
                </Button>
              </>
           ) : (
             <>
               <Button 
                 onClick={handleConvertToContract} 
                 disabled={converting}
                 variant="outline" 
                 size="sm" 
                 className="rounded-xl h-10 px-6 font-black gap-2 bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
               >
                  {converting ? <Loader2 className="animate-spin h-4 w-4" /> : <Gavel className="h-4 w-4" />}
                  {t('convertToContract')}
               </Button>
               <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black gap-2 border-2 bg-white text-primary hover:bg-primary/5">
                  <Edit3 className="h-4 w-4" /> {isRtl ? 'تعديل البنود' : 'Edit Template'}
               </Button>
               <Button onClick={() => window.print()} size="sm" className="rounded-xl h-10 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl">
                  <Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}
               </Button>
             </>
           )}
        </div>
      </div>

      <PrintWrapper title={isRtl ? "عرض سعر فني ومالي" : "Technical & Financial Proposal"} className="mt-2">
         <div className="space-y-8 text-start">
            <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20 flex items-center justify-between gap-4 shadow-sm print:hidden">
                <div className="flex items-center gap-4 text-start">
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg"><Calculator className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[7px] font-black uppercase text-primary tracking-widest">Pricing Mode</p>
                    {isEditing ? (
                      <Select value={editData.pricingMode} onValueChange={(v: PricingMode) => setEditForm({...editData, pricingMode: v})}>
                         <SelectTrigger className="h-10 w-40 rounded-xl border-2 bg-white text-slate-900 font-black text-xs mt-1"><SelectValue /></SelectTrigger>
                         <SelectContent className="rounded-xl border-2 shadow-2xl">
                            <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                            <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                            <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                         </SelectContent>
                      </Select>
                    ) : <span className="text-xs font-black uppercase text-slate-900">{editData.pricingMode}</span>}
                  </div>
                </div>
                
                {(editData.pricingMode === 'percentage' || editData.pricingMode === 'fixed') && (
                  <div className="space-y-1 text-start w-48">
                     <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</Label>
                     {isEditing ? (
                       <div className="relative">
                          <Input 
                            type="number" 
                            value={editData.totalAmount === 0 ? "" : editData.totalAmount} 
                            onChange={e => setEditForm({...editData, totalAmount: e.target.value === "" ? 0 : Number(e.target.value)})} 
                            className="h-10 rounded-xl border-2 bg-white text-slate-900 font-black text-xl text-center shadow-inner" 
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300">KWD</div>
                       </div>
                     ) : <p className="font-black text-2xl text-slate-900">{(editData.totalAmount || 0).toLocaleString()} <span className="text-xs text-slate-400">KWD</span></p>}
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-4 border-primary/20 pb-6">
               <div className="text-start space-y-4">
                  <div className="space-y-0.5">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'السادة المحترمون /' : 'To:'}</p>
                     <p className="text-lg font-black text-slate-900">{quote.clientName}</p>
                  </div>
                  <div className="space-y-0.5">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الموضوع /' : 'Subject:'}</p>
                     {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-12 rounded-xl text-sm" />
                     ) : (
                        <p className="text-base font-black text-primary">{quote.name}</p>
                     )}
                  </div>
               </div>
               <div className="text-start md:text-end">
                  <div className="bg-slate-50/50 p-6 rounded-3xl border-2 border-white shadow-inner inline-block min-w-[200px]">
                     <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase gap-6">
                           <span className="text-slate-400">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                           <span className="text-slate-900">{(quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date()).toLocaleDateString()}</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="space-y-4 text-start">
               <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <LayoutGrid className="h-4 w-4 text-primary" /> {isRtl ? 'جدول بنود التسعير والدفعات' : 'Pricing & Payments'}
                  </h4>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={addItem} className="rounded-xl font-black text-[10px] border-2 h-9 px-6 gap-2 bg-white hover:bg-primary/5">
                       <Plus className="h-4 w-4" /> {isRtl ? 'إضافة بند' : 'Add Item'}
                    </Button>
                  )}
               </div>

               <div className="border-2 border-slate-200 rounded-[2rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                  <table className="w-full text-xs text-start">
                     <thead className="bg-slate-50 border-b-2 border-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest">
                        <tr className="font-black uppercase text-[9px] tracking-widest">
                           <th className="p-4 text-start w-10">#</th>
                           <th className="p-4 text-start">{isRtl ? 'مسمى البند / الدفعة' : 'Description'}</th>
                           {editData.pricingMode === 'percentage' && <th className="p-4 text-center w-20">%</th>}
                           {isEditing && <th className="p-4 text-center w-28">{isRtl ? 'التوقيت' : 'Timing'}</th>}
                           <th className="p-4 text-start w-48">{isRtl ? 'الارتباط الفني' : 'Technical Link'}</th>
                           <th className="p-4 text-end pe-10 w-40">{isRtl ? 'القيمة' : 'Amount'}</th>
                           {isEditing && <th className="p-4 w-12"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {activeItemsForDisplay.map((item, idx) => {
                           const originalIdx = (editData.items || []).indexOf(item);
                           const lineAmount = editData.pricingMode === 'percentage' 
                             ? ((editData.totalAmount || 0) * (item.percentage || 0)) / 100 
                             : (item.unitPrice || 0);
                           
                           const linkedStageName = stages?.find(s => s.id === item.technicalStageId)?.name;

                           return (
                             <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-black text-slate-300 text-start">{idx + 1}</td>
                                <td className="p-4 text-start">
                                   {isEditing ? (
                                      <div className="space-y-2">
                                         <Input value={item.label} onChange={e => updateItem(originalIdx, 'label', e.target.value)} className="h-10 rounded-xl font-black text-sm bg-white" />
                                         <Input value={item.description} onChange={e => updateItem(originalIdx, 'description', e.target.value)} className="h-8 text-[10px] font-medium opacity-70 bg-slate-50" placeholder={isRtl ? "وصف إضافي..." : "Add detail..."} />
                                         
                                         {item.technicalStageId && item.technicalStageId !== 'NONE' && (
                                            <p className="text-[8px] font-black text-primary/60 italic flex items-center gap-1 mt-1">
                                               <Clock className="h-3 w-3" />
                                               {getTimingLabel(item.timing || 'at')} {item.technicalStageId === 'SIGNING' ? (isRtl ? 'توقيع العقد' : 'Contract Signing') : linkedStageName}
                                            </p>
                                         )}
                                      </div>
                                   ) : (
                                      <div className="space-y-1">
                                         <p className="font-black text-slate-900 text-sm">{item.label}</p>
                                         {item.description && <p className="text-[11px] font-bold text-slate-400 leading-tight">{item.description}</p>}
                                         {item.technicalStageId && item.technicalStageId !== 'NONE' && (
                                            <p className="text-[10px] font-black text-primary/60 italic flex items-center gap-1">
                                               <Clock className="h-3 w-3" />
                                               {getTimingLabel(item.timing || 'at')} {item.technicalStageId === 'SIGNING' ? (isRtl ? 'توقيع العقد' : 'Contract Signing') : linkedStageName}
                                            </p>
                                         )}
                                      </div>
                                   )}
                                </td>
                                {editData.pricingMode === 'percentage' && (
                                   <td className="p-4 text-center">
                                      {isEditing ? (
                                         <div className="relative w-20 mx-auto">
                                            <Input type="number" value={item.percentage === 0 ? "" : item.percentage} onChange={e => updateItem(originalIdx, 'percentage', e.target.value === "" ? 0 : Number(e.target.value))} className="h-10 rounded-xl border-2 font-black text-center pe-6 text-sm" />
                                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                         </div>
                                      ) : <Badge className="bg-slate-900 text-white font-black text-[10px] px-3 h-6 rounded-lg shadow-sm">{item.percentage}%</Badge>}
                                   </td>
                                )}
                                {isEditing && (
                                   <td className="p-2">
                                      <Select value={item.timing || 'at'} onValueChange={v => updateItem(originalIdx, 'timing', v)}>
                                         <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            <SelectItem value="at" className="font-bold text-xs">{t('at')}</SelectItem>
                                            <SelectItem value="before" className="font-bold text-xs">{t('before')}</SelectItem>
                                            <SelectItem value="during" className="font-bold text-xs">{t('during')}</SelectItem>
                                            <SelectItem value="after" className="font-bold text-xs">{t('after')}</SelectItem>
                                         </SelectContent>
                                      </Select>
                                   </td>
                                )}
                                <td className="p-4 text-start">
                                   {isEditing ? (
                                      <Select 
                                        value={item.technicalStageId || 'SIGNING'} 
                                        onValueChange={v => updateItem(originalIdx, 'technicalStageId', v)}
                                      >
                                         <SelectTrigger className={cn(
                                           "h-10 rounded-xl border-2 font-black text-xs",
                                           (item.technicalStageId && item.technicalStageId !== 'NONE') ? "bg-primary/5 text-primary border-primary/20" : "bg-white"
                                         )}>
                                            <SelectValue placeholder={isRtl ? "ربط فني..." : "Link Stage..."} />
                                         </SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            <SelectItem value="SIGNING" className="font-black text-xs py-3">
                                               <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 text-emerald-500" /> {isRtl ? 'عند توقيع العقد (حر)' : 'At Signing'}</span>
                                            </SelectItem>
                                            <SelectItem value="NONE" className="font-bold text-xs text-slate-400 italic">--- {isRtl ? 'بدون ربط' : 'No Link'} ---</SelectItem>
                                            {stages?.map(s => (
                                              <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3">
                                                 <span className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> {s.name}</span>
                                              </SelectItem>
                                            ))}
                                         </SelectContent>
                                      </Select>
                                   ) : (
                                      <Badge variant="outline" className={cn(
                                        "font-black text-[10px] border-0 px-4 h-6 rounded-lg shadow-sm",
                                        item.technicalStageId === 'SIGNING' ? "bg-emerald-50 text-emerald-600" : (item.technicalStageId ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-300")
                                      )}>
                                         {item.technicalStageId === 'SIGNING' ? (isRtl ? 'عند التوقيع' : 'Signing') : (item.technicalStageId ? (linkedStageName || 'Linked') : '---')}
                                      </Badge>
                                   )}
                                </td>
                                <td className="p-4 text-end pe-10 w-40">
                                   {isEditing && editData.pricingMode !== 'percentage' ? (
                                      <Input type="number" step="0.001" value={item.unitPrice === 0 ? "" : item.unitPrice} onChange={e => updateItem(originalIdx, 'unitPrice', e.target.value === "" ? 0 : Number(e.target.value))} className="h-10 w-32 ms-auto text-end font-black text-emerald-600 text-sm bg-slate-50 border-2" />
                                   ) : (
                                      <p className="font-mono font-black text-emerald-600 text-lg">{(lineAmount || 0).toLocaleString()} <span className="text-[10px] opacity-40">KWD</span></p>
                                   )}
                                </td>
                                {isEditing && <td className="p-4 text-center"><Trash2 className="h-5 w-5 text-rose-300 cursor-pointer hover:text-rose-500" onClick={() => updateItem(originalIdx, 'deleted', true)} /></td>}
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-50 border-t-4 border-primary">
                        <tr>
                           <td colSpan={editData.pricingMode === 'percentage' ? (isEditing ? 5 : 4) : (isEditing ? 4 : 3)} className="p-8 text-start">
                              <h3 className="text-base font-black font-headline uppercase tracking-tighter text-slate-900">{isRtl ? 'إجمالي قيمة العرض' : 'Total Quote Value'}</h3>
                              {editData.pricingMode === 'percentage' && (
                                 <Badge className={cn("mt-2 border-0 text-[10px] font-black h-6 px-4 shadow-sm", stats.isValid ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                                    {stats.isValid ? `BALANCED: ${stats.totalPercentage}%` : `MISMATCH: ${stats.totalPercentage}%`}
                                 </Badge>
                              )}
                           </td>
                           <td colSpan={2} className="p-8 text-end pe-10">
                              <div className="space-y-0.5">
                                 <h2 className="text-4xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Kuwaiti Dinars</p>
                              </div>
                           </td>
                           {isEditing && <td></td>}
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            <div className="text-start space-y-4 pt-6">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/20 pb-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> {isRtl ? 'الشروط العامة والالتزامات' : 'Terms & Conditions'}
               </h4>
               {isEditing ? (
                  <Textarea value={editData.defaultTerms} onChange={e => setEditForm({...editData, defaultTerms: e.target.value})} className="min-h-[150px] rounded-[2rem] border-2 p-8 text-sm font-bold leading-relaxed bg-slate-50/50 shadow-inner" />
               ) : (
                  <p className="p-10 bg-slate-50/50 rounded-[3rem] border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                     {quote.defaultTerms}
                  </p>
               )}
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}