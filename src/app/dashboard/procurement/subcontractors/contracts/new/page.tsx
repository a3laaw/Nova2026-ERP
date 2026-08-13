
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Loader2, Save, Sparkles, 
  Handshake, Building2, Workflow, Target,
  Search, Check, ChevronDown, Calculator,
  Plus, Trash2, Gavel, Landmark, ShieldCheck,
  Percent, FileText, Info, UserCircle, X
} from "lucide-react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PrintWrapper } from '@/components/layout/print-wrapper';
import { ContractMilestone, SubConContractTemplate } from '@/types/templates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function NewSubConContractContent() {
  const { globalUser, user } = useAuthContext();
  const { lang, dir, t, tSafe } = useLanguage();
  const { permissions, isAdmin } = usePermissions();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRtl = lang === 'ar';
  const companyId = globalUser?.companyId;

  const preTransactionId = searchParams.get('transactionId');
  const preTemplateId = searchParams.get('templateId');

  const [loading, setLoading] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [transSearch, setTransSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");

  const [form, setForm] = useState<any>({
    subcontractorId: '',
    subcontractorName: '',
    clientId: '',
    clientName: '',
    transactionId: preTransactionId || '',
    transactionNumber: '',
    transactionName: '',
    templateId: preTemplateId || '',
    templateName: '',
    name: '',
    totalAmount: 0,
    milestones: [] as ContractMilestone[],
    legalText: '',
    pricingMode: 'percentage'
  });

  const [pathStages, setPathStages] = useState<any[]>([]);

  const subsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subcontractors(companyId)), where('status', '==', 'active')) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);

  const transQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, 
  [db, companyId]);

  const templatesQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.subconContractTemplates(companyId)), where('isActive', '==', true)) : null, 
  [db, companyId]);

  const { data: subcontractors } = useCollection<any>(subsQuery);
  const { data: clients } = useCollection<any>(clientsQuery);
  const { data: transactions } = useCollection<any>(transQuery);
  const { data: templates } = useCollection<SubConContractTemplate>(templatesQuery);

  const filteredSubs = useMemo(() => (subcontractors || []).filter(s => s.name.toLowerCase().includes(subSearch.toLowerCase())), [subcontractors, subSearch]);
  
  const filteredClients = useMemo(() => (clients || []).filter(c => 
    c.nameAr.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.fileNumber.toLowerCase().includes(clientSearch.toLowerCase())
  ), [clients, clientSearch]);

  const filteredTrans = useMemo(() => (transactions || []).filter(t_item => {
    const matchClient = !form.clientId || t_item.clientId === form.clientId;
    const matchSearch = t_item.subServiceName.toLowerCase().includes(transSearch.toLowerCase()) || 
                        t_item.transactionNumber.toLowerCase().includes(transSearch.toLowerCase());
    return matchClient && matchSearch;
  }), [transactions, transSearch, form.clientId]);

  const filteredTemps = useMemo(() => (templates || []).filter(t => t.name.toLowerCase().includes(tempSearch.toLowerCase())), [templates, tempSearch]);

  useEffect(() => {
    if (db && companyId && form.templateId) {
      const template = templates?.find(t => t.id === form.templateId);
      if (template) {
        setForm(prev => ({
          ...prev,
          templateName: template.name,
          milestones: template.defaultMilestones || [],
          legalText: template.legalText || '',
          pricingMode: template.pricingMode || 'percentage',
          totalAmount: template.baseAmount || 0
        }));
      }
    }
  }, [form.templateId, templates, db, companyId]);

  useEffect(() => {
    if (db && companyId && form.transactionId) {
       const trans = transactions?.find(t => t.id === form.transactionId);
       if (trans) {
          setForm(prev => ({ 
            ...prev, 
            transactionName: trans.subServiceName, 
            transactionNumber: trans.transactionNumber,
            clientName: trans.clientName,
            clientId: trans.clientId
          }));
          getDocs(query(collection(db, paths.transactionStages(companyId, trans.id)), orderBy('order')))
            .then(snap => setPathStages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(() => setPathStages([]));
       }
    } else {
       setPathStages([]);
    }
  }, [form.transactionId, transactions, db, companyId]);

  const stats = useMemo(() => {
    const milestones = form.milestones || [];
    const totalPercentage = milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
    const isValid = form.pricingMode === 'percentage' ? Math.abs(totalPercentage - 100) < 0.1 : true;
    return { totalPercentage, isValid };
  }, [form.milestones, form.pricingMode]);

  const updateMilestone = (idx: number, field: keyof ContractMilestone, value: any) => {
    const newM = [...form.milestones];
    const item = { ...newM[idx], [field]: value };
    
    if (form.pricingMode === 'percentage' && (field === 'percentage' || field === 'amount')) {
      const total = form.totalAmount || 0;
      if (field === 'percentage') {
        item.amount = (total * (Number(value) || 0)) / 100;
      } else if (field === 'amount' && total > 0) {
        item.percentage = (Number(value) / total) * 100;
      }
    }
    
    newM[idx] = item;
    setForm({...form, milestones: newM});
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !form.subcontractorId || !form.transactionId) return;
    setLoading(true);
    try {
      const contractRef = doc(collection(db, paths.subconContracts(companyId)));
      const contractData = {
        ...form,
        id: contractRef.id,
        status: 'active',
        projectTitle: `${form.clientName} - ${form.transactionName}`,
        companyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(contractRef, contractData);
      toast({ title: tSafe('common.saved', 'تم حفظ العقد بنجاح', 'Saved Successfully') });
      router.push(`/dashboard/procurement/subcontractors/contracts/${contractRef.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 bg-white" dir={dir}>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/95 backdrop-blur-md px-8 shadow-sm">
        <div className="flex items-center gap-4 text-start">
           <button onClick={() => router.back()} className="h-10 w-10 border-2 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 shadow-sm">
              <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} />
           </button>
           <h1 className="text-xl font-black font-headline text-slate-900">{tSafe('subcon.contracts.new', 'تأسيس اتفاقية باطن جديدة', 'New SubCon Award')}</h1>
        </div>
        <Button onClick={handleSave} disabled={loading || !form.subcontractorId || !form.transactionId} className="h-12 px-10 rounded-xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-4 border-orange-700">
           {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
           {tSafe('subcon.contracts.issueNow', 'إصدار الاتفاقية الآن', 'Issue Award Now')}
        </Button>
      </header>

      <div className="px-8 pb-20">
         <PrintWrapper title={tSafe('subcon.details.official', 'اتفاقية تنفيذ أعمال باطن', 'SubCon Services Agreement')} fullWidth={true}>
            <div className="space-y-12 text-start">
               
               <div className="space-y-6">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.parties', 'أولاً: أطراف التعاقد', 'Parties of the Agreement')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-white shadow-inner text-start space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.first.party', 'الطرف الأول (المقاول الرئيسي)', 'First Party')}</p>
                        <h4 className="text-xl font-black text-slate-900">{globalUser?.companyName || 'NovaFlow ERP'}</h4>
                     </div>
                     <div className="p-8 rounded-[2.5rem] bg-primary/5 border-2 border-primary/10 shadow-sm space-y-4">
                        <Label className="text-[10px] font-black text-primary uppercase">{tSafe('subcon.second.party', 'الطرف الثاني (مقاول الباطن)', 'Second Party')}</Label>
                        <SearchablePicker 
                          value={form.subcontractorName} 
                          onSelect={(s: any) => setForm({...form, subcontractorId: s.id, subcontractorName: s.name})}
                          items={filteredSubs}
                          search={subSearch}
                          onSearchChange={setSubSearch}
                          icon={Handshake}
                          placeholder={tSafe('subcon.form.vendor', 'اختر المقاول...', 'Choose Contractor')}
                          isRtl={isRtl}
                        />
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legal.subject', 'ثانياً: موضوع التعاقد والميزانية', 'Contract Subject & Budget')}</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                     <div className="lg:col-span-8 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('common.targetClient', 'العميل المستهدف (المالك)', 'Target Client')}</Label>
                              <SearchablePicker 
                                type="client"
                                value={form.clientName} 
                                onSelect={(c: any) => setForm({...form, clientId: c.id, clientName: c.nameAr, transactionId: '', transactionName: '', transactionNumber: ''})}
                                items={filteredClients}
                                search={clientSearch}
                                onSearchChange={setClientSearch}
                                icon={UserCircle}
                                placeholder={tSafe('subcon.form.client', 'اختر العميل...', 'Choose Client')}
                                isRtl={isRtl}
                              />
                           </div>
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('common.targetTransaction', 'المشروع / المعاملة', 'Target Project')}</Label>
                              <SearchablePicker 
                                type="transaction"
                                disabled={!form.clientId}
                                value={form.transactionName} 
                                onSelect={(t_item: any) => setForm({...form, transactionId: t_item.id, transactionNumber: t_item.transactionNumber, transactionName: t_item.subServiceName})}
                                items={filteredTrans}
                                search={transSearch}
                                onSearchChange={setTransSearch}
                                icon={Target}
                                placeholder={tSafe('subcon.form.project', 'اختر المشروع...', 'Choose Project')}
                                isRtl={isRtl}
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('subcon.form.template', 'القالب القانوني لتعاقد الباطن', 'Legal SubCon Template')}</Label>
                           <SearchablePicker 
                             type="template"
                             value={form.templateName} 
                             onSelect={(temp: any) => setForm({...form, templateId: temp.id, templateName: temp.name})}
                             items={filteredTemps}
                             search={tempSearch}
                             onSearchChange={setTempSearch}
                             icon={FileText}
                             placeholder={tSafe('subcon.form.template', 'اختر القالب...', 'Choose Template')}
                             isRtl={isRtl}
                           />
                        </div>
                     </div>
                     <div className="lg:col-span-4 p-8 rounded-[3rem] bg-emerald-600 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 right-0 p-8 opacity-10"><Calculator className="h-32 w-32" /></div>
                        <div className="relative z-10 space-y-2 text-start">
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-200">{tSafe('subcon.form.targetBudget', 'إجمالي قيمة التعاقد', 'Contract Value')}</p>
                           <Input 
                             type="number" 
                             value={form.totalAmount === 0 ? "" : form.totalAmount} 
                             onChange={e => setForm({...form, totalAmount: Number(e.target.value)})}
                             className="h-16 bg-white/20 border-0 rounded-2xl text-4xl font-black text-center text-white shadow-inner focus:bg-white/30" 
                           />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b-2 border-primary/10 pb-2">
                     <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{tSafe('subcon.legal.milestones', 'ثالثاً: جدول استحقاق الدفعات', 'Payment Milestones')}</h3>
                     <Button variant="outline" size="sm" onClick={() => setForm({...form, milestones: [...form.milestones, { name: getOrdinalLabel(form.milestones.length), percentage: 0, amount: 0, timing: 'at' }]})} className="rounded-xl h-9 px-6 font-black border-2 gap-2 bg-white hover:bg-primary/5 shadow-sm">
                        <Plus className="h-4 w-4" /> {tSafe('common.add', 'إضافة دفعة', 'Add')}
                     </Button>
                  </div>
                  
                  <div className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-xl ring-1 ring-black/[0.02]">
                     <table className="w-full text-xs text-start">
                        <thead className="bg-slate-50 border-b-2 text-slate-600 font-black uppercase text-[10px] tracking-widest">
                           <tr>
                              <th className="p-6 w-12 text-start">#</th>
                              <th className="p-6 text-start">{tSafe('name', 'الوصف', 'Description')}</th>
                              <th className="p-6 text-center w-24">%</th>
                              <th className="p-6 text-start w-48">{tSafe('technicalLink', 'الارتباط الميداني', 'Execution Link')}</th>
                              <th className="p-6 text-end pe-12 w-48">{t('common.amount')}</th>
                              <th className="p-6 w-14"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {form.milestones.map((m: any, idx: number) => (
                             <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-6 font-black text-slate-300">{idx + 1}</td>
                                <td className="p-4">
                                   <Input value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} className="h-10 border-2 rounded-xl font-bold bg-white" />
                                </td>
                                <td className="p-4">
                                   <div className="relative w-24 mx-auto">
                                      <Input type="number" value={m.percentage === 0 ? "" : m.percentage} onChange={e => updateMilestone(idx, 'percentage', e.target.value)} className="h-10 rounded-xl border-2 font-black text-center pe-8" />
                                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                   </div>
                                </td>
                                <td className="p-4">
                                   <Select value={m.technicalStageId || ''} onValueChange={v => updateMilestone(idx, 'technicalStageId', v)}>
                                      <SelectTrigger className="h-10 rounded-xl border-2 font-black text-[10px] bg-slate-50/50">
                                         <SelectValue placeholder="..." />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl z-[160] shadow-3xl">
                                         {pathStages.map(s => <SelectItem key={s.id} value={s.id!} className="font-bold text-xs py-3 border-b last:border-0 border-slate-50 text-start">
                                            <div className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> {s.name}</div>
                                         </SelectItem>)}
                                      </SelectContent>
                                   </Select>
                                </td>
                                <td className="p-4 text-end pe-12">
                                   <div className="flex items-center gap-2 justify-end">
                                      <span className="font-mono font-black text-emerald-600 text-xl">{m.amount?.toLocaleString()}</span>
                                      <span className="text-[9px] font-bold text-slate-300">KWD</span>
                                   </div>
                                </td>
                                <td className="p-4 text-center">
                                   <button type="button" onClick={() => setForm({...form, milestones: form.milestones.filter((_:any, i:number) => i !== idx)})} className="text-rose-200 hover:text-rose-600"><Trash2 className="h-5 w-5" /></button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-8 border-primary">
                           <tr>
                              <td colSpan={3} className="p-10 text-start">
                                 <h3 className="text-xl font-black font-headline uppercase tracking-tighter text-slate-800">{tSafe('subcon.totalPayable', 'إجمالي قيمة عقد الباطن', 'Total SubCon Contract Value')}</h3>
                                 <Badge className={cn("mt-3 border-0 text-[10px] font-black h-7 px-5 shadow-lg", stats.isValid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
                                    {stats.isValid ? `BALANCED: 100%` : `MISMATCH: ${stats.totalPercentage}%`}
                                 </Badge>
                              </td>
                              <td colSpan={2} className="p-10 text-end pe-12">
                                 <div className="space-y-1">
                                    <h2 className="text-5xl font-black font-headline text-primary">{form.totalAmount.toLocaleString()}</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{tSafe('currency.kwdOnly', 'دينار كويتي لا غير', 'KUWAITI DINARS ONLY')}</p>
                                 </div>
                              </td>
                              <td></td>
                           </tr>
                        </tfoot>
                     </table>
                  </div>
               </div>

               <div className="space-y-6">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/10 pb-2">{tSafe('subcon.legalTerms', 'رابعاً: الشروط والأحكام القانونية', 'Legal Terms & Conditions')}</h3>
                  <Textarea value={form.legalText} onChange={e => setForm({...form, legalText: e.target.value})} className="min-h-[300px] rounded-[3rem] border-2 p-12 text-base font-bold leading-relaxed bg-slate-50/50 shadow-inner focus:bg-white transition-all" />
               </div>

               <div className="pt-20 grid grid-cols-2 gap-20 opacity-30">
                  <div className="text-center space-y-4">
                     <div className="h-32 border-b-2 border-slate-100" />
                     <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.first.party.sign', 'توقيع الطرف الأول', 'First Party Signature')}</p>
                  </div>
                  <div className="text-center space-y-4">
                     <div className="h-32 border-b-2 border-slate-100" />
                     <p className="text-[10px] font-black text-slate-400 uppercase">{tSafe('subcon.second.party.sign', 'توقيع الطرف الثاني', 'Second Party Signature')}</p>
                  </div>
               </div>
            </div>
         </PrintWrapper>
      </div>
    </div>
  );
}

/**
 * مكون البحث الذكي المستقر (Stable Searchable Picker).
 * تم فصله لمنع إعادة البناء عند الكتابة.
 */
function SearchablePicker({ value, onSelect, items, search, onSearchChange, icon: Icon, placeholder, type, disabled = false, isRtl }: any) {
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className={cn(
          "h-14 w-full rounded-2xl border-2 font-black flex items-center justify-between px-6 shadow-sm transition-all",
          disabled ? "bg-slate-50 border-slate-100 cursor-not-allowed text-slate-300" : "bg-white hover:border-primary/40 text-slate-900"
        )}>
          <div className="flex items-center gap-3">
             <Icon className={cn("h-5 w-5 opacity-40", !disabled && "text-primary")} />
             <span className="truncate text-sm">{value || placeholder}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-20" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[400px] p-0 rounded-2xl shadow-3xl border-2 z-[100]" 
        align="start" 
        onOpenAutoFocus={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
         <div className="p-4 bg-slate-50 border-b">
            <div className="relative">
               <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
               <Input 
                 placeholder="بحث..." 
                 className="h-10 ps-10 rounded-xl border-2 font-bold bg-white"
                 value={search}
                 onChange={e => onSearchChange(e.target.value)}
               />
            </div>
         </div>
         <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
               {items.map((item: any) => {
                 const isTransaction = type === 'transaction';
                 const isClient = type === 'client';
                 const mainTitle = isClient ? item.nameAr : (isTransaction ? item.subServiceName : item.name);
                 const subTitle = isClient ? item.fileNumber : (isTransaction ? item.transactionNumber : null);
                 
                 return (
                   <div 
                     key={item.id} 
                     onClick={(e) => { 
                       e.stopPropagation(); 
                       onSelect(item); 
                       // Popover doesn't need explicit close if we use correct logic
                     }}
                     className={cn(
                       "p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between border-2 border-transparent",
                       (value === mainTitle) ? "bg-primary/5 border-primary/20 text-primary" : "hover:bg-slate-50"
                     )}
                   >
                      <div className="text-start min-w-0 flex-1">
                         <p className="font-black text-xs text-slate-900 truncate">{mainTitle}</p>
                         {subTitle && (
                           <p className="text-[8px] font-mono text-slate-400 mt-1 uppercase" dir="ltr">#{subTitle}</p>
                         )}
                      </div>
                      {(value === mainTitle) && <Check className="h-4 w-4 shrink-0" />}
                   </div>
                 );
               })}
            </div>
         </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function NewSubConContractPage() {
   return <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#fdfaf3]"><Loader2 className="animate-spin text-primary" /></div>}><NewSubConContractContent /></Suspense>;
}

