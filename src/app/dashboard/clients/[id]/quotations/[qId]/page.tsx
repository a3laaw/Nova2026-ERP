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
  Layers, Percent, Target
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

  // Sovereign Thaw: Ensure interaction is possible
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';
    }
  }, []);

  const quoteRef = useMemo(() => 
    companyId && db ? doc(db, paths.quotations(companyId), quotationId) : null, 
  [db, companyId, quotationId]);

  const { data: quote, loading } = useDoc<Quotation>(quoteRef);

  useEffect(() => {
    if (quote) {
      setEditForm(quote);
    }
  }, [quote]);

  const expiryDate = useMemo(() => {
    const q = isEditing ? editData : quote;
    if (!q?.createdAt || !q.validDays) return null;
    const createdDate = q.createdAt.toDate ? q.createdAt.toDate() : new Date(q.createdAt);
    return format(addDays(createdDate, q.validDays), 'yyyy-MM-dd');
  }, [quote, editData, isEditing]);

  // محرك الحسابات الذكي السيادي
  const stats = useMemo(() => {
    const items = editData.items || [];
    const mode = editData.pricingMode || 'itemized';
    const totalBaseline = Number(editData.totalAmount || 0);
    
    const totalItemsValue = items.reduce((acc, item) => acc + (Number(item.unitPrice || 0) * Number(item.quantity || 1)), 0);
    const totalPercentage = items.reduce((acc, item) => acc + (Number(item.percentage || 0)), 0);
    
    return {
      totalItemsValue,
      totalPercentage,
      totalBaseline,
      isValid: mode === 'percentage' ? Math.abs(totalPercentage - 100) < 0.1 : true
    };
  }, [editData.items, editData.pricingMode, editData.totalAmount]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    
    if (editData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "خطأ في توزيع الحصص" : "Percentage Mismatch", 
        description: isRtl ? `يجب أن يكون مجموع النسب 100% (الحالي: ${stats.totalPercentage}%)` : `Total must be 100% (Current: ${stats.totalPercentage}%)` 
      });
      return;
    }

    setSaving(true);
    try {
      const service = new DocumentService(db, companyId);
      // في حالة البنود، الإجمالي هو مجموع البنود. في حالة النسب/المقطوع، الإجمالي هو الرقم المدخل يدوياً.
      const finalTotal = editData.pricingMode === 'itemized' ? stats.totalItemsValue : stats.totalBaseline;
      
      await service.updateQuotation(quotationId, {
        ...editData,
        totalAmount: finalTotal
      }, user.uid);
      
      toast({ title: isRtl ? "تم حفظ التعديلات بنجاح" : "Quotation Saved" });
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

  const removeItem = (idx: number) => {
    const newItems = (editData.items || []).filter((_, i) => i !== idx);
    setEditForm({ ...editData, items: newItems });
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!quote) return <div className="p-20 text-center font-black">{isRtl ? 'المستند غير موجود' : 'Quotation not found'}</div>;

  const currentTotal = isEditing 
    ? (editData.pricingMode === 'itemized' ? stats.totalItemsValue : stats.totalBaseline)
    : (quote.totalAmount || 0);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700" dir={dir}>
      
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden border-b pb-6">
        <div className="text-start space-y-1">
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-black font-headline text-[#1e1b4b]">{isRtl ? 'عرض سعر رسمي' : 'Official Quotation'}</h1>
             <Badge variant="outline" className="h-6 px-3 border-2 font-black text-[10px] uppercase">{editData.status || quote.status}</Badge>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref: {quote.id.slice(-8).toUpperCase()} | Mode: {editData.pricingMode || quote.pricingMode}</p>
        </div>
        <div className="flex gap-4">
           {isEditing ? (
              <>
                <Button onClick={() => setIsEditing(false)} variant="outline" className="rounded-2xl h-14 px-8 font-black gap-2 border-2">
                   <X className="h-5 w-5" /> {isRtl ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSave} disabled={saving} className="rounded-2xl h-14 px-10 font-black gap-2 bg-emerald-600 text-white shadow-xl shadow-emerald-100 hover:scale-105 transition-all">
                   {saving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                   {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
                </Button>
              </>
           ) : (
             <>
               <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-2xl h-14 px-8 font-black gap-2 border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                  <Edit3 className="h-5 w-5" /> {isRtl ? 'تعديل البيانات' : 'Edit Quote'}
               </Button>
               <Button onClick={() => window.print()} className="rounded-2xl h-14 px-10 font-black gap-2 bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all">
                  <Printer className="h-6 w-6" /> {isRtl ? 'طباعة المستند' : 'Print Official Copy'}
               </Button>
             </>
           )}
        </div>
      </div>

      <PrintWrapper title={isRtl ? "عرض سعر فني ومالي" : "Technical & Financial Proposal"}>
         <div className="space-y-12">
            
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-b-4 border-slate-900 pb-10">
               <div className="text-start space-y-6">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'السادة المحترمون /' : 'To:'}</p>
                     <p className="text-2xl font-black text-slate-900">{quote.clientName}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الموضوع /' : 'Subject:'}</p>
                     {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-12 text-lg" />
                     ) : (
                        <p className="text-lg font-black text-primary">{quote.name}</p>
                     )}
                  </div>
               </div>
               <div className="text-start md:text-end space-y-4">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 inline-block min-w-[280px] shadow-inner">
                     <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase">
                           <span className="text-slate-400">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                           <span className="text-slate-900 font-mono">{(quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date()).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-primary">
                           <span>{isRtl ? 'صلاحية العرض' : 'Valid Until'}</span>
                           <div className="flex items-center gap-2">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={editData.validDays} 
                                  onChange={e => setEditForm({...editData, validDays: Number(e.target.value)})}
                                  className="w-12 h-6 border-2 rounded text-center bg-white font-black"
                                />
                              ) : <span>{quote.validDays}</span>}
                              <span>{isRtl ? 'يوم' : 'Days'}</span>
                           </div>
                        </div>
                        <div className="pt-2 border-t border-dashed border-slate-200">
                           <p className="text-[10px] font-bold text-slate-400 italic text-center">{expiryDate || '---'}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Introduction */}
            <div className="text-start space-y-4">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> {isRtl ? 'تحية طيبة وبعد،،' : 'Introduction'}
               </h4>
               {isEditing ? (
                  <Textarea 
                    value={editData.introText} 
                    onChange={e => setEditForm({...editData, introText: e.target.value})} 
                    className="min-h-[120px] rounded-2xl border-2 p-6 font-bold leading-relaxed bg-slate-50/30"
                  />
               ) : (
                  <div className="p-10 bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm leading-relaxed text-slate-700 font-bold text-lg italic whitespace-pre-wrap">
                     {quote.introText}
                  </div>
               )}
            </div>

            {/* Pricing Mode Selector (Edit Only) */}
            {isEditing && (
              <div className="p-6 bg-[#1e1b4b] rounded-3xl text-white flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4">
                 <div className="flex items-center gap-4 text-start">
                    <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary"><Layers className="h-6 w-6" /></div>
                    <div className="text-start">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pricing Strategy</p>
                       <h4 className="font-black text-sm">تغيير منطق التسعير للعرض</h4>
                    </div>
                 </div>
                 <Select value={editData.pricingMode} onValueChange={(v: PricingMode) => setEditForm({...editData, pricingMode: v})}>
                    <SelectTrigger className="w-64 h-11 rounded-xl bg-white/10 border-white/20 text-white font-black"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="itemized" className="font-bold">حسب البنود (Qty x Rate)</SelectItem>
                       <SelectItem value="fixed" className="font-bold">مبلغ مقطوع (Fixed Total)</SelectItem>
                       <SelectItem value="percentage" className="font-bold">نسب مئوية (Percentage of Total)</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            )}

            {/* Items Table */}
            <div className="space-y-6 text-start">
               <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Calculator className="h-4 w-4 text-primary" /> {isRtl ? 'جدول بنود التسعير والدفعات' : 'Pricing & Payment Milestones'}
                  </h4>
                  {isEditing && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditForm({...editData, items: [...(editData.items || []), { label: '', unitPrice: 0, percentage: 0, quantity: 1, description: '' }]})}
                      className="rounded-xl font-black text-[10px] border-2 h-9 px-4 gap-2"
                    >
                       <Plus className="h-3.5 w-3.5" /> {isRtl ? 'إضافة بند' : 'Add Line'}
                    </Button>
                  )}
               </div>

               <div className="border-4 border-slate-900 rounded-[3rem] overflow-hidden shadow-2xl bg-white">
                  <table className="w-full text-sm text-start">
                     <thead className="bg-slate-900 text-white">
                        <tr className="font-black uppercase text-[10px] tracking-widest">
                           <th className="p-8 text-start w-16">#</th>
                           <th className="p-8 text-start">{isRtl ? 'توصيف البند / الدفعة' : 'Item Description'}</th>
                           {editData.pricingMode === 'itemized' && <th className="p-8 text-center w-24">{isRtl ? 'الكمية' : 'Qty'}</th>}
                           {editData.pricingMode === 'percentage' && <th className="p-8 text-center w-32">{isRtl ? 'الحصة' : 'Share'}</th>}
                           <th className="p-8 text-end pe-12 w-48">{isRtl ? 'القيمة' : 'Amount'}</th>
                           {isEditing && <th className="p-8 w-16"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y-2 divide-slate-50">
                        {editData.items?.map((item, idx) => {
                           // حساب القيمة بناءً على النمط
                           const lineAmount = editData.pricingMode === 'percentage' 
                             ? (stats.totalBaseline * (item.percentage || 0)) / 100 
                             : (editData.pricingMode === 'itemized' 
                                ? (item.unitPrice || 0) * (item.quantity || 1) 
                                : (item.unitPrice || 0));
                           
                           return (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-8 font-black text-slate-300 text-start">{idx + 1}</td>
                                <td className="p-8 text-start">
                                   {isEditing ? (
                                      <div className="space-y-3">
                                         <Input value={item.label} onChange={e => updateItem(idx, 'label', e.target.value)} className="font-black border-2 h-11" placeholder="اسم البند..." />
                                         <Textarea value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="text-xs h-20" placeholder="وصف فني..." />
                                      </div>
                                   ) : (
                                      <div className="space-y-2">
                                         <p className="font-black text-slate-900 text-xl tracking-tight">{item.label}</p>
                                         <p className="text-xs font-bold text-slate-500 leading-relaxed max-w-lg">{item.description}</p>
                                      </div>
                                   )}
                                </td>
                                
                                {editData.pricingMode === 'itemized' && (
                                   <td className="p-8 text-center bg-slate-50/50">
                                      {isEditing ? (
                                         <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="font-black text-center border-2 h-12 w-20 mx-auto" />
                                      ) : (
                                         <span className="font-black text-slate-600">{item.quantity}</span>
                                      )}
                                   </td>
                                )}

                                {editData.pricingMode === 'percentage' && (
                                   <td className="p-8 text-center bg-slate-50/50">
                                      {isEditing ? (
                                         <div className="relative w-24 mx-auto">
                                            <Input type="number" value={item.percentage} onChange={e => updateItem(idx, 'percentage', Number(e.target.value))} className="font-black text-center border-2 h-12 pe-8" />
                                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-primary" />
                                         </div>
                                      ) : (
                                         <Badge className="bg-slate-900 text-white font-black text-lg h-10 px-4 rounded-xl">{item.percentage}%</Badge>
                                      )}
                                   </td>
                                )}

                                <td className="p-8 text-end pe-12">
                                   {isEditing && editData.pricingMode !== 'percentage' ? (
                                      <div className="space-y-2">
                                         <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="font-black text-center border-2 h-12 text-emerald-600 text-xl" />
                                         {editData.pricingMode === 'itemized' && <p className="text-[9px] font-black text-slate-400 text-center uppercase">Per Unit Rate</p>}
                                      </div>
                                   ) : (
                                      <div className="space-y-1">
                                         <p className="font-mono font-black text-emerald-600 text-2xl tracking-tighter">{(lineAmount || 0).toLocaleString()} <span className="text-xs opacity-40">KWD</span></p>
                                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'صافي القيمة' : 'Net Amount'}</span>
                                      </div>
                                   )}
                                </td>

                                {isEditing && (
                                   <td className="p-8">
                                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-300 hover:text-rose-600">
                                         <Trash2 className="h-5 w-5" />
                                      </Button>
                                   </td>
                                )}
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-900 text-white">
                        <tr>
                           <td colSpan={2} className="p-10 text-start">
                              <h3 className="text-2xl font-black font-headline uppercase tracking-tighter">{isRtl ? 'إجمالي قيمة العرض' : 'Total Quotation Value'}</h3>
                              {editData.pricingMode === 'percentage' && (
                                 <div className={cn(
                                   "mt-4 flex items-center gap-2 px-4 py-2 rounded-xl border-2 w-fit",
                                   stats.isValid ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-rose-500/10 border-rose-500 text-rose-400 animate-pulse"
                                 )}>
                                    <Target className="h-4 w-4" />
                                    <span className="text-xs font-black uppercase">Percentage Total: {stats.totalPercentage}%</span>
                                 </div>
                              )}
                           </td>
                           <td colSpan={isEditing ? (editData.pricingMode === 'fixed' || editData.pricingMode === 'percentage' ? 2 : 3) : (editData.pricingMode === 'fixed' || editData.pricingMode === 'percentage' ? 1 : 2)} className="p-10 text-end pe-12">
                              {isEditing && (editData.pricingMode === 'fixed' || editData.pricingMode === 'percentage') ? (
                                <div className="space-y-2 animate-in zoom-in-95">
                                   <Label className="text-white/40 text-[10px] uppercase font-black tracking-widest">
                                      {editData.pricingMode === 'percentage' ? (isRtl ? 'أدخل المبلغ الإجمالي للاحتساب' : 'Set Total Baseline Amount') : (isRtl ? 'أدخل القيمة الإجمالية' : 'Set Fixed Total')}
                                   </Label>
                                   <Input 
                                      type="number" 
                                      value={editData.totalAmount || 0} 
                                      onChange={e => setEditForm({...editData, totalAmount: Number(e.target.value)})}
                                      className="bg-white/10 border-0 text-white font-black text-5xl h-24 rounded-3xl text-center shadow-inner focus:ring-primary"
                                   />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                   <h2 className="text-7xl font-black font-headline text-primary">
                                      {(currentTotal || 0).toLocaleString()}
                                   </h2>
                                   <p className="text-xl font-black text-white/30 uppercase tracking-[0.3em]">Kuwaiti Dinars</p>
                                </div>
                              )}
                           </td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            {/* Terms and Conditions */}
            <div className="text-start space-y-6 pt-10">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-100 pb-4">
                  <Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'الشروط العامة والالتزامات التعاقدية' : 'Terms, Conditions & Clauses'}
               </h4>
               {isEditing ? (
                  <Textarea 
                    value={editData.defaultTerms} 
                    onChange={e => setEditForm({...editData, defaultTerms: e.target.value})} 
                    className="min-h-[250px] rounded-[2.5rem] border-2 p-8 font-medium bg-slate-50/30 shadow-inner"
                    placeholder="اكتب الشروط هنا..."
                  />
               ) : (
                  <div className="p-12 bg-slate-50/50 rounded-[3.5rem] border-2 border-white shadow-inner">
                     <div className="text-sm font-bold text-slate-600 leading-loose columns-1 md:columns-2 gap-16 whitespace-pre-wrap">
                        {quote.defaultTerms}
                     </div>
                  </div>
               )}
            </div>

            {/* Signature Section */}
            <div className="grid grid-cols-2 gap-24 pt-24 border-t-2 border-dashed border-slate-100">
               <div className="text-start space-y-12">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isRtl ? 'اعتماد العميل المالك' : 'Client Approval'}</p>
                     <div className="h-24 w-full border-b-4 border-slate-200" />
                     <p className="text-[9px] font-bold text-slate-300 italic">{isRtl ? 'التوقيع والختم الشخصي' : 'Signature & Personal Stamp'}</p>
                  </div>
               </div>
               <div className="text-end space-y-8 flex flex-col items-end">
                  <div className="space-y-4 w-full max-w-[280px]">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isRtl ? 'ختم الشركة الرسمي' : 'Official Company Stamp'}</p>
                     <div className="h-32 w-32 rounded-[2.5rem] border-4 border-slate-50 flex items-center justify-center ms-auto bg-white shadow-xl rotate-6 transition-transform hover:rotate-0 duration-500">
                        <ShieldCheck className="h-14 w-14 text-slate-100" />
                     </div>
                     <p className="text-[8px] font-black text-primary uppercase mt-4">Authorized ERP Copy</p>
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
