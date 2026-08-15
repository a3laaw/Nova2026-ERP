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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/select-primitive";

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
  
  // تأمين القيم الافتراضية لمنع خطأ Controlled Input
  const [editData, setEditForm] = useState<any>({
    name: '',
    totalAmount: 0,
    retentionRate: 5,
    milestones: [],
    legalText: '',
    pricingMode: 'percentage'
  });

  const [pathStages, setPathStages] = useState<any[]>([]);

  const contractRef = useMemo(() => 
    companyId && db ? doc(db, paths.subconContracts(companyId), contractId) : null, 
  [db, companyId, contractId]);

  const { data: contract, loading } = useDoc<any>(contractRef);

  useEffect(() => {
    if (contract) {
      setEditForm({
        ...contract,
        name: contract.name || '',
        totalAmount: contract.totalAmount || 0,
        retentionRate: contract.retentionRate ?? 5,
        milestones: contract.milestones || [],
        legalText: contract.legalText || '',
        pricingMode: contract.pricingMode || 'percentage'
      });
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
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-8 pt-6 text-start">
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
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">أولاً: أطراف التعاقد</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-white shadow-inner text-start space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الطرف الأول (المقاول الرئيسي)</p>
                       <h4 className="text-xl font-black text-slate-900">{globalUser?.companyName || 'NovaFlow ERP'}</h4>
                    </div>
                    <div className="p-8 rounded-[2.5rem] bg-orange-50/50 border-2 border-white shadow-inner text-start space-y-4">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest">الطرف الثاني (مقاول الباطن)</p>
                       <h4 className="text-xl font-black text-slate-900">{contract.subcontractorName}</h4>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">ثانياً: موضوع التعاقد والميزانية</h3>
                 <div className="p-10 rounded-[3rem] bg-white border-2 border-slate-100 shadow-sm text-start space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Landmark className="h-40 w-40" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-2 relative z-10">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">المشروع المرتبط</Label>
                          <p className="text-2xl font-black text-slate-900">{contract.projectTitle}</p>
                       </div>
                       <div className="space-y-2 relative z-10 text-end">
                          <Label className="text-[10px] font-black text-primary uppercase">المحتجزات المتفق عليها</Label>
                          <div className="flex items-center justify-end gap-2">
                             {isEditing ? (
                               <div className="relative w-24">
                                  <Input type="number" value={editData.retentionRate ?? 0} onChange={e => setEditForm({...editData, retentionRate: Number(e.target.value)})} className="h-8 rounded-xl border-2 font-black text-center" />
                               </div>
                             ) : <Badge className="bg-slate-900 text-white font-black text-lg h-9 px-4">{contract.retentionRate}%</Badge>}
                          </div>
                       </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10 pt-8 border-t border-slate-50 relative z-10">
                       <div className="text-start space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي قيمة التعاقد (مقطوعية)</p>
                          {isEditing ? <Input type="number" value={editData.totalAmount || 0} onChange={e => setEditForm({...editData, totalAmount: Number(e.target.value)})} className="h-10 rounded-2xl border-2 text-2xl font-black text-primary" /> : <h3 className="text-5xl font-black font-headline text-primary">{contract.totalAmount?.toLocaleString()} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">KWD</span></h3>}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">ثالثاً: جدول استحقاق الدفعات</h3>
                 <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                    <table className="w-full text-xs text-start">
                       <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                             <th className="p-8 w-14 text-start">#</th>
                             <th className="p-8 text-start">الوصف</th>
                             {editData.pricingMode === 'percentage' && <th className="p-8 text-center w-32">%</th>}
                             <th className="p-8 text-center w-32">التوقيت</th>
                             <th className="p-8 text-start w-48">الارتباط الميداني</th>
                             <th className="p-8 text-end pe-12 w-56">القيمة</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {(editData.milestones || []).map((m: any, idx: number) => {
                             const linkedStageName = pathStages.find(s => s.technicalStageId === m.technicalStageId || s.id === m.technicalStageId)?.name;
                             return (
                               <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-8 font-black text-slate-300">{idx + 1}</td>
                                  <td className="p-4 text-start">{isEditing ? <Input value={m.name || ''} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 border-2 rounded-xl font-bold" /> : <p className="font-black text-slate-900 text-lg">{m.name}</p>}</td>
                                  {editData.pricingMode === 'percentage' && <td className="p-4 text-center">{isEditing ? <Input type="number" value={m.percentage || 0} onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))} className="h-8 rounded-xl border-2 font-black text-center" /> : <Badge className="bg-slate-900 text-white font-black text-base px-6 h-9 rounded-2xl shadow-xl">{m.percentage}%</Badge>}</td>}
                                  <td className="p-4 text-center">
                                      {isEditing ? (
                                        <Select value={m.timing || 'at'} onValueChange={v => updateMilestone(idx, 'timing', v)}>
                                           <SelectTrigger className="h-8 rounded-xl border-2 font-black text-xs bg-white"><SelectValue /></SelectTrigger>
                                           <SelectContent className="max-h-[300px] overflow-y-auto rounded-xl border-2 shadow-2xl z-[160]">
                                              <SelectItem value="at" className="font-bold text-xs">عند</SelectItem>
                                              <SelectItem value="before" className="font-bold text-xs">قبل</SelectItem>
                                              <SelectItem value="during" className="font-bold text-xs">أثناء</SelectItem>
                                              <SelectItem value="after" className="font-bold text-xs">بعد</SelectItem>
                                           </SelectContent>
                                        </Select>
                                      ) : <span className="font-bold text-xs text-slate-600">{t(m.timing || 'at')}</span>}
                                  </td>
                                  <td className="p-4 text-start">
                                     {isEditing ? (
                                        <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                           <SelectTrigger className={cn("h-8 rounded-xl border-2 font-black text-xs", m.technicalStageId ? "bg-primary/5 text-primary border-primary/20" : "bg-white")}>
                                             <SelectValue placeholder="..." />
                                           </SelectTrigger>
                                           <SelectContent className="max-h-[300px] overflow-y-auto rounded-xl border-2 shadow-2xl z-[160]">
                                              <SelectItem value="SIGNING" className="font-black text-[10px] py-3 border-b border-slate-50">توقيع العقد</SelectItem>
                                              {pathStages.map(s => <SelectItem key={s.id} value={s.technicalStageId || s.id} className="font-bold text-xs py-3">{s.name}</SelectItem>)}
                                           </SelectContent>
                                        </Select>
                                     ) : (
                                        <Badge variant="outline" className={cn("font-black text-[10px] border-0 px-4 h-8 rounded-xl shadow-sm", m.technicalStageId ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-300")}>
                                           {linkedStageName || 'غير مربوط'}
                                        </Badge>
                                     )}
                                  </td>
                                  <td className="p-4 text-end pe-12">
                                     {isEditing && editData.pricingMode !== 'percentage' ? (
                                        <Input type="number" step="0.001" value={m.amount || 0} onChange={e => updateMilestone(idx, 'amount', Number(e.target.value))} className="h-8 w-32 text-end font-black text-emerald-600 text-sm bg-slate-50 border-2 rounded-xl" />
                                     ) : (
                                        <span className="font-mono font-black text-emerald-600 text-2xl">{m.amount?.toLocaleString()} KWD</span>
                                     )}
                                  </td>
                               </tr>
                             );
                          })}
                       </tbody>
                       <tfoot className="bg-slate-50 border-t-8 border-primary">
                          <tr>
                             <td colSpan={editData.pricingMode === 'percentage' ? 5 : 4} className="p-12 text-start"><h3 className="text-2xl font-black font-headline uppercase tracking-tighter text-slate-800">إجمالي قيمة عقد الباطن</h3></td>
                             <td className="p-12 text-end pe-12"><div className="space-y-1"><h2 className="text-6xl font-black font-headline text-primary">{editData.totalAmount?.toLocaleString()}</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">دينار كويتي لا غير</p></div></td>
                          </tr>
                       </tfoot>
                    </table>
                 </div>
              </div>

              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">رابعاً: الشروط والأحكام القانونية</h3>
                 {isEditing ? <Textarea value={editData.legalText || ''} onChange={e => setEditForm({...editData, legalText: e.target.value})} className="min-h-[400px] rounded-[3rem] border-2 p-12 text-base font-bold leading-relaxed bg-slate-50" /> : <div className="p-12 bg-slate-50/50 rounded-[4rem] border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic text-start min-h-[300px]">{contract.legalText || 'لم يتم تحديد شروط إضافية.'}</div>}
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}
