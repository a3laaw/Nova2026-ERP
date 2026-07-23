'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, Gavel, 
  ShieldCheck, 
  DollarSign, Loader2, Save,
  Edit3, X, Plus, Trash2, Calculator,
  Layers, Percent, Target,
  CheckCircle2,
  AlertTriangle,
  History,
  Wallet,
  ArrowRight,
  FileText
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Contract } from '@/types/documents';
import { ContractMilestone, PricingMode } from '@/types/templates';
import { TechnicalStage } from '@/types/reference';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ContractViewPage() {
  const params = useParams();
  const contractId = params.cId as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditForm] = useState<Partial<Contract>>({});

  const contractRef = useMemo(() => 
    companyId && db ? doc(db, paths.contracts(companyId), contractId) : null, 
  [db, companyId, contractId]);

  const { data: contract, loading } = useDoc<Contract>(contractRef);

  useEffect(() => {
    if (contract) {
      setEditForm(contract);
      // دورة العمل الذكية: إذا كان المستند مسودة (جديد)، ادخل وضع التعديل تلقائياً
      if (contract.status === 'draft' && !contract.isHistoryRecorded) {
        setIsEditing(true);
      }
    }
  }, [contract]);

  const getOrdinalLabel = (index: number) => {
    const arOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const enOrdinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const base = isRtl ? "الدفعة" : "Installment";
    const ordinal = isRtl ? (arOrdinals[index] || `#${index + 1}`) : (enOrdinals[index] || `#${index + 1}`);
    return `${base} ${ordinal}`;
  };

  const stagesQuery = useMemo(() => {
    if (!companyId || !db || !editData.activityTypeId || !editData.serviceId || !editData.subServiceId) return null;
    return query(collection(db, paths.technicalStages(companyId, editData.activityTypeId!, editData.serviceId!, editData.subServiceId!)), orderBy('order'));
  }, [db, companyId, editData.activityTypeId, editData.serviceId, editData.subServiceId]);
  
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const stats = useMemo(() => {
    const milestones = editData.milestones || [];
    const totalPercentage = milestones.reduce((acc, m) => acc + (m.percentage || 0), 0);
    const totalItemizedAmount = milestones.reduce((acc, m) => acc + (m.amount || 0), 0);
    const isPercentageMode = editData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;
    return { totalPercentage, totalItemizedAmount, isValid };
  }, [editData.milestones, editData.pricingMode]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (editData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: isRtl ? "خطأ في توزيع الدفعات" : "Milestone Mismatch", 
        description: isRtl ? `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)` : `Total percentage must be 100%` 
      });
      return;
    }

    setSaving(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const finalAmount = editData.pricingMode === 'itemized' 
        ? stats.totalItemizedAmount 
        : (editData.totalAmount || 0);

      const { id, createdAt, updatedAt, ...sanitizedData } = editData as any;
      await service.updateContract(contractId, {
        ...sanitizedData,
        totalAmount: finalAmount,
        updatedBy: globalUser?.username || user.displayName || 'Admin'
      }, user.uid);
      
      toast({ title: isRtl ? "تم اعتماد وحفظ العقد بنجاح" : "Contract Approved & Saved" });
      setIsEditing(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('error'), description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...(editData.milestones || [])];
    newM[idx] = { ...newM[idx], [field]: value };
    setEditForm({ ...editData, milestones: newM });
  };

  const addMilestone = () => {
    const nextIdx = (editData.milestones || []).length;
    setEditForm({
      ...editData,
      milestones: [...(editData.milestones || []), { 
        name: getOrdinalLabel(nextIdx), 
        percentage: 0, 
        amount: 0, 
        timing: 'at', 
        contractualEvent: 'MANUAL' 
      }]
    });
  };

  const handleMarkAsPaid = async () => {
    if (!db || !companyId) return;
    setSaving(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      await service.updateContract(contractId, { status: 'paid', isPaid: true } as any, user!.uid);
      toast({ title: isRtl ? "تم توثيق السداد وتفعيل المشروع" : "Payment Confirmed" });
    } catch (e) {
      toast({ variant: "destructive", title: t('error') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!contract) return <div className="p-20 text-center font-black">{isRtl ? 'العقد غير موجود' : 'Contract not found'}</div>;

  const currentDisplayAmount = editData.pricingMode === 'itemized' 
    ? stats.totalItemizedAmount 
    : (editData.totalAmount || 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-slate-50" dir={dir}>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-6 pt-6">
        <div className="text-start">
          <div className="flex items-center gap-2">
             <h1 className="text-xl font-black text-slate-900">{isRtl ? 'عقد خدمات هندسية رسمي' : 'Official Engineering Contract'}</h1>
             <Badge className={cn(
               "font-black px-4 py-1 rounded-xl shadow-sm uppercase text-[9px]",
               (editData.status || contract.status) === 'paid' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
             )}>
                {editData.status || contract.status}
             </Badge>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {contract.id.slice(-8).toUpperCase()} | {editData.pricingMode}</p>
        </div>
        <div className="flex gap-2">
           {!isEditing && contract.status !== 'paid' && isAdmin && (
              <Button onClick={handleMarkAsPaid} disabled={saving} variant="outline" className="rounded-xl h-10 px-6 font-black gap-2 bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100">
                 <Wallet className="h-4 w-4" /> {isRtl ? 'توثيق السداد' : 'Mark Paid'}
              </Button>
           )}
           {isEditing ? (
              <>
                <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold bg-white border-2">
                   {isRtl ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl h-10 px-8 font-black gap-2 shadow-xl">
                   {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                   {contract.status === 'draft' ? (isRtl ? 'اعتماد وحفظ العقد' : 'Commit & Save') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}
                </Button>
              </>
           ) : (
             <>
               <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black gap-2 border-2 bg-white text-primary hover:bg-primary/5">
                  <Edit3 className="h-4 w-4" /> {isRtl ? 'تعديل البنود' : 'Edit Contract'}
               </Button>
               <Button onClick={() => window.print()} size="sm" className="rounded-xl h-10 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl">
                  <Printer className="h-4 w-4" /> {isRtl ? 'طباعة' : 'Print'}
               </Button>
             </>
           )}
        </div>
      </div>

      <PrintWrapper title={isRtl ? "عقد اتفاق خدمات هندسية" : "Engineering Services Agreement"} className="mt-2">
         <div className="space-y-10">
            <div className="p-4 bg-[#1e1b4b] rounded-xl text-white flex items-center justify-between gap-4 shadow-xl print:hidden">
                <div className="flex items-center gap-3 text-start">
                  <Calculator className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[7px] font-black uppercase text-primary">Pricing Mode</p>
                    {isEditing ? (
                      <Select value={editData.pricingMode} onValueChange={(v: PricingMode) => setEditForm({...editData, pricingMode: v})}>
                         <SelectTrigger className="h-6 w-32 rounded-md bg-white/10 border-0 text-white font-black text-[9px] mt-0.5"><SelectValue /></SelectTrigger>
                         <SelectContent className="rounded-xl">
                            <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                            <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                            <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                         </SelectContent>
                      </Select>
                    ) : <span className="text-[9px] font-black uppercase">{editData.pricingMode}</span>}
                  </div>
                </div>
                
                {(editData.pricingMode === 'percentage' || editData.pricingMode === 'fixed') && (
                  <div className="space-y-1 text-start w-32">
                     <Label className="text-[7px] font-black uppercase text-primary">{isRtl ? 'الميزانية المستهدفة' : 'Target Budget'}</Label>
                     {isEditing ? (
                       <Input 
                         type="number" 
                         value={editData.totalAmount === 0 ? "" : editData.totalAmount} 
                         onChange={e => setEditForm({...editData, totalAmount: e.target.value === "" ? 0 : Number(e.target.value)})} 
                         className="h-7 rounded-md bg-white text-slate-900 font-black text-sm text-center shadow-inner" 
                       />
                     ) : <p className="font-black text-lg">{(editData.totalAmount || 0).toLocaleString()}</p>}
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-2 border-slate-900 pb-8">
               <div className="text-start space-y-4">
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الطرف الأول (العميل)' : 'First Party:'}</p>
                     <p className="text-lg font-black text-slate-900">{contract.clientName}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'موضوع التعاقد' : 'Subject:'}</p>
                     {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-10 text-xs" />
                     ) : (
                        <p className="text-sm font-black text-primary">{contract.name}</p>
                     )}
                  </div>
               </div>
               <div className="text-start md:text-end flex flex-col justify-end">
                  <div className="bg-slate-50/50 p-6 rounded-3xl border-2 border-white shadow-inner inline-block min-w-[200px]">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span className="text-slate-400">{isRtl ? 'تاريخ العقد' : 'Contract Date'}</span>
                        <span className="text-slate-900">{(contract.createdAt?.toDate ? contract.createdAt.toDate() : new Date()).toLocaleDateString()}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="space-y-6 text-start">
               <div className="flex justify-between items-center px-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Layers className="h-4 w-4 text-primary" /> {isRtl ? 'جدول الدفعات والمراحل الفنية' : 'Payment Milestones & Stages'}
                  </h4>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={addMilestone} className="rounded-xl font-black text-[9px] border-2 h-8 px-4 gap-2">
                       <Plus className="h-3 w-3" /> {isRtl ? 'إضافة دفعة' : 'Add Payment'}
                    </Button>
                  )}
               </div>

               <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xl">
                  <table className="w-full text-xs text-start">
                     <thead className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest">
                        <tr>
                           <th className="p-4 w-10">#</th>
                           <th className="p-4 text-start">{isRtl ? 'مسمى الدفعة المستحقة' : 'Milestone Name'}</th>
                           {editData.pricingMode === 'percentage' && <th className="p-4 text-center w-24">{isRtl ? 'الحصة' : 'Share'}</th>}
                           <th className="p-4 text-start">{isRtl ? 'المرحلة الفنية المربوطة' : 'Technical Link'}</th>
                           <th className="p-4 text-end pe-8 w-32">{isRtl ? 'القيمة' : 'Amount'}</th>
                           {isEditing && <th className="p-4 w-10"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {(editData.milestones || []).map((m, idx) => {
                           const lineAmount = editData.pricingMode === 'percentage' 
                             ? ((editData.totalAmount || 0) * (m.percentage || 0)) / 100 
                             : (m.amount || 0);
                           return (
                             <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-black text-slate-300">{idx + 1}</td>
                                <td className="p-4 text-start">
                                   {isEditing ? (
                                      <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-8 rounded-lg font-bold text-[11px]" />
                                   ) : <span className="font-black text-slate-800">{m.name}</span>}
                                </td>
                                {editData.pricingMode === 'percentage' && (
                                   <td className="p-4 text-center">
                                      {isEditing ? (
                                         <div className="relative w-16 mx-auto">
                                            <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value === "" ? 0 : Number(e.target.value))} className="h-8 rounded-lg border-2 font-black text-center pe-5 text-[11px]" />
                                            <Percent className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                         </div>
                                      ) : <span className="font-black text-slate-900">{m.percentage}%</span>}
                                   </td>
                                )}
                                <td className="p-4 text-start">
                                   {isEditing ? (
                                      <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className="h-8 rounded-lg border-2 font-bold text-[10px]"><SelectValue /></SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl">
                                            <SelectItem value="SIGNING" className="font-bold text-[10px]">توقيع العقد</SelectItem>
                                            {stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-[10px]">{s.name}</SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                   ) : (
                                      <Badge variant="outline" className="bg-slate-50 font-black text-[9px] border-slate-200">
                                         {m.technicalStageId === 'SIGNING' ? (isRtl ? 'عند التوقيع' : 'Signing') : (stages?.find(s => s.id === m.technicalStageId)?.name || 'Manual')}
                                      </Badge>
                                   )}
                                </td>
                                <td className="p-4 text-end pe-8">
                                   {isEditing && editData.pricingMode === 'itemized' ? (
                                      <Input type="number" step="0.001" value={m.amount === 0 ? "" : m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value === "" ? 0 : Number(e.target.value))} className="h-8 w-24 ms-auto text-end font-black text-emerald-600 text-[10px]" />
                                   ) : (
                                      <span className="font-mono font-black text-emerald-600">{(lineAmount || 0).toLocaleString()} <span className="text-[9px] opacity-40">KWD</span></span>
                                   )}
                                </td>
                                {isEditing && (
                                   <td className="p-4 text-center">
                                      <button type="button" onClick={() => setEditForm({...editData, milestones: editData.milestones?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                                   </td>
                                )}
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-900 text-white">
                        <tr>
                           <td colSpan={editData.pricingMode === 'percentage' ? 3 : 2} className="p-5 text-start">
                              <h3 className="text-sm font-black font-headline uppercase tracking-widest">{isRtl ? 'إجمالي قيمة العقد النهائية' : 'Total Contract Value'}</h3>
                              {editData.pricingMode === 'percentage' && (
                                 <Badge className={cn("mt-2 border-0 text-[8px] font-black h-5 px-3", stats.isValid ? "bg-emerald-50 text-white" : "bg-rose-50 text-white animate-pulse")}>
                                    {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                 </Badge>
                              )}
                           </td>
                           <td colSpan={2} className="p-5 text-end pe-8">
                              <div className="space-y-1">
                                 <h2 className="text-3xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                 <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Kuwaiti Dinars</p>
                              </div>
                           </td>
                           {isEditing && <td></td>}
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            <div className="space-y-4 text-start pt-6">
               <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-900 pb-2">
                  <Gavel className="h-4 w-4 text-primary" /> {isRtl ? 'البنود والالتزامات القانونية' : 'Legal Clauses & Obligations'}
               </h4>
               {isEditing ? (
                  <Textarea value={editData.legalText} onChange={e => setEditForm({...editData, legalText: e.target.value})} className="min-h-[300px] rounded-2xl border-2 p-5 text-xs font-bold leading-relaxed bg-slate-50/30" />
               ) : (
                  <p className="p-8 bg-slate-50/50 rounded-[2.5rem] border-2 border-white shadow-inner text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                     {contract.legalText}
                  </p>
               )}
            </div>

            <div className="grid grid-cols-2 gap-20 pt-16 border-t-2 border-dashed border-slate-200">
               <div className="text-start space-y-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'توقيع الطرف الأول (العميل)' : 'First Party (Client)'}</p>
                  <div className="h-14 w-full border-b-2 border-slate-900" />
               </div>
               <div className="text-end flex flex-col items-end space-y-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'توقيع الطرف الثاني (الشركة)' : 'Second Party (Company)'}</p>
                  <div className="h-14 w-48 border-b-2 border-slate-900" />
                  <div className="h-20 w-20 rounded-2xl border-2 border-slate-100 flex items-center justify-center bg-white shadow-lg rotate-6 opacity-30">
                    <ShieldCheck className="h-10 w-10 text-slate-400" />
                  </div>
               </div>
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
