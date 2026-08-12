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
  Landmark
} from "lucide-react";
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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

  const stats = useMemo(() => {
    const milestones = editData.milestones || [];
    const totalPercentage = milestones.reduce((acc: number, m: any) => acc + (Number(m.percentage) || 0), 0);
    const totalItemizedAmount = milestones.reduce((acc: number, m: any) => acc + (Number(m.amount) || 0), 0);
    const isValid = Math.abs(totalPercentage - 100) < 0.1;
    return { totalPercentage, totalItemizedAmount, isValid };
  }, [editData.milestones]);

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
      toast({ title: tSafe('common.saved', 'تم الحفظ', 'Saved') });
      setIsEditing(false);
    } catch (e) {
      toast({ variant: "destructive", title: t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  const updateMilestone = (idx: number, field: string, value: any) => {
    const newM = [...(editData.milestones || [])];
    const item = { ...newM[idx], [field]: value };
    
    if (editData.pricingMode === 'percentage' && (field === 'percentage' || field === 'amount')) {
      const total = editData.totalAmount || 0;
      if (field === 'percentage') {
        item.amount = (total * (Number(value) || 0)) / 100;
      } else if (field === 'amount' && total > 0) {
        item.percentage = (Number(value) / total) * 100;
      }
    }
    
    newM[idx] = item;
    setEditForm({...editData, milestones: newM});
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center bg-white"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!contract) return <div className="p-20 text-center font-black">{tSafe('inline.not.found', '404 - غير موجود', '404 - Not Found')}</div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700 bg-white" dir={dir}>
      <div className="max-w-full mx-auto flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-8 pt-6 text-start">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-12 w-12 p-0 rounded-2xl border-2 bg-white text-slate-400 hover:text-slate-900 transition-all shadow-sm shrink-0 flex items-center justify-center">
              <ArrowRight className={cn("h-6 w-6", !isRtl && "rotate-180")} />
           </button>
           <div className="text-start">
              <h1 className="text-2xl font-black text-slate-900">{tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')}</h1>
              <Badge className="bg-primary text-white border-0 font-black px-4 py-1.5 rounded-xl uppercase text-[10px] mt-1 shadow-lg">#{contract.id.slice(-8).toUpperCase()}</Badge>
           </div>
        </div>
        <div className="flex gap-3">
           {isEditing ? (
              <Button onClick={handleSave} disabled={saving} className="h-12 px-10 rounded-xl bg-primary text-white font-black shadow-xl border-b-4 border-orange-700 hover:scale-[1.02] transition-all">
                {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                {tSafe('common.saveChanges', 'حفظ التغييرات', 'Save Changes')}
              </Button>
           ) : (
             <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl h-12 px-8 font-black gap-3 border-2 border-primary/20 bg-white text-primary">
                <Edit3 className="h-5 w-5" /> {tSafe('common.edit', 'تعديل', 'Edit')}
             </Button>
           )}
           <Button onClick={() => window.print()} className="rounded-xl h-12 px-10 font-black gap-3 bg-slate-900 text-white shadow-xl">
              <Printer className="h-5 w-5" /> {tSafe('common.print', 'طباعة', 'Print')}
           </Button>
        </div>
      </div>

      <div className="px-8">
        <PrintWrapper title={tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')} fullWidth={true}>
           <div className="space-y-12 text-start">
              
              <div className="p-10 rounded-[3rem] bg-white border-2 border-primary/10 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden shadow-xl ring-1 ring-black/[0.02]">
                 <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-48 w-48 text-primary" /></div>
                 <div className="space-y-4 relative z-10 text-start">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">{tSafe('subcon.vendor', 'المقاول الطرف الثاني /', 'Subcontractor:')}</p>
                       <h2 className="text-4xl font-black font-headline text-slate-900">{contract.subcontractorName}</h2>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tSafe('common.project', 'المشروع', 'Project')}</p>
                       <p className="text-xl font-black text-slate-800">{contract.projectTitle}</p>
                    </div>
                 </div>
                 <div className="text-center md:text-end relative z-10 shrink-0">
                    <div className="bg-primary/5 p-10 rounded-[2.5rem] border-2 border-white shadow-xl ring-4 ring-white">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{tSafe('subcon.form.targetBudget', 'إجمالي قيمة العقد', 'Contract Value')}</p>
                       <h3 className="text-5xl font-black font-headline text-slate-900">
                          {contract.totalAmount?.toLocaleString()} <span className="text-sm font-bold opacity-40">KWD</span>
                       </h3>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="flex justify-between items-center px-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                       <Layers className="h-5 w-5 text-primary" /> {tSafe('subcon.details.review', 'مراجعة واعتماد بنود التعاقد', 'Contractual Milestones Review')}
                    </h4>
                 </div>

                 <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-xs text-start">
                       <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                             <th className="p-6 w-12 text-start">#</th>
                             <th className="p-6 text-start">{tSafe('name', 'مسمى الدفعة', 'Milestone Name')}</th>
                             {contract.pricingMode === 'percentage' && <th className="p-6 text-center w-24">%</th>}
                             <th className="p-6 text-end pe-12 w-48">{tSafe('amount', 'المبلغ', 'Amount')}</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {(contract.milestones || []).map((m: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                               <td className="p-6 font-black text-slate-300 text-start">{idx + 1}</td>
                               <td className="p-4 text-start font-black text-slate-800 text-sm">
                                  {m.name}
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

              <div className="space-y-6 text-start pt-10">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3 border-b-4 border-primary/20 pb-4">
                    <ShieldCheck className="h-6 w-6 text-primary" /> {tSafe('subcon.legalTerms', 'البنود والشروط القانونية (عقد الباطن)', 'SubCon Legal Terms & Clauses')}
                 </h4>
                 <p className="p-12 bg-slate-50/50 rounded-[4rem] border-2 border-white shadow-inner text-base font-bold text-slate-700 leading-relaxed whitespace-pre-wrap italic text-start">
                    {contract.legalText || tSafe('inline.no.terms', 'لم يتم تحديد شروط قانونية.', 'No terms defined.')}
                 </p>
              </div>
           </div>
        </PrintWrapper>
      </div>
    </div>
  );
}