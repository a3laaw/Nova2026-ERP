'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, FileText, 
  ShieldCheck, 
  DollarSign, Gavel, Loader2, Save,
  Edit3, X, Plus, Trash2, Calculator,
  Layers, Percent, Target,
  FileSearch,
  CheckCircle2
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Quotation } from '@/types/documents';
import { PricingMode } from '@/types/templates';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { format, addDays } from 'date-fns';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function QuotationViewPage() {
  const params = useParams();
  const quotationId = params.qId as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const db = useFirestore();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditForm] = useState<Partial<Quotation>>({});

  const quoteRef = useMemo(() => 
    companyId && db ? doc(db, paths.quotations(companyId), quotationId) : null, 
  [db, companyId, quotationId]);

  const { data: quote, loading } = useDoc<Quotation>(quoteRef);

  useEffect(() => {
    if (quote) {
      setEditForm(quote);
    }
  }, [quote]);

  const stats = useMemo(() => {
    const items = editData.items || [];
    const mode = editData.pricingMode || 'itemized';
    const totalPercentage = items.reduce((acc, item) => acc + (item.percentage || 0), 0);
    const totalItemizedAmount = items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 1)), 0);
    
    const isPercentageMode = mode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;

    return {
      totalPercentage,
      totalItemizedAmount,
      isValid
    };
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
      const service = new DocumentService(db, companyId);
      const finalAmount = editData.pricingMode === 'itemized' ? stats.totalItemizedAmount : (editData.totalAmount || 0);
      
      await service.updateQuotation(quotationId, {
        ...editData,
        totalAmount: finalAmount
      }, user.uid);
      
      toast({ title: isRtl ? "تم تحديث العرض بنجاح" : "Quotation Updated" });
      setIsEditing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const newItems = [...(editData.items || [])];
    (newItems[idx] as any)[field] = val;
    setEditForm({ ...editData, items: newItems });
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!quote) return <div className="p-20 text-center font-black">{isRtl ? 'المستند غير موجود' : 'Quotation not found'}</div>;

  const currentDisplayAmount = isEditing 
    ? (editData.pricingMode === 'itemized' ? stats.totalItemizedAmount : (editData.totalAmount || 0))
    : (quote.totalAmount || 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-in fade-in duration-700" dir={dir}>
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden border-b pb-4">
        <div className="text-start">
          <div className="flex items-center gap-2">
             <h1 className="text-xl font-black text-[#1e1b4b]">{isRtl ? 'عرض سعر رسمي' : 'Official Quotation'}</h1>
             <Badge variant="outline" className="h-5 px-2 border-2 font-black text-[8px] uppercase">{editData.status || quote.status}</Badge>
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ref: {quote.id.slice(-8).toUpperCase()}</p>
        </div>
        <div className="flex gap-2">
           {isEditing ? (
              <>
                <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="rounded-lg h-9 px-4 font-bold border-2">
                   {isRtl ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-lg h-9 px-6 font-black gap-2 bg-emerald-600 text-white shadow-lg">
                   {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                   {isRtl ? 'حفظ' : 'Save'}
                </Button>
              </>
           ) : (
             <>
               <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-lg h-9 px-4 font-black gap-2 border-2 text-primary hover:bg-primary/5">
                  <Edit3 className="h-4 w-4" /> {isRtl ? 'تعديل' : 'Edit'}
               </Button>
               <Button onClick={() => window.print()} size="sm" className="rounded-lg h-9 px-6 font-black gap-2 bg-slate-900 text-white shadow-lg">
                  <Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}
               </Button>
             </>
           )}
        </div>
      </div>

      <PrintWrapper title={isRtl ? "عرض سعر فني ومالي" : "Technical & Financial Proposal"}>
         <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-2 border-slate-900 pb-6">
               <div className="text-start space-y-4">
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'السادة المحترمون /' : 'To:'}</p>
                     <p className="text-xl font-black text-slate-900">{quote.clientName}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الموضوع /' : 'Subject:'}</p>
                     {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-9 text-sm" />
                     ) : (
                        <p className="text-base font-black text-primary">{quote.name}</p>
                     )}
                  </div>
               </div>
               <div className="text-start md:text-end">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block min-w-[200px]">
                     <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                           <span className="text-slate-400">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                           <span className="text-slate-900">{(quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date()).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-primary">
                           <span>{isRtl ? 'صلاحية العرض' : 'Valid For'}</span>
                           <div className="flex items-center gap-2">
                              {isEditing ? (
                                <input type="number" value={editData.validDays} onChange={e => setEditForm({...editData, validDays: Number(e.target.value)})} className="w-10 h-5 border rounded text-center bg-white" />
                              ) : <span>{quote.validDays}</span>}
                              <span>{isRtl ? 'يوم' : 'Days'}</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {isEditing && (
              <div className="p-4 bg-[#1e1b4b] rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                 <div className="flex items-center gap-4 text-start">
                    <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-white shadow-md"><Calculator className="h-5 w-5" /></div>
                    <div className="text-start">
                       <p className="text-[8px] font-black text-primary uppercase tracking-widest">Pricing Engine</p>
                       <h4 className="font-black text-sm">تعديل الميزانية ونمط الحساب</h4>
                    </div>
                 </div>
                 
                 <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-end">
                    <div className="space-y-1 text-start w-full md:w-36">
                        <Label className="text-[9px] font-black uppercase text-slate-400">{isRtl ? 'نمط الحساب' : 'Mode'}</Label>
                        <Select value={editData.pricingMode} onValueChange={(v: PricingMode) => setEditForm({...editData, pricingMode: v})}>
                            <SelectTrigger className="h-8 rounded-lg bg-white/10 border-white/20 text-white font-black text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                                <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                                <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(editData.pricingMode === 'percentage' || editData.pricingMode === 'fixed') && (
                       <div className="space-y-1 text-start w-full md:w-48">
                          <Label className="text-[9px] font-black uppercase text-primary tracking-widest">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</Label>
                          <Input 
                            type="number" 
                            value={editData.totalAmount || 0} 
                            onChange={e => setEditForm({...editData, totalAmount: Number(e.target.value)})}
                            className="h-8 rounded-lg bg-white text-slate-900 font-black text-lg text-center"
                          />
                       </div>
                    )}
                 </div>
              </div>
            )}

            <div className="text-start space-y-2">
               <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'تحية طيبة وبعد،،' : 'Introduction'}
               </h4>
               {isEditing ? (
                  <Textarea value={editData.introText} onChange={e => setEditForm({...editData, introText: e.target.value})} className="min-h-[80px] rounded-xl border-2 p-4 font-bold text-xs bg-slate-50/30" />
               ) : (
                  <div className="p-6 bg-white rounded-2xl border-2 border-slate-50 shadow-sm leading-relaxed text-slate-700 font-bold text-base italic whitespace-pre-wrap">
                     {quote.introText}
                  </div>
               )}
            </div>

            <div className="space-y-4 text-start">
               <div className="flex justify-between items-center">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Layers className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'جدول بنود التسعير والدفعات' : 'Pricing & Payments'}
                  </h4>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setEditForm({...editData, items: [...(editData.items || []), { label: '', unitPrice: 0, percentage: 0, quantity: 1, description: '' }]})} className="rounded-lg font-black text-[9px] border-2 h-7 px-3 gap-1">
                       <Plus className="h-3 w-3" /> {isRtl ? 'إضافة' : 'Add'}
                    </Button>
                  )}
               </div>

               <div className="border-2 border-slate-900 rounded-[1.5rem] overflow-hidden bg-white shadow-lg">
                  <table className="w-full text-xs text-start">
                     <thead className="bg-slate-900 text-white">
                        <tr className="font-black uppercase text-[9px] tracking-widest">
                           <th className="p-4 text-start w-12">#</th>
                           <th className="p-4 text-start">{isRtl ? 'توصيف البند / الدفعة' : 'Description'}</th>
                           {editData.pricingMode === 'percentage' && <th className="p-4 text-center w-24">{isRtl ? 'الحصة' : 'Share'}</th>}
                           <th className="p-4 text-end pe-8 w-40">{isRtl ? 'القيمة' : 'Amount'}</th>
                           {isEditing && <th className="p-4 w-12"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {editData.items?.map((item, idx) => {
                           const lineAmount = editData.pricingMode === 'percentage' 
                             ? ((editData.totalAmount || 0) * (item.percentage || 0)) / 100 
                             : (item.unitPrice || 0);
                           
                           return (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-black text-slate-300 text-start">{idx + 1}</td>
                                <td className="p-4 text-start">
                                   {isEditing ? (
                                      <div className="space-y-1">
                                         <Input value={item.label} onChange={e => updateItem(idx, 'label', e.target.value)} className="h-7 rounded-md font-black text-[11px]" />
                                         <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="h-7 text-[9px] font-medium opacity-70" />
                                      </div>
                                   ) : (
                                      <div className="space-y-0.5">
                                         <p className="font-black text-slate-900 text-sm">{item.label}</p>
                                         <p className="text-[10px] font-bold text-slate-400 max-w-md">{item.description}</p>
                                      </div>
                                   )}
                                </td>
                                {editData.pricingMode === 'percentage' && (
                                   <td className="p-4 text-center">
                                      {isEditing ? (
                                         <div className="relative w-16 mx-auto">
                                            <Input type="number" value={item.percentage} onChange={e => updateItem(idx, 'percentage', Number(e.target.value))} className="h-7 rounded-md border-2 font-black text-center pe-5 text-[10px]" />
                                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 text-slate-300" />
                                         </div>
                                      ) : <Badge className="bg-slate-900 text-white font-black text-xs px-2 h-6 rounded-md">{item.percentage}%</Badge>}
                                   </td>
                                )}
                                <td className="p-4 text-end pe-8">
                                   {isEditing && editData.pricingMode !== 'percentage' ? (
                                      <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="h-7 rounded-md border-2 font-black text-center text-emerald-600 text-[11px] w-28 ms-auto" />
                                   ) : (
                                      <p className="font-mono font-black text-emerald-600 text-base">{(lineAmount || 0).toLocaleString()} <span className="text-[10px] opacity-40">KWD</span></p>
                                   )}
                                </td>
                                {isEditing && <td className="p-4"><Button variant="ghost" size="icon" onClick={() => updateItem(idx, 'deleted', true)} className="text-rose-300 h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button></td>}
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-900 text-white">
                        <tr>
                           <td colSpan={editData.pricingMode === 'percentage' ? 3 : 2} className="p-6 text-start">
                              <h3 className="text-lg font-black font-headline uppercase tracking-tighter">{isRtl ? 'إجمالي قيمة العرض' : 'Total Quote Value'}</h3>
                              {editData.pricingMode === 'percentage' && (
                                 <Badge className={cn("mt-2 border-0 text-[8px] font-black h-5", stats.isValid ? "bg-emerald-500 text-white" : "bg-rose-500 text-white animate-pulse")}>BALANCE: {stats.totalPercentage}%</Badge>
                              )}
                           </td>
                           <td className="p-6 text-end pe-8">
                              <div className="space-y-0.5">
                                 <h2 className="text-4xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                 <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Kuwaiti Dinars</p>
                              </div>
                           </td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            <div className="text-start space-y-4 pt-6">
               <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-2">
                  <Gavel className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'الشروط العامة والالتزامات' : 'Terms & Conditions'}
               </h4>
               {isEditing ? (
                  <Textarea value={editData.defaultTerms} onChange={e => setEditForm({...editData, defaultTerms: e.target.value})} className="min-h-[150px] rounded-xl border-2 p-4 text-[10px] font-medium bg-slate-50/30" />
               ) : (
                  <div className="p-8 bg-slate-50/50 rounded-3xl border-2 border-white shadow-inner text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                     {quote.defaultTerms}
                  </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-12 pt-12 border-t-2 border-dashed border-slate-100">
               <div className="text-start space-y-6">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'اعتماد العميل المالك' : 'Client Approval'}</p>
                     <div className="h-16 w-full border-b-2 border-slate-200" />
                  </div>
               </div>
               <div className="text-end flex flex-col items-end">
                  <div className="space-y-2 w-full max-w-[200px]">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'ختم الشركة الرسمي' : 'Official Stamp'}</p>
                     <div className="h-24 w-24 rounded-2xl border-4 border-slate-50 flex items-center justify-center ms-auto bg-white shadow-lg rotate-3">
                        <ShieldCheck className="h-10 w-10 text-slate-100" />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}