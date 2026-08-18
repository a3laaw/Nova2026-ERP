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
  Plus,
  ArrowRight,
  X,
  Gavel,
  Clock,
  Landmark,
  Layers,
  LayoutGrid
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Quotation } from '@/types/documents';
import { TechnicalStage } from '@/types/reference';
import { PricingMode, QuotationItem } from '@/types/templates';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function QuotationViewPage() {
  const params = useParams();
  const quotationId = params.qId as string;
  const clientId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isEditing, setIsEditing] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const [editData, setEditForm] = useState<Partial<Quotation>>({
    name: '',
    totalAmount: 0,
    pricingMode: 'percentage',
    items: [],
    defaultTerms: '',
    status: 'draft'
  });

  const quoteRef = useMemo(() => 
    companyId && db ? doc(db, paths.quotations(companyId), quotationId) : null, 
  [db, companyId, quotationId]);

  const { data: quote, loading } = useDoc<Quotation>(quoteRef);

  useEffect(() => {
    if (quote && !hasAutoOpened) {
      setEditForm({
        ...quote,
        name: quote.name || '',
        items: quote.items || [],
        totalAmount: quote.totalAmount || 0,
        defaultTerms: quote.defaultTerms || '',
        pricingMode: quote.pricingMode || 'percentage'
      });
      if (quote.status === 'draft' && !quote.isHistoryRecorded) {
        setIsEditing(true);
      }
      setHasAutoOpened(true);
    }
  }, [quote, hasAutoOpened]);

  const stagesQuery = useMemo(() => {
    const actId = editData.activityTypeId || quote?.activityTypeId;
    const srvId = editData.serviceId || quote?.serviceId;
    const subId = editData.subServiceId || quote?.subServiceId;

    if (!companyId || !db || !actId || !srvId || !subId) return null;
    return query(collection(db, paths.technicalStages(companyId, actId, srvId, subId)), orderBy('order'));
  }, [db, companyId, editData.activityTypeId, editData.serviceId, editData.subServiceId, quote]);
  
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const stats = useMemo(() => {
    const items = editData.items || [];
    const activeItems = items.filter((i: any) => !i.deleted);
    const totalPercentage = activeItems.reduce((acc, item) => acc + (Number(item.percentage) || 0), 0);
    const totalItemizedAmount = activeItems.reduce((acc, item) => acc + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1)), 0);
    const isPercentageMode = editData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;
    return { totalPercentage, totalItemizedAmount, isValid };
  }, [editData.items, editData.pricingMode]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (editData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: t('common.error'), 
        description: tSafe('inline.percentage.error', `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)`, `Total percentage must be 100%`)
      });
      return;
    }

    setSaving(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const finalAmount = editData.pricingMode === 'itemized' 
        ? stats.totalItemizedAmount 
        : (editData.totalAmount || 0);
      
      const newStatus = (quote?.status === 'draft' && !quote.isHistoryRecorded) ? 'approved' : editData.status;

      const { id, createdAt, updatedAt, ...sanitizedData } = editData as any;
      const finalItems = (editData.items || [])
        .filter((i: any) => !i.deleted)
        .map(i => {
           const { deleted, ...cleanItem } = i;
           return cleanItem;
        });

      await service.updateQuotation(quotationId, {
        ...sanitizedData,
        status: newStatus,
        items: finalItems,
        totalAmount: finalAmount,
        updatedBy: user.uid
      }, user.uid);
      
      toast({ title: t('common.saved') });
      setIsEditing(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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
        globalUser?.username || 'Admin'
      );
      toast({ title: t('quotations.convertedToContract') });
      router.push(`/dashboard/clients/${clientId}/contracts/${contractId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
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

  const updateItem = (idx: number, field: keyof QuotationItem, val: any) => {
    const newItems = [...(editData.items || [])];
    const item = { ...newItems[idx], [field]: val };
    
    if (editData.pricingMode === 'percentage' && (field === 'percentage' || field === 'amount')) {
      const total = editData.totalAmount || 0;
      if (field === 'percentage') {
        item.amount = Math.round(((total * (Number(val) || 0)) / 100) * 1000) / 1000;
      } else if (field === 'amount' && total > 0) {
        item.percentage = (Number(val) / total) * 100;
      }
    }

    newItems[idx] = item;
    setEditForm({ ...editData, items: newItems });
  };

  const addItem = () => {
    const activeItems = (editData.items || []).filter((i: any) => !i.deleted);
    const nextIdx = activeItems.length;
    setEditForm({
      ...editData,
      items: [...(editData.items || []), { 
        label: `Installment ${nextIdx + 1}`, 
        description: '',
        percentage: 0, 
        unitPrice: 0, 
        quantity: 0, 
        timing: 'at',
        technicalStageId: ''
      }]
    });
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!quote) return <div className="p-20 text-center font-black">404 - Not Found</div>;

  const activeItemsForDisplay = (editData.items || []).filter((i: any) => !i.deleted);
  const currentDisplayAmount = isEditing 
    ? (editData.pricingMode === 'itemized' ? stats.totalItemizedAmount : (editData.totalAmount || 0))
    : (quote.totalAmount || 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-white" dir={dir}>
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-8 pt-6 text-start">
        <div className="flex items-center gap-4 text-start">
           <Button 
             variant="ghost" 
             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${quote.transactionId}`)} 
             className="h-10 w-10 p-0 rounded-xl border-2 bg-white text-slate-400 hover:text-slate-900 transition-all shadow-sm shrink-0"
           >
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-2">
                 <h1 className="text-2xl font-black text-slate-900">{t('common.quotation')}</h1>
                 <Badge className={cn(
                   "font-black px-4 py-1.5 rounded-xl shadow-sm uppercase text-[10px]",
                   (editData.status || quote.status) === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary text-white'
                 )}>
                    {editData.status || quote.status}
                 </Badge>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {quote.id.slice(-8).toUpperCase()} | {t(editData.pricingMode || 'itemized')}</p>
           </div>
        </div>
        <div className="flex gap-3">
           {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" size="sm" className="h-10 px-8 rounded-xl font-bold bg-white border-2">
                   {t('common.cancel')}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="h-10 px-10 rounded-xl font-black gap-2 shadow-xl border-b-4 border-orange-700">
                   {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                   {quote.status === 'draft' && !quote.isHistoryRecorded ? tSafe('quotations.commitAndSave', 'اعتماد وحفظ العرض', 'Commit & Save') : t('common.saveChanges')}
                </Button>
              </>
           ) : (
             <>
               <Button 
                 onClick={handleConvertToContract} 
                 disabled={converting}
                 variant="outline" 
                 size="sm" 
                 className="rounded-xl h-10 px-8 font-black gap-2 bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
               >
                  {converting ? <Loader2 className="animate-spin h-4 w-4" /> : <Gavel className="h-4 w-4" />}
                  {t('convertToContract')}
               </Button>
               <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-xl h-10 px-8 font-black gap-2 border-2 bg-white text-primary hover:bg-primary/5">
                  <Edit3 className="h-4 w-4" /> {tSafe('inline.edit.template', 'تعديل البنود', 'Edit Items')}
               </Button>
               <Button onClick={() => window.print()} size="sm" className="rounded-xl h-10 px-10 font-black gap-2 bg-slate-900 text-white shadow-xl">
                  <Printer className="h-4 w-4" /> {t('common.print')}
               </Button>
             </>
           )}
        </div>
      </div>

      <div className="px-8">
        <PrintWrapper title={t('common.quotation')} fullWidth={true}>
           <div className="space-y-12 text-start">
              
              <div className="p-10 rounded-[3rem] bg-white border-2 border-primary/10 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden shadow-xl ring-1 ring-black/[0.02]">
                 <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-48 w-48 text-primary" /></div>
                 <div className="space-y-4 relative z-10 text-start">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">{tSafe('inline.to', 'السادة المحترمون /', 'To:')}</p>
                       <h2 className="text-4xl font-black font-headline text-slate-900">{quote.clientName}</h2>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.subject', 'الموضوع /', 'Subject:')}</p>
                       {isEditing ? (
                          <Input value={editData.name || ''} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-10 rounded-2xl text-lg bg-slate-50 shadow-inner" />
                       ) : (
                          <p className="text-xl font-black text-primary">{quote.name}</p>
                       )}
                    </div>
                 </div>
                 <div className="text-center md:text-end relative z-10 shrink-0">
                    <div className="bg-primary/5 p-10 rounded-[2.5rem] border-2 border-white shadow-xl ring-4 ring-white">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{tSafe('inline.total.amount', 'إجمالي قيمة العرض', 'Total Proposal Value')}</p>
                       <h3 className="text-5xl font-black font-headline text-slate-900">
                          {(currentDisplayAmount || 0).toLocaleString()} <span className="text-sm font-bold opacity-40">KWD</span>
                       </h3>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="flex justify-between items-center px-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                       <LayoutGrid className="h-5 w-5 text-primary" /> {tSafe('inline.pricing.payments', 'جدول بنود التسعير والدفعات', 'Pricing & Payments')}
                    </h4>
                    {isEditing && (
                      <Button variant="outline" size="sm" onClick={addItem} className="rounded-xl font-black text-[10px] border-2 h-9 px-8 gap-3 bg-white hover:bg-primary/5 shadow-md">
                         <Plus className="h-4 w-4 text-primary" /> {tSafe('inline.add.detail', 'إضافة بند', 'Add Item')}
                      </Button>
                    )}
                 </div>

                 <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-xs text-start">
                       <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                             <th className="p-6 w-12 text-start">#</th>
                             <th className="p-6 text-start">{tSafe('inline.item.label', 'مسمى البند / الدفعة', 'Description')}</th>
                             {editData.pricingMode === 'percentage' && <th className="p-6 text-center w-24">%</th>}
                             {isEditing && <th className="p-6 text-center w-32">{tSafe('inline.timing', 'التوقيت', 'Timing')}</th>}
                             <th className="p-6 text-start w-48">{tSafe('inline.technical.link', 'الارتباط الفني', 'Technical Link')}</th>
                             <th className="p-6 text-end pe-12 w-48">{tSafe('inline.amount', 'القيمة', 'Amount')}</th>
                             {isEditing && <th className="p-6 w-14"></th>}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {activeItemsForDisplay.map((item, idx) => {
                             const originalIdx = (editData.items || []).indexOf(item);
                             const lineAmount = editData.pricingMode === 'percentage' 
                               ? ((currentDisplayAmount || 0) * (item.percentage || 0)) / 100 
                               : (item.unitPrice || 0) * (item.quantity || 1);
                             
                             const linkedStageName = stages?.find(s => s.id === item.technicalStageId)?.name;

                             return (
                               <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                                  <td className="p-4 text-start">
                                     {isEditing ? (
                                        <div className="space-y-2">
                                           <Input value={item.label || ''} onChange={e => updateItem(originalIdx, 'label', e.target.value)} className="h-8 rounded-xl font-black text-sm bg-white border-2" />
                                        </div>
                                     ) : (
                                        <div className="space-y-1">
                                           <p className="font-black text-slate-900 text-base">{item.label}</p>
                                        </div>
                                     )}
                                  </td>
                                  {editData.pricingMode === 'percentage' && (
                                     <td className="p-4 text-center">
                                        {isEditing ? (
                                           <div className="relative w-20 mx-auto">
                                              <Input type="number" value={item.percentage || 0} onChange={e => updateItem(originalIdx, 'percentage', Number(e.target.value))} className="h-8 rounded-xl border-2 font-black text-center text-sm" />
                                           </div>
                                        ) : <Badge className="bg-slate-900 text-white font-black text-sm px-4 py-1 rounded-xl shadow-sm">{item.percentage}%</Badge>}
                                     </td>
                                  )}
                                  {isEditing && (
                                     <td className="p-4">
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
                                        <Select value={item.technicalStageId || 'SIGNING'} onValueChange={v => updateItem(originalIdx, 'technicalStageId', v)}>
                                           <SelectTrigger className={cn(
                                             "h-8 rounded-xl border-2 font-black text-xs",
                                             item.technicalStageId ? "bg-primary/5 text-primary border-primary/20" : "bg-white"
                                           )}>
                                             <SelectValue placeholder="..." />
                                           </SelectTrigger>
                                           <SelectContent className="max-h-[300px] overflow-y-auto rounded-xl border-2 shadow-2xl z-[160]">
                                              <SelectItem value="SIGNING" className="font-black text-[10px] py-3 border-b border-slate-50">
                                                 <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {t('contractSigning')}</span>
                                              </SelectItem>
                                              {stages?.map(s => (
                                                <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3">
                                                   <span className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> {s.name}</span>
                                                </SelectItem>
                                              ))}
                                           </SelectContent>
                                        </Select>
                                     ) : (
                                        <Badge variant="outline" className={cn(
                                          "font-black text-[10px] border-0 px-4 h-7 rounded-lg shadow-sm",
                                          item.technicalStageId === 'SIGNING' ? "bg-emerald-50 text-emerald-600" : (item.technicalStageId ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-300")
                                        )}>
                                           {item.technicalStageId === 'SIGNING' ? tSafe('inline.signing', 'توقيع', 'Signing') : (item.technicalStageId ? (linkedStageName || tSafe('inline.linked', 'مرتبط', 'Linked')) : '---')}
                                        </Badge>
                                     )}
                                  </td>
                                  <td className="p-4 text-end pe-12 w-48">
                                     {isEditing && editData.pricingMode !== 'percentage' ? (
                                        <div className="flex items-center gap-2 justify-end">
                                           <Input type="number" step="1" value={item.quantity || 0} onChange={e => updateItem(originalIdx, 'quantity', Number(e.target.value))} className="h-8 w-14 text-center font-black border-2 rounded-xl" />
                                           <Input type="number" step="0.001" value={item.unitPrice || 0} onChange={e => {
                                              updateItem(originalIdx, 'unitPrice', Number(e.target.value));
                                              updateItem(originalIdx, 'amount', (item.quantity || 0) * Number(e.target.value));
                                           }} className="h-8 w-24 text-end font-black text-emerald-600 text-sm bg-slate-50 border-2 rounded-xl" />
                                        </div>
                                     ) : (
                                        <p className="font-mono font-black text-emerald-600 text-2xl">{(lineAmount || 0).toLocaleString()} <span className="text-xs opacity-40">KWD</span></p>
                                     )}
                                  </td>
                                  {isEditing && <td className="p-4 text-center"><Trash2 className="h-6 w-6 text-rose-300 cursor-pointer hover:text-rose-600 transition-colors" onClick={() => updateItem(originalIdx, 'deleted', true)} /></td>}
                               </tr>
                             );
                          })}
                       </tbody>
                       <tfoot className="bg-slate-50 border-t-8 border-primary">
                          <tr>
                             <td colSpan={editData.pricingMode === 'percentage' ? (isEditing ? 5 : 4) : (isEditing ? 4 : 3)} className="p-10 text-start">
                                <h3 className="text-2xl font-black font-headline uppercase tracking-tighter text-slate-800">{tSafe('inline.total.amount', 'إجمالي قيمة عرض السعر المقترح', 'Total Quotation Proposed Value')}</h3>
                             </td>
                             <td colSpan={2} className="p-10 text-end pe-12">
                                <div className="space-y-1">
                                   <h2 className="text-5xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{tSafe('inline.kuwaiti.dinars', 'دينار كويتي لا غير', 'KUWAITI DINARS ONLY')}</p>
                                </div>
                             </td>
                             {isEditing && <td></td>}
                          </tr>
                       </tfoot>
                    </table>
                 </div>
              </div>

              <div className="space-y-6 text-start pt-10">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3 border-b-4 border-primary/20 pb-4">
                    <ShieldCheck className="h-6 w-6 text-primary" /> {t('defaultTerms')}
                 </h4>
                 {isEditing ? (
                    <Textarea value={editData.defaultTerms || ''} onChange={e => setEditForm({...editData, defaultTerms: e.target.value})} className="min-h-[250px] rounded-[3rem] border-2 p-10 text-lg font-bold leading-relaxed bg-slate-50 focus:bg-white transition-all shadow-inner" />
                 ) : (
                    <p className="p-12 bg-slate-50/50 rounded-[4rem] border-2 border-white shadow-inner text-base font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic text-start">
                       {quote.defaultTerms}
                    </p>
                 )}
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}
