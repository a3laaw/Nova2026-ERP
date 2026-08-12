'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, Gavel, 
  ShieldCheck, 
  Loader2, Save,
  Edit3, Trash2, Calculator,
  Layers, Percent,
  History,
  Wallet,
  ArrowRight,
  Plus,
  X,
  Workflow,
  Clock
} from "lucide-react";
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { Contract } from '@/types/documents';
import { ContractMilestone, PricingMode, MilestoneTiming } from '@/types/templates';
import { TechnicalStage } from '@/types/reference';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { DocumentService } from '@/services/document-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ContractViewPage() {
  const params = useParams();
  const contractId = params.cId as string;
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
  const [editData, setEditForm] = useState<Partial<Contract>>({});

  const contractRef = useMemo(() => 
    companyId && db ? doc(db, paths.contracts(companyId), contractId) : null, 
  [db, companyId, contractId]);

  const { data: contract, loading } = useDoc<Contract>(contractRef);

  useEffect(() => {
    if (contract && !hasAutoOpened) {
      const baseMilestones = (contract as any).milestones || (contract as any).defaultMilestones || [];
      const baseAmount = contract.totalAmount || (contract as any).baseAmount || 0;

      const initializedData = {
        ...contract,
        milestones: baseMilestones,
        totalAmount: baseAmount
      };

      setEditForm(initializedData);
      
      if (contract.status === 'draft' && !contract.isHistoryRecorded) {
        setIsEditing(true);
      }
      setHasAutoOpened(true);
    }
  }, [contract, hasAutoOpened]);

  const stagesQuery = useMemo(() => {
    const actId = editData.activityTypeId || contract?.activityTypeId;
    const srvId = editData.serviceId || contract?.serviceId;
    const subId = editData.subServiceId || contract?.subServiceId;

    if (!companyId || !db || !actId || !srvId || !subId) return null;
    return query(collection(db, paths.technicalStages(companyId, actId, srvId, subId)), orderBy('order'));
  }, [db, companyId, editData.activityTypeId, editData.serviceId, editData.subServiceId, contract]);
  
  const { data: stages } = useCollection<TechnicalStage>(stagesQuery);

  const stats = useMemo(() => {
    const milestones = editData.milestones || [];
    const totalPercentage = milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
    const totalItemizedAmount = milestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    const isPercentageMode = editData.pricingMode === 'percentage';
    const isValid = isPercentageMode ? Math.abs(totalPercentage - 100) < 0.1 : true;
    return { totalPercentage, totalItemizedAmount, isValid };
  }, [editData.milestones, editData.pricingMode]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (editData.pricingMode === 'percentage' && !stats.isValid) {
      toast({ 
        variant: "destructive", 
        title: t('common.error'), 
        description: tSafe('inline.percentage.error', `يجب أن يكون مجموع الحصص 100% (الحالي: ${stats.totalPercentage}%)`, `Total percentage must be 100% (Current: ${stats.totalPercentage}%)`)
      });
      return;
    }

    setSaving(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      const finalAmount = editData.pricingMode === 'itemized' 
        ? stats.totalItemizedAmount 
        : (editData.totalAmount || 0);

      const newStatus = (contract?.status === 'draft' && !contract.isHistoryRecorded) ? 'approved' : editData.status;

      const { id, createdAt, updatedAt, ...sanitizedData } = editData as any;
      await service.updateContract(contractId, {
        ...sanitizedData,
        status: newStatus,
        totalAmount: finalAmount,
        updatedBy: globalUser?.username || user.displayName || 'Admin'
      }, user.uid);
      
      toast({ title: t('common.saved') });
      setIsEditing(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (contract && !contract.isHistoryRecorded) {
      router.push(`/dashboard/clients/${clientId}/transactions/${contract.transactionId}`);
    } else {
      setIsEditing(false);
      setEditForm(contract || {});
    }
  };

  const getOrdinalLabel = (index: number) => {
    const arOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const enOrdinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const base = tSafe('inline.installment', 'الدفعة', 'Installment');
    const ordinal = isRtl ? (arOrdinals[index] || `#${index + 1}`) : (enOrdinals[index] || `#${index + 1}`);
    return `${base} ${ordinal}`;
  };

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...(editData.milestones || [])];
    const item = { ...newM[idx], [field]: value };

    // ربط تفاعلي للنسبة
    if (editData.pricingMode === 'percentage' && (field === 'percentage' || field === 'amount')) {
       const total = editData.totalAmount || 0;
       if (field === 'percentage') {
         item.amount = (total * (Number(value) || 0)) / 100;
       } else if (field === 'amount' && total > 0) {
         item.percentage = (Number(value) / total) * 100;
       }
    }

    newM[idx] = item;
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
        technicalStageId: 'SIGNING',
        contractualEvent: 'SIGNING' 
      }]
    });
  };

  const handleMarkAsPaid = async (docId: string) => {
    if (!db || !companyId || !user) return;
    setSaving(true);
    try {
      const service = new DocumentService(db, companyId, permissions);
      await service.updateContract(contractId, { status: 'paid', isPaid: true } as any, user.uid);
      toast({ title: t('common.saved') });
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!contract) return <div className="p-20 text-center font-black">{tSafe('inline.not.found', '404 - غير موجود', '404 - Not Found')}</div>;

  const currentDisplayAmount = editData.pricingMode === 'itemized' 
    ? stats.totalItemizedAmount 
    : (editData.totalAmount || 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-[#fdfaf3]" dir={dir}>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-6 pt-6 text-start">
        <div className="flex items-center gap-4">
           <Button 
             variant="ghost" 
             onClick={() => router.push(`/dashboard/clients/${clientId}/transactions/${contract.transactionId}`)} 
             className="h-10 w-10 p-0 rounded-xl border-2 bg-white text-slate-400 hover:text-slate-900 transition-all shadow-sm shrink-0"
           >
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </Button>
           <div className="text-start">
              <div className="flex items-center gap-2">
                 <h1 className="text-xl font-black text-slate-900">{t('contracts.officialTitle')}</h1>
                 <Badge className={cn(
                   "font-black px-4 py-1 rounded-xl shadow-sm uppercase text-[9px]",
                   (editData.status || contract.status) === 'paid' ? 'bg-emerald-500 text-white' : 'bg-primary text-white'
                 )}>
                    {editData.status || contract.status}
                 </Badge>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {contract.id.slice(-8).toUpperCase()} | {t(editData.pricingMode || '')}</p>
           </div>
        </div>
        <div className="flex gap-2">
           {!isEditing && contract.status !== 'paid' && isAdmin && (
              <Button onClick={() => handleMarkAsPaid(contract.id)} disabled={saving} variant="outline" className="rounded-xl h-10 px-6 font-black gap-2 bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100">
                 <Wallet className="h-4 w-4" /> {isRtl ? 'توثيق سداد' : 'Mark Paid'}
              </Button>
           )}
           {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-bold bg-white border-2">
                   {t('common.cancel')}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl h-10 px-8 font-black gap-2 shadow-xl border-b-4 border-orange-700">
                   {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                   {contract.status === 'draft' && !contract.isHistoryRecorded ? t('contracts.commitAndSave') : t('common.saveChanges')}
                </Button>
              </>
           ) : (
             <>
               <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black gap-2 border-2 bg-white text-primary hover:bg-primary/5">
                  <Edit3 className="h-4 w-4" /> {tSafe('inline.edit.contract', 'تعديل البنود', 'Edit Contract')}
               </Button>
               <Button onClick={() => window.print()} size="sm" className="rounded-xl h-10 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl">
                  <Printer className="h-4 w-4" /> {t('common.print')}
               </Button>
             </>
           )}
        </div>
      </div>

      <PrintWrapper title={t('contracts.officialTitle')} className="mt-2">
         <div className="space-y-10 text-start">
            <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20 flex items-center justify-between gap-4 shadow-sm print:hidden">
                <div className="flex items-center gap-4 text-start">
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg"><Calculator className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">{isRtl ? 'نمط التسعير' : 'Pricing Mode'}</p>
                    {isEditing ? (
                      <Select value={editData.pricingMode} onValueChange={(v: PricingMode) => setEditForm({...editData, pricingMode: v})}>
                         <SelectTrigger className="h-10 w-40 rounded-xl border-2 bg-white text-slate-900 font-black text-xs mt-1"><SelectValue /></SelectTrigger>
                         <SelectContent className="rounded-xl border-2 shadow-2xl">
                            <SelectItem value="itemized" className="font-bold text-xs">{t('itemized')}</SelectItem>
                            <SelectItem value="fixed" className="font-bold text-xs">{t('fixed')}</SelectItem>
                            <SelectItem value="percentage" className="font-bold text-xs">{t('percentage')}</SelectItem>
                         </SelectContent>
                      </Select>
                    ) : <span className="text-xs font-black uppercase text-slate-900">{t(editData.pricingMode || '')}</span>}
                  </div>
                </div>
                
                {(editData.pricingMode === 'percentage' || editData.pricingMode === 'fixed') && (
                  <div className="space-y-1 text-start w-48">
                     <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{tSafe('inline.target.budget', 'الميزانية المستهدفة', 'Target Budget')}</Label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b-4 border-primary/20 pb-8">
               <div className="text-start space-y-4">
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.first.party', 'الطرف الأول (العميل)', 'First Party:')}</p>
                     <p className="text-xl font-black text-slate-900">{contract.clientName}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.subject', 'الموضوع /', 'Subject:')}</p>
                     {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditForm({...editData, name: e.target.value})} className="font-bold border-2 h-12 rounded-xl text-sm" />
                     ) : (
                        <p className="text-base font-black text-primary">{contract.name}</p>
                     )}
                  </div>
               </div>
            </div>

            <div className="space-y-6 text-start">
               <div className="flex justify-between items-center px-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Layers className="h-4 w-4 text-primary" /> {tSafe('inline.payment.milestones.pipeline', 'جدول الدفعات والربط الفني', 'Payment Milestones & Pipeline')}
                  </h4>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={addMilestone} className="rounded-xl font-black text-[10px] border-2 h-9 px-6 gap-2 bg-white hover:bg-primary/5">
                       <Plus className="h-4 w-4" /> {tSafe('inline.add.payment', 'إضافة دفعة', 'Add Payment')}
                    </Button>
                  )}
               </div>

               <div className="border-2 border-slate-200 rounded-[2rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                  <table className="w-full text-xs text-start">
                     <thead className="bg-slate-50 border-b-2 border-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest">
                        <tr>
                           <th className="p-5 w-10 text-start">#</th>
                           <th className="p-5 text-start">{tSafe('inline.milestone.name', 'مسمى الدفعة', 'Milestone Name')}</th>
                           {editData.pricingMode === 'percentage' && <th className="p-5 text-center w-20">%</th>}
                           {isEditing && <th className="p-5 text-center w-28">{tSafe('inline.timing', 'التوقيت', 'Timing')}</th>}
                           <th className="p-5 text-start w-48">{tSafe('inline.technical.link', 'الارتباط الفني', 'Technical Link')}</th>
                           <th className="p-5 text-end pe-10 w-40">{tSafe('inline.amount', 'القيمة', 'Amount')}</th>
                           {isEditing && <th className="p-5 w-12"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {(editData.milestones || []).map((m, idx) => {
                           const lineAmount = editData.pricingMode === 'percentage' 
                             ? ((editData.totalAmount || 0) * (m.percentage || 0)) / 100 
                             : (m.amount || 0);
                           
                           const linkedStageName = stages?.find(s => s.id === m.technicalStageId)?.name;

                           return (
                             <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-5 font-black text-slate-300 text-start">{idx + 1}</td>
                                <td className="p-5 text-start">
                                   {isEditing ? (
                                      <div className="space-y-2">
                                         <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 rounded-xl font-bold text-sm bg-white" />
                                         {m.technicalStageId && m.technicalStageId !== 'NONE' && (
                                            <p className="text-[8px] font-black text-primary/60 italic flex items-center gap-1 mt-1">
                                               <Clock className="h-3 w-3" />
                                               {t(m.timing || 'at')} {m.technicalStageId === 'SIGNING' ? t('contractSigning') : linkedStageName}
                                            </p>
                                         )}
                                      </div>
                                   ) : (
                                      <div className="space-y-1">
                                         <span className="font-black text-slate-800 text-sm block">{m.name}</span>
                                         {m.technicalStageId && m.technicalStageId !== 'NONE' && (
                                            <p className="text-[10px] font-black text-primary/60 italic flex items-center gap-1">
                                               <Clock className="h-3 w-3" />
                                               {t(m.timing || 'at')} {m.technicalStageId === 'SIGNING' ? t('contractSigning') : linkedStageName}
                                            </p>
                                         )}
                                      </div>
                                   )}
                                </td>
                                {editData.pricingMode === 'percentage' && (
                                   <td className="p-5 text-center">
                                      {isEditing ? (
                                         <div className="relative w-20 mx-auto">
                                            <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value === "" ? 0 : Number(e.target.value))} className="h-10 rounded-xl border-2 font-black text-center pe-6 text-sm" />
                                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                         </div>
                                      ) : <span className="font-black text-slate-900 text-lg">{m.percentage}%</span>}
                                   </td>
                                )}
                                {isEditing && (
                                   <td className="p-2">
                                      <Select value={m.timing || 'at'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
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
                                <td className="p-5 text-start">
                                   {isEditing ? (
                                      <Select value={m.technicalStageId || 'SIGNING'} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                         <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                         <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                            <SelectItem value="SIGNING" className="font-bold text-xs">{t('contractSigning')}</SelectItem>
                                            {stages?.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50 text-start">
                                               <span className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> {s.name}</span>
                                            </SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                   ) : (
                                      <Badge variant="outline" className={cn(
                                        "font-black text-[10px] border-0 px-4 h-6 rounded-lg shadow-sm",
                                        m.technicalStageId === 'SIGNING' ? "bg-emerald-50 text-emerald-600" : "bg-primary/5 text-primary"
                                      )}>
                                         {m.technicalStageId === 'SIGNING' ? tSafe('inline.signing', 'توقيع', 'Signing') : (linkedStageName || tSafe('inline.field.stage', 'مرحلة ميدانية', 'Field Stage'))}
                                      </Badge>
                                   )}
                                </td>
                                <td className="p-5 text-end pe-10 w-40">
                                   {isEditing && editData.pricingMode !== 'percentage' ? (
                                      <Input type="number" step="0.001" value={m.amount === 0 ? "" : m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value === "" ? 0 : Number(e.target.value))} className="h-10 w-32 ms-auto text-end font-black text-emerald-600 text-sm bg-slate-50 border-2" />
                                   ) : (
                                      <span className="font-mono font-black text-emerald-600 text-lg">{(lineAmount || 0).toLocaleString()} <span className="text-[10px] opacity-40">KWD</span></span>
                                   )}
                                </td>
                                {isEditing && (
                                   <td className="p-5 text-center">
                                      <button type="button" onClick={() => setEditForm({...editData, milestones: editData.milestones?.filter((_, i) => i !== idx)})} className="text-rose-300 hover:text-rose-600 transition-colors"><Trash2 className="h-5 w-5" /></button>
                                   </td>
                                )}
                             </tr>
                           );
                        })}
                     </tbody>
                     <tfoot className="bg-slate-50 border-t-4 border-primary">
                        <tr>
                           <td colSpan={editData.pricingMode === 'percentage' ? (isEditing ? 5 : 4) : (isEditing ? 4 : 3)} className="p-8 text-start">
                              <h3 className="text-base font-black font-headline uppercase tracking-widest text-slate-900">{tSafe('inline.total.contract.value', 'إجمالي قيمة العقد', 'Total Contract Value')}</h3>
                              {editData.pricingMode === 'percentage' && (
                                 <Badge className={cn("mt-2 border-0 text-[10px] font-black h-6 px-4 shadow-sm", stats.isValid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                                    {stats.isValid ? `${tSafe('inline.balanced', 'متوازن', 'BALANCED')}: 100%` : `${tSafe('inline.mismatch', 'غير متوازن', 'MISMATCH')}: ${stats.totalPercentage}%`}
                                 </Badge>
                              )}
                           </td>
                           <td colSpan={2} className="p-8 text-end pe-10">
                              <div className="space-y-1">
                                 <h2 className="text-4xl font-black font-headline text-primary">{(currentDisplayAmount || 0).toLocaleString()}</h2>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tSafe('inline.kuwaiti.dinars', 'دنانير كويتية', 'Kuwaiti Dinars')}</p>
                              </div>
                           </td>
                           {isEditing && <td></td>}
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>

            <div className="space-y-4 text-start pt-6">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b-2 border-primary/20 pb-2">
                  <Gavel className="h-5 w-5 text-primary" /> {tSafe('inline.legal.clauses.obligations', 'البنود والالتزامات القانونية', 'Legal Clauses & Obligations')}
               </h4>
               {isEditing ? (
                  <Textarea value={editData.legalText} onChange={e => setEditForm({...editData, legalText: e.target.value})} className="min-h-[300px] rounded-[2rem] border-2 p-8 text-sm font-bold leading-relaxed bg-slate-50/50 shadow-inner" />
               ) : (
                  <p className="p-10 bg-slate-50/50 rounded-[3rem] border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic text-start">
                     {contract.legalText}
                  </p>
               )}
            </div>
         </div>
      </PrintWrapper>
    </div>
  );
}
