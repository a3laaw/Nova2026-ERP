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
  Layers, Percent,
  History,
  Wallet,
  ArrowRight,
  Plus,
  Workflow,
  Clock,
  Landmark,
  User,
  Gavel,
  CheckCircle2,
  FileText
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";

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

  const contractRef = useMemo(() => 
    companyId && db ? doc(db, paths.subconContracts(companyId), contractId) : null, 
  [db, companyId, contractId]);

  const { data: contract, loading } = useDoc<any>(contractRef);

  useEffect(() => {
    if (contract) {
      setEditForm(contract);
    }
  }, [contract]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    setSaving(true);
    try {
      const docRef = doc(db, paths.subconContracts(companyId), contractId);
      await updateDoc(docRef, {
        ...editData,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      toast({ title: tSafe('common.saved', 'تم الحفظ بنجاح', 'Saved Successfully') });
      setIsEditing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center bg-white"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!contract) return <div className="p-20 text-center font-black">{tSafe('inline.not.found', '404 - غير موجود', '404 - Not Found')}</div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-white" dir={dir}>
      <div className="max-w-full mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-8 pt-6 text-start">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 shadow-sm shrink-0">
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
              <h1 className="text-xl font-black text-slate-900">{tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">REF: {contract.id.slice(-8).toUpperCase()}</p>
           </div>
        </div>
        <div className="flex gap-2">
           {isEditing ? (
              <Button onClick={handleSave} disabled={saving} className="h-10 px-8 rounded-xl bg-primary text-white font-black shadow-xl border-b-4 border-orange-700">
                {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                {tSafe('common.saveChanges', 'حفظ التغييرات', 'Save Changes')}
              </Button>
           ) : (
             <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl h-10 px-6 font-black gap-2 border-2 bg-white text-primary">
                <Edit3 className="h-4 w-4" /> {tSafe('common.edit', 'تعديل', 'Edit')}
             </Button>
           )}
           <Button onClick={() => window.print()} className="rounded-xl h-10 px-8 font-black gap-2 bg-slate-900 text-white shadow-xl">
              <Printer className="h-4 w-4" /> {tSafe('common.print', 'طباعة', 'Print')}
           </Button>
        </div>
      </div>

      <div className="px-4 md:px-8">
        <PrintWrapper title={tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')} fullWidth={true}>
           <div className="space-y-12 text-start">
              
              {/* القسم الأول: أطراف التعاقد */}
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.parties', 'أولاً: أطراف التعاقد', 'Parties of the Agreement')}</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="p-6 rounded-[2rem] bg-slate-50 border-2 border-white shadow-inner text-start space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('subcon.first.party', 'الطرف الأول (المقاول الرئيسي)', 'First Party (Main Contractor)')}</p>
                       <div className="space-y-1">
                          <h4 className="text-xl font-black text-slate-900">{globalUser?.companyName || 'NovaFlow ERP'}</h4>
                          <p className="text-[10px] font-bold text-slate-400">{tSafe('subcon.representedBy', 'يمثلها قانوناً: ', 'Represented by: ')} {globalUser?.fullName || 'Manager'}</p>
                       </div>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-orange-50/50 border-2 border-white shadow-inner text-start space-y-4">
                       <p className="text-[10px] font-black text-primary uppercase tracking-widest">{tSafe('subcon.second.party', 'الطرف الثاني (مقاول الباطن)', 'Second Party (Subcontractor)')}</p>
                       <div className="space-y-1">
                          <h4 className="text-xl font-black text-slate-900">{contract.subcontractorName}</h4>
                          <p className="text-[10px] font-bold text-slate-400">{tSafe('subcon.vendorId', 'رقم السجل/المدني:', 'Reg/Civil ID:')} {contract.subcontractorId?.slice(-8)}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* القسم الثاني: موضوع التعاقد */}
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.subject', 'ثانياً: موضوع التعاقد والميزانية', 'Contract Subject & Budget')}</h3>
                 <div className="p-8 rounded-[2rem] bg-white border-2 border-slate-100 shadow-sm text-start space-y-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400 uppercase">{tSafe('common.project', 'المشروع المرتبط', 'Linked Project')}</Label>
                       <p className="text-lg font-black text-slate-900">{contract.projectTitle}</p>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 pt-6 border-t border-slate-50">
                       <div className="text-start space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.form.targetBudget', 'إجمالي قيمة التعاقد (مقطوعية)', 'Total Contract Value (Lumpsum)')}</p>
                          <h3 className="text-4xl font-black text-primary">{contract.totalAmount?.toLocaleString()} <span className="text-xs font-bold text-slate-400">KWD</span></h3>
                       </div>
                       <div className="bg-emerald-50 px-6 py-3 rounded-2xl border-2 border-emerald-100 flex items-center gap-3">
                          <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          <span className="font-black text-[10px] text-emerald-800 uppercase tracking-widest">{tSafe('subcon.fixedPrice', 'سعر ثابت معتمد', 'Fixed Price Approved')}</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* القسم الثالث: جدول الدفعات */}
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.milestones', 'ثالثاً: جدول استحقاق الدفعات', 'Payment Milestones')}</h3>
                 <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                    <table className="w-full text-xs text-start">
                       <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                             <th className="p-6 w-12 text-start">#</th>
                             <th className="p-6 text-start">{tSafe('name', 'مسمى الدفعة المستحقة', 'Milestone Description')}</th>
                             {contract.pricingMode === 'percentage' && <th className="p-6 text-center w-24">%</th>}
                             <th className="p-6 text-end pe-12 w-48">{tSafe('amount', 'المبلغ المستحق', 'Payable Amount')}</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {(contract.milestones || []).map((m: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                               <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                               <td className="p-4 text-start font-black text-slate-800 text-sm">
                                  {m.name}
                                  {m.technicalStageId && (
                                     <div className="flex items-center gap-2 mt-1.5">
                                        <Badge variant="secondary" className="bg-primary/5 text-primary text-[8px] font-black h-4 px-2 border-0 uppercase">
                                           <Workflow className="h-2.5 w-2.5 me-1" /> {tSafe('inline.link.stage', 'ارتباط فني معتمد', 'Technical Link Approved')}
                                        </Badge>
                                     </div>
                                  )}
                               </td>
                               {contract.pricingMode === 'percentage' && (
                                 <td className="p-4 text-center font-black text-slate-900 text-lg">
                                    {m.percentage}%
                                 </td>
                               )}
                               <td className="p-4 text-end pe-12">
                                  <span className="font-mono font-black text-emerald-600 text-2xl">
                                     {m.amount?.toLocaleString()} <span className="text-xs opacity-40">KWD</span>
                                  </span>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* القسم الرابع: الشروط القانونية */}
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legalTerms', 'رابعاً: الشروط والأحكام القانونية', 'Legal Terms & Conditions')}</h3>
                 <div className="p-12 bg-slate-50/50 rounded-[3rem] border-2 border-white shadow-inner text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic text-start min-h-[300px]">
                    {contract.legalText || tSafe('inline.no.terms', 'لم يتم تحديد شروط إضافية.', 'No additional terms defined.')}
                 </div>
              </div>

              {/* القسم الخامس: التواقيع (فقط للطباعة) */}
              <div className="pt-20 grid grid-cols-2 gap-20">
                 <div className="text-center space-y-6">
                    <div className="h-32 border-b-4 border-slate-100 relative">
                       <p className="absolute -top-10 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-300 uppercase tracking-widest">{tSafe('inline.seal.space', 'موضع الختم الرسمي', 'Official Seal Area')}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.first.party.sign', 'توقيع الطرف الأول', 'First Party Signature')}</p>
                       <p className="text-xs font-black text-slate-900">{globalUser?.companyName}</p>
                    </div>
                 </div>
                 <div className="text-center space-y-6">
                    <div className="h-32 border-b-4 border-slate-100 relative">
                       <p className="absolute -top-10 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-300 uppercase tracking-widest">{tSafe('inline.signature.space', 'موضع التوقيع', 'Signature Area')}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.second.party.sign', 'توقيع الطرف الثاني', 'Second Party Signature')}</p>
                       <p className="text-xs font-black text-slate-900">{contract.subcontractorName}</p>
                    </div>
                 </div>
              </div>

              {/* تذييل الوثيقة السيادي */}
              <div className="pt-12 flex justify-between items-end opacity-40">
                 <div className="text-start">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{tSafe('inline.official.timestamp', 'بصمة النظام الرقمية /', 'Official System Timestamp:')}</p>
                    <p className="text-[9px] font-mono font-bold">{new Date().toLocaleString()}</p>
                 </div>
                 <div className="text-end">
                    <Landmark className="h-10 w-10 text-primary" />
                 </div>
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}