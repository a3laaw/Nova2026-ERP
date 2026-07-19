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
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Quotation } from '@/types/documents';
import { PricingMode } from '@/types/templates';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
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
  const { permissions } = usePermissions();
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

  // محرك الحساب اللحظي
  const stats = useMemo(() => {
    const items = editData.items || [];
    // تصفية المحذوف من الحساب
    const activeItems = items.filter((i: any) => !i.deleted);
    
    const totalPercentage = activeItems.reduce((acc, item) => acc + (item.percentage || 0), 0);
    const totalItemizedAmount = activeItems.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 1)), 0);
    
    const isPercentageMode = editData.pricingMode === 'percentage';
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
      // تمرير الصلاحيات للخدمة لضمان تجاوز الفحص الأمني
      const service = new DocumentService(db, companyId, permissions);
      
      const finalAmount = editData.pricingMode === 'itemized' 
        ? stats.totalItemizedAmount 
        : (editData.totalAmount || quote?.totalAmount || 0);
      
      // تطهير الكائن المرسل
      const { id, createdAt, updatedAt, ...sanitizedData } = editData as any;
      
      // تصفية البنود المحذوفة نهائياً قبل الحفظ
      const finalItems = (editData.items || [])
        .filter((i: any) => !i.deleted)
        .map(i => {
           const { deleted, ...cleanItem } = i;
           return cleanItem;
        });

      await service.updateQuotation(quotationId, {
        ...sanitizedData,
        items: finalItems,
        totalAmount: finalAmount
      }, user.uid);
      
      toast({ title: isRtl ? "تم تحديث العرض بنجاح" : "Quotation Updated" });
      setIsEditing(false);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: t('error'),
        description: e.message || (isRtl ? "حدث خطأ أثناء الحفظ" : "Save failed")
      });
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

  const activeItemsForDisplay = (editData.items || []).filter((i: any) => !i.deleted);
  const currentDisplayAmount = isEditing 
    ? (editData.pricingMode === 'itemized' ? stats.totalItemizedAmount : (editData.totalAmount || quote.totalAmount || 0))
    : (quote.totalAmount || 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-slate-50" dir={dir}>
      
      {/* Toolbar - Paper-on-Desk Style */}
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-6 pt-6">
        <div className="text-start">
          <div className="flex items-center gap-2">
             <h1 className="text-xl font-black text-slate-900">{isRtl ? 'عرض سعر رسمي' : 'Official Quotation'}</h1>
             <Badge variant="outline" className="h-5 px-2 font-black text-[8px] uppercase bg-white">{editData.status || quote.status}</Badge>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {quote.id.slice(-8).toUpperCase()} | {editData.pricingMode}</p>
        </div>
        <div className="flex gap-2">
           {isEditing ? (
              <>
                <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold bg-white border-2">
                   {isRtl ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl h-10 px-8 font-black gap-2 shadow-xl">
                   {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                   {isRtl ? 'حفظ التعديلات' : 'Save'}
                </Button>
              </>
           ) : (
             <>
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
         <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-2 border-slate-900 pb-6">
               <div className="text-start space-y-4">
                  <div className="space-y-0.5">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'السادة المحترمون /' : 'To:'}</p>
                     <p className="text-lg font-black text-slate-900">{quote.clientName}</p>
                  </div>
                  <div className="space-y-0.5">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الموضوع /' : 'Subject:'}</p>
                     {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-9 text-xs" />
                     ) : (
                        <p className="text-sm font-black text-primary">{quote.name}</p>
                     )}
                  </div>
               </div>
               <div className="text-start md:text-end">
                  <div className="bg-slate-50/50 p-4 rounded-2xl border-2 border-white shadow-inner inline-block min-w-[180px]">
                     <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase gap-4">
                           <span className="text-slate-400">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                           <span className="text-slate-900">{(quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date()).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-primary gap-4">
                           <span>{isRtl ? 'صلاحية العرض' : 'Valid For'}</span>
                           <div className="flex items-center gap-2">
                              {isEditing ? (
                                <input type="number" value={editData.validDays} onChange={e => setEditForm({...editData, validDays: Number(e.target.value)})} className="w-8 h-5 border rounded text-center bg-white text-[10px]" />
                              ) : <span>{quote.validDays}</span>}
                              <span>{isRtl ? 'يوم' : 'Days'}</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {isEditing && (
              <div className="p-4 bg-[#1e1b4b] rounded-xl text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl animate-in slide-in-from-top-2">
                 <div className="flex items-center gap-3 text-start">
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-md"><Calculator className="h-4 w-4" /></div>
                    <div className="text-start">
                       <p className="text-[7px] font-black text-primary uppercase tracking-widest">Pricing Engine</p>
                       <Select value={editData.pricingMode} onValueChange={(v: PricingMode) => setEditForm({...editData, pricingMode: v})}>
                            <SelectTrigger className="h-6 w-32 rounded-md bg-white/10 border-0 text-white font-black text-[9px] mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                                <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                                <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    {(editData.pricingMode === 'percentage' || editData.pricingMode === 'fixed') && (
                       <div className="space-y-1 text-start w-40">
                          <Label className="text-[8px] font-black uppercase text-primary tracking-widest">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</Label>
                          <Input 
                            type="number" 
                            value={editData.totalAmount || 0} 
                            onChange={e => setEditForm({...editData, totalAmount: Number(e.target.value)})}
                            className="h-8 rounded-md bg-white text-slate-900 font-black text-sm text-center"
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
                  <Textarea value={editData.introText} onChange={e => setEditForm({...editData, introText: e.target.value})} className="min-h-[60px] rounded-xl border-2 p-3 font-bold text-[10px] bg-slate-50/30" />
               ) : (
                  <p className="p-4 bg-white rounded-xl border-2 border-slate-50 leading-relaxed text-slate-600 font-bold text-sm italic whitespace-pre-wrap">
                     {quote.introText}
                  </p>
               )}
            </div>

            <div className="space-y-4 text-start">
               <div className="flex justify-between items-center">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Layers className="h-3.5 w-3.5 text-primary" /> {isRtl ? 'جدول بنود التسعير والدفعات' : 'Pricing & Payments'}
                  </h4>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setEditForm({...editData, items: [...(editData.items || []), { label: '', unitPrice: 0, percentage: 0, quantity: 1, description: '' }]})} className="rounded-lg font-black text-[8px] border-2 h-6 px-3 gap-1">
                       <Plus className="h-2.5 w-2.5" /> {isRtl ? 'إضافة بند' : 'Add Item'}
                    </Button>
                  )}
               </div>

               <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-lg">
                  <table className="w-full text-xs text-start">
                     <thead className="bg-slate-900 text-white">
                        <tr className="font-black uppercase text-[8px] tracking-widest">
                           <th className="p-3 text-start w-10">#</th>
                           <th className="p-3 text-start">{isRtl ? 'توصيف البند / الدفعة' : 'Description'}</th>
                           {editData.pricingMode === 'percentage' && <th className="p-3 text-center w-20">{isRtl ? 'الحصة' : 'Share'}</th>}
                           <th className="p-3 text-end pe-6 w-32">{isRtl ? 'القيمة' : 'Amount'}</th>
                           {isEditing && <th className="p-3 w-10"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {activeItemsForDisplay.map((item, idx) => {
                           const originalIdx = (editData.items || []).indexOf(item);
                           const lineAmount = editData.pricingMode === 'percentage' 
                             ? ((editData.totalAmount || 0) * (item.percentage || 0)) / 100 
                             : (item.unitPrice || 0);
                           
                           return (
                             <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 font-black text-slate-300 text-start">{idx + 1}</td>
                                <td className="p-3 text-start">
                                   {isEditing ? (
                                      <div className="space-y-1">
                                         <Input value={item.label} onChange={e => updateItem(originalIdx, 'label', e.target.value)} className="h-7 rounded-md font-black text-[10px]" />
                                         <Input value={item.description} onChange={e => updateItem(originalIdx, 'description', e.target.value)} className="h-7 text-[8px] font-medium opacity-70" />
                                      </div>
                                   ) : (
                                      <div className="space-y-0.5">
                                         <p className="font-black text-slate-900 text-[11px]">{item.label}</p>
                                         <p className="text-[9px] font-bold text-slate-400 leading-tight">{item.description}</p>
                                      </div>
                                   )}
                                </td>
                                {editData.pricingMode === 'percentage' && (
                                   <td className="p-3 text-center">
                                      {isEditing ? (
                                         <div className="relative w-14 mx-auto">
                                            <Input type="number" value={item.percentage} onChange={e => updateItem(originalIdx, 'percentage', Number(e.target.value))} className="h-7 rounded-md border-2 font-black text-center pe-5 text-[9px]" />
                                            <Percent className="absolute right-1 top-1/2 -translate-y-1/2 h-2 w-2 text-slate-300" />
                                         </div>
                                      ) : <Badge className="bg-slate-900 text-white font-black text-[9px] px-2 h-5 rounded-md">{item.percentage}%</Badge>}
                                   </td>
                                )}
                                <td className="p-3 text-end pe-6">
                                   {isEditing && editData.pricingMode !== 'percentage' ? (
                                      <Input type="number" step="0.001" value={item.unitPrice} onChange={e => updateItem(originalIdx, 'unitPrice', Number(e.target.value))} className="h-7 rounded-md border-2 font-black text-center text-emerald-600 text-[10px] w-24 ms-auto" />
                                   ) : (
                                      <p className="font-mono font-black text-emerald-600 text-sm">{(lineAmount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></p>
                                   )}
                                </td>
                                {isEditing && <td className="p-3 text-center"><Trash2 className="h-3.5 w-3.5 text-rose-300 cursor-pointer hover:text-rose-500" onClick={() => updateItem(originalIdx, 'deleted', true)} /></td>}
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-900 text-white">
                        <tr>
                           <td colSpan={editData.pricingMode === 'percentage' ? 3 : 2} className="p-4 text-start">
                              <h3 className="text-sm font-black font-headline uppercase tracking-tighter">{isRtl ? 'إجمالي قيمة العرض' : 'Total Quote Value'}</h3>
                              {editData.pricingMode === 'percentage' && (
                                 <Badge className={cn("mt-1 border-0 text-[7px] font-black h-4", stats.isValid ? "bg-emerald-500 text-white" : "bg-rose-500 text-white animate-pulse")}>
                                    {stats.isValid ? `BALANCED: ${stats.totalPercentage}%` : `MISMATCH: ${stats.totalPercentage}% / 100%`}
                                 </Badge>
                              )}
                           </td>
                           <td className="p-4 text-end pe-6">
                              <div className="space-y-0.5">
                                 <h2 className="text-2xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                 <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Kuwaiti Dinars</p>
                              </div>
                           </td>
                           {isEditing && <td></td>}
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            <div className="text-start space-y-3 pt-4">
               <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-1">
                  <Gavel className="h-3 w-3 text-primary" /> {isRtl ? 'الشروط العامة والالتزامات' : 'Terms & Conditions'}
               </h4>
               {isEditing ? (
                  <Textarea value={editData.defaultTerms} onChange={e => setEditForm({...editData, defaultTerms: e.target.value})} className="min-h-[100px] rounded-xl border-2 p-3 text-[9px] font-medium bg-slate-50/30" />
               ) : (
                  <p className="p-4 bg-slate-50/50 rounded-2xl border-2 border-white shadow-inner text-[10px] font-bold text-slate-600 leading-relaxed whitespace-pre-wrap italic">
                     {quote.defaultTerms}
                  </p>
               )}
            </div>

            <div className="grid grid-cols-2 gap-12 pt-10 border-t-2 border-dashed border-slate-100">
               <div className="text-start space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'اعتماد العميل المالك' : 'Client Approval'}</p>
                  <div className="h-10 w-full border-b border-slate-200" />
               </div>
               <div className="text-end flex flex-col items-end">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{isRtl ? 'ختم الشركة الرسمي' : 'Official Stamp'}</p>
                  <div className="h-16 w-16 rounded-xl border-2 border-slate-50 flex items-center justify-center bg-white shadow-sm rotate-3">
                    <ShieldCheck className="h-8 w-8 text-slate-100" />
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
