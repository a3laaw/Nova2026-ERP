'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, Handshake, 
  ShieldCheck, 
  Loader2, Save,
  Edit3, Trash2, Calculator,
  Workflow,
  ArrowRight,
  Landmark,
  Gavel,
  Percent,
  History,
  Info,
  Clock
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";
import { ContractMilestone } from '@/types/templates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SubConContractViewPage() {
  const params = useParams();
  const contractId = params.id as string;
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditForm] = useState<any>({});
  const [pathStages, setPathStages] = useState<any[]>([]);

  const contractRef = useMemo(() => 
    companyId && db ? doc(db, paths.subconContracts(companyId), contractId) : null, 
  [db, companyId, contractId]);

  const { data: contract, loading } = useDoc<any>(contractRef);

  useEffect(() => {
    if (contract) {
      setEditForm(contract);
      if (db && companyId && contract.transactionId) {
        getDocs(query(collection(db, paths.transactionStages(companyId, contract.transactionId)), orderBy('order')))
          .then(snap => setPathStages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
          .catch(() => setPathStages([]));
      }
    }
  }, [contract, db, companyId]);

  const stats = useMemo(() => {
    const milestones = editData.milestones || [];
    const totalPercentage = milestones.reduce((acc: number, m: any) => acc + (Number(m.percentage) || 0), 0);
    const isValid = editData.pricingMode === 'percentage' ? Math.abs(totalPercentage - 100) < 0.1 : true;
    return { totalPercentage, isValid };
  }, [editData.milestones, editData.pricingMode]);

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...editData.milestones];
    const item = { ...newM[idx], [field]: value };
    if (editData.pricingMode === 'percentage' && (field === 'percentage' || field === 'amount')) {
      const total = editData.totalAmount || 0;
      if (field === 'percentage') item.amount = Math.round(((total * (Number(value) || 0)) / 100) * 1000) / 1000;
      else if (field === 'amount' && total > 0) item.percentage = (Number(value) / total) * 100;
    }
    newM[idx] = item;
    setEditForm({...editData, milestones: newM});
  };

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (editData.pricingMode === 'percentage' && !stats.isValid) {
       toast({ variant: "destructive", title: tSafe('inline.balance.error', 'يرجى موازنة الدفعات لتصل لـ 100%', 'Balance percentages to 100%') });
       return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, paths.subconContracts(companyId), contractId), { ...editData, updatedAt: serverTimestamp(), updatedBy: user.uid });
      toast({ title: tSafe('common.saved', 'تم حفظ التعديلات بنجاح', 'Changes Saved') });
      setIsEditing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center bg-white"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!contract) return <div className="p-20 text-center font-black">{tSafe('inline.not.found', '404 - غير موجود', '404 - Not Found')}</div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-white" dir={dir}>
      <div className="max-w-full mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-8 pt-6 text-start">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.push('/dashboard/procurement/subcontractors/contracts')} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 shadow-sm shrink-0"><ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /></button>
           <div className="text-start">
              <h1 className="text-xl font-black text-slate-900">{tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">REF: {contract.id.slice(-8).toUpperCase()}</p>
           </div>
        </div>
        <div className="flex gap-2">
           {isEditing ? (
              <>
                 <Button onClick={() => setIsEditing(false)} variant="ghost" className="h-10 px-6 font-bold">{t('common.cancel')}</Button>
                 <Button onClick={handleSave} disabled={saving} className="h-10 px-8 rounded-xl bg-primary text-white font-black shadow-xl border-b-4 border-orange-700">{saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} {tSafe('common.saveChanges', 'حفظ التغييرات', 'Save Changes')}</Button>
              </>
           ) : (
             <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl h-10 px-6 font-black gap-2 border-2 bg-white text-primary"><Edit3 className="h-4 w-4" /> {tSafe('common.edit', 'تعديل', 'Edit')}</Button>
           )}
           <Button onClick={() => window.print()} className="rounded-xl h-10 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl"><Printer className="h-4 w-4" /> {tSafe('common.print', 'طباعة', 'Print')}</Button>
        </div>
      </div>

      <div className="px-4 md:px-8">
        <PrintWrapper title={tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')} fullWidth={true}>
           <div className="space-y-12 text-start">
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.parties', 'أولاً: أطراف التعاقد', 'Parties of the Agreement')}</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-white shadow-inner text-start space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.first.party', 'الطرف الأول (المقاول الرئيسي)', 'First Party')}</p>
                       <h4 className="text-xl font-black text-slate-900">{globalUser?.companyName || 'NovaFlow ERP'}</h4>
                    </div>
                    <div className="p-8 rounded-[2.5rem] bg-orange-50/50 border-2 border-white shadow-inner text-start space-y-4">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest">{tSafe('subcon.second.party', 'الطرف الثاني (مقاول الباطن)', 'Second Party')}</p>
                       <h4 className="text-xl font-black text-slate-900">{contract.subcontractorName}</h4>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.subject', 'ثانياً: موضوع التعاقد والميزانية', 'Contract Subject & Budget')}</h3>
                 <div className="p-10 rounded-[3rem] bg-white border-2 border-slate-100 shadow-sm text-start space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Landmark className="h-40 w-40" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-2 relative z-10">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">{tSafe('common.project', 'المشروع المرتبط', 'Linked Project')}</Label>
                          <p className="text-2xl font-black text-slate-900">{contract.projectTitle}</p>
                       </div>
                       <div className="space-y-2 relative z-10 text-end">
                          <Label className="text-[10px] font-black text-primary uppercase">{isRtl ? 'المحتجزات المتفق عليها' : 'Contracted Retention'}</Label>
                          <div className="flex items-center justify-end gap-2">
                             {isEditing ? (
                               <div className="relative w-24">
                                  <Input type="number" value={editData.retentionRate} onChange={e => setEditForm({...editData, retentionRate: Number(e.target.value)})} className="h-10 rounded-xl border-2 font-black text-center" />
                                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                               </div>
                             ) : <Badge className="bg-slate-900 text-white font-black text-lg h-9 px-4">{contract.retentionRate}%</Badge>}
                          </div>
                       </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10 pt-8 border-t border-slate-50 relative z-10">
                       <div className="text-start space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.form.targetBudget', 'إجمالي قيمة التعاقد (مقطوعية)', 'Total Contract Value')}</p>
                          {isEditing ? <Input type="number" value={editData.totalAmount} onChange={e => setEditForm({...editData, totalAmount: Number(e.target.value)})} className="h-14 rounded-2xl border-2 text-2xl font-black text-primary" /> : <h3 className="text-5xl font-black font-headline text-primary">{contract.totalAmount?.toLocaleString()} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">KWD</span></h3>}
                       </div>
                       <div className="bg-emerald-50 px-8 py-4 rounded-3xl border-2 border-emerald-100 flex items-center gap-4 shadow-sm">
                          <ShieldCheck className="h-7 w-7 text-emerald-600" />
                          <div className="text-start">
                             <p className="font-black text-xs text-emerald-800 uppercase tracking-widest">{tSafe('subcon.fixedPrice', 'سعر ثابت معتمد', 'Fixed Price Approved')}</p>
                             <p className="text-[9px] font-bold text-emerald-600/70 italic">{tSafe('subcon.noAdjustments', 'لا يقبل التعديل إلا بأمر تغييري رسمي', 'Subject to official VO only')}</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.milestones', 'ثالثاً: جدول استحقاق الدفعات', 'Payment Milestones')}</h3>
                 <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                    <table className="w-full text-xs text-start">
                       <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                             <th className="p-8 w-14 text-start">#</th>
                             <th className="p-8 text-start">{tSafe('name', 'الوصف', 'Description')}</th>
                             {editData.pricingMode === 'percentage' && <th className="p-8 text-center w-32">%</th>}
                             <th className="p-8 text-center w-32">{tSafe('timing', 'التوقيت', 'Timing')}</th>
                             <th className="p-8 text-start w-48">{tSafe('technicalLink', 'الارتباط الميداني', 'Execution Link')}</th>
                             <th className="p-8 text-end pe-12 w-56">{t('common.amount')}</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {(editData.milestones || []).map((m: any, idx: number) => {
                             const linkedStageName = pathStages.find(s => s.technicalStageId === m.technicalStageId || s.id === m.technicalStageId)?.name;
                             return (
                               <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-8 font-black text-slate-300">{idx + 1}</td>
                                  <td className="p-6 text-start">{isEditing ? <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 border-2 rounded-xl font-bold" /> : <p className="font-black text-slate-900 text-lg">{m.name}</p>}</td>
                                  {editData.pricingMode === 'percentage' && <td className="p-6 text-center">{isEditing ? <div className="relative w-24 mx-auto"><Input type="number" value={m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value)} className="h-10 rounded-xl border-2 font-black text-center pe-8" /><Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" /></div> : <Badge className="bg-slate-900 text-white font-black text-base px-6 h-9 rounded-2xl shadow-xl">{m.percentage}%</Badge>}</td>}
                                  <td className="p-6 text-center">
                                      {isEditing ? (
                                        <Select value={m.timing || 'at'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
                                           <SelectTrigger className="h-10 rounded-xl border-2 font-black text-xs bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                                           <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                              <SelectItem value="at" className="font-bold text-xs">{isRtl ? 'عند' : 'At'}</SelectItem>
                                              <SelectItem value="before" className="font-bold text-xs">{isRtl ? 'قبل' : 'Before'}</SelectItem>
                                              <SelectItem value="during" className="font-bold text-xs">{isRtl ? 'أثناء' : 'During'}</SelectItem>
                                              <SelectItem value="after" className="font-bold text-xs">{isRtl ? 'بعد' : 'After'}</SelectItem>
                                           </SelectContent>
                                        </Select>
                                      ) : <span className="font-bold text-xs text-slate-600">{t(m.timing || 'at')}</span>}
                                  </td>
                                  <td className="p-6 text-start">
                                     {isEditing ? (
                                        <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                           <SelectTrigger className={cn("h-10 rounded-xl border-2 font-black text-xs", m.technicalStageId ? "bg-primary/5 text-primary border-primary/20" : "bg-white")}>
                                             <SelectValue placeholder="..." />
                                           </SelectTrigger>
                                           <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                                              <SelectItem value="SIGNING" className="font-black text-[10px] py-3 border-b border-slate-50">
                                                 <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {t('contractSigning')}</span>
                                              </SelectItem>
                                              {pathStages.map(s => <SelectItem key={s.id} value={s.technicalStageId || s.id} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50">
                                                 <span className="flex items-center gap-2"><Workflow className="h-3.5 w-3.5 text-primary" /> {s.name}</span>
                                              </SelectItem>)}
                                           </SelectContent>
                                        </Select>
                                     ) : (
                                        <Badge variant="outline" className={cn("font-black text-[10px] border-0 px-4 h-8 rounded-xl shadow-sm", m.technicalStageId ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-300")}>
                                           <Workflow className="h-3.5 w-3.5 me-2" />
                                           {linkedStageName || (m.technicalStageId === 'SIGNING' ? t('contractSigning') : tSafe('inline.link.pending', 'غير مربوط', 'Unlinked'))}
                                        </Badge>
                                     )}
                                  </td>
                                  <td className="p-6 text-end pe-12">
                                     <div className="flex items-center gap-2 justify-end">
                                        <span className="text-[9px] font-bold text-slate-300">KWD</span>
                                        {isEditing && editData.pricingMode !== 'percentage' ? (
                                           <Input type="number" step="0.001" value={m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value)} className="h-10 w-32 text-end font-black text-emerald-600 text-sm bg-slate-50 border-2 rounded-xl" />
                                        ) : (
                                           <span className="font-mono font-black text-emerald-600 text-3xl">{m.amount?.toLocaleString()}</span>
                                        )}
                                     </div>
                                  </td>
                               </tr>
                             );
                          })}
                       </tbody>
                       <tfoot className="bg-slate-50 border-t-8 border-primary">
                          <tr>
                             <td colSpan={editData.pricingMode === 'percentage' ? 5 : 4} className="p-12 text-start"><h3 className="text-2xl font-black font-headline uppercase tracking-tighter text-slate-800">{tSafe('subcon.totalPayable', 'إجمالي قيمة عقد الباطن', 'Total SubCon Value')}</h3>{editData.pricingMode === 'percentage' && <Badge className={cn("mt-4 border-0 text-[11px] font-black h-8 px-6 shadow-xl", stats.isValid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>{stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}</Badge>}</td>
                             <td className="p-12 text-end pe-12"><div className="space-y-1"><h2 className="text-6xl font-black font-headline text-primary">{editData.totalAmount?.toLocaleString()}</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{tSafe('currency.kwdOnly', 'دينار كويتي لا غير', 'KUWAITI DINARS ONLY')}</p></div></td>
                          </tr>
                       </tfoot>
                    </table>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legalTerms', 'رابعاً: الشروط والأحكام القانونية', 'Legal Terms & Conditions')}</h3>
                 {isEditing ? <Textarea value={editData.legalText} onChange={e => setEditForm({...editData, legalText: e.target.value})} className="min-h-[400px] rounded-[3rem] border-2 p-12 text-base font-bold leading-relaxed bg-slate-50" /> : <div className="p-12 bg-slate-50/50 rounded-[4rem] border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic text-start min-h-[300px]">{contract.legalText || tSafe('inline.no.terms', 'لم يتم تحديد شروط إضافية.', 'No additional terms defined.')}</div>}
              </div>

              <div className="pt-24 grid grid-cols-2 gap-32">
                 <div className="text-center space-y-8"><div className="h-32 border-b-4 border-slate-100 relative"><div className="absolute inset-0 flex items-center justify-center opacity-5"><Landmark className="h-24 w-24" /></div></div><div className="space-y-2"><p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.first.party.sign', 'توقيع الطرف الأول', 'First Party Signature')}</p><p className="text-sm font-black text-slate-900">{globalUser?.companyName || 'NovaFlow ERP'}</p></div></div>
                 <div className="text-center space-y-8"><div className="h-32 border-b-4 border-slate-100 relative"><div className="absolute inset-0 flex items-center justify-center opacity-5"><Handshake className="h-24 w-24" /></div></div><div className="space-y-2"><p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.second.party.sign', 'توقيع الطرف الثاني', 'Second Party Signature')}</p><p className="text-sm font-black text-slate-900">{contract.subcontractorName}</p></div></div>
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}
