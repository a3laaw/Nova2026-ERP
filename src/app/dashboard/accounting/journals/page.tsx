
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, Plus, Loader2, Save, 
  Trash2, ArrowRight, Calculator,
  Zap, Search, Check, ChevronDown, X,
  AlertTriangle, CheckCircle2, ArrowDown,
  Sparkles, Hash
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { JournalEntry, Account, JournalEntryLine } from '@/types/accounting';
import { CostCenter, ProfitCenter } from '@/types/cost-profit-centers';
import { AccountingService } from '@/services/accounting-service';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';

/**
 * شاشة قيود اليومية السيادية (Sovereign Journal Entries).
 * - التسجيل الحصري: يسمح بالاختيار فقط من الحسابات الفرعية (Leaf Accounts).
 * - محرك تجميع البيان: يصيغ البيان العام آلياً من تفاصيل السطور بدون تكرار.
 * - الفلترة الموجهة: يربط قائمة المشاريع بهوية الحساب المختار في السطر.
 */
export default function JournalEntriesPage() {
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, dir, isRtl, lang } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [
      { accountId: '', accountName: '', debit: 0, credit: 0, memo: '', projectId: '', costCenterId: '', profitCenterId: '', isAutoLinked: false },
      { accountId: '', accountName: '', debit: 0, credit: 0, memo: '', projectId: '', costCenterId: '', profitCenterId: '', isAutoLinked: false }
    ] as (JournalEntryLine & { isAutoLinked: boolean })[]
  });

  const journalsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.journalEntries(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId))) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId))) : null, 
  [db, companyId]);

  const costCentersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.costCenters(companyId))) : null, 
  [db, companyId]);

  const profitCentersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.profitCenters(companyId))) : null, 
  [db, companyId]);

  const { data: journals, loading: journalsLoading } = useCollection<JournalEntry>(journalsQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const { data: projects } = useCollection<any>(projectsQuery);
  const { data: costCenters } = useCollection<CostCenter>(costCentersQuery);
  const { data: profitCenters } = useCollection<ProfitCenter>(profitCentersQuery);

  /**
   * تطهير القائمة (Postable Accounts Filter):
   * القاعدة السيادية: تظهر فقط الحسابات التي ليس لها أبناء (Leaf Nodes).
   */
  const availableAccounts = useMemo(() => {
    return (accounts || []).filter(a => a.isGroup === false);
  }, [accounts]);

  /**
   * محرك تجميع البيان الذكي (Auto-Narration Aggregator)
   * يراقب سطور القيد، يجمع البيانات الفريدة، ويصيغها في البيان العام تلقائياً.
   */
  useEffect(() => {
    if (isAdding) {
       const uniqueMemos = Array.from(new Set(
          form.lines
            .map(l => l.memo?.trim())
            .filter(m => !!m)
       ));
       
       const aggregatedDescription = uniqueMemos.join(' - ');
       
       if (aggregatedDescription !== form.description) {
          setForm(prev => ({ ...prev, description: aggregatedDescription }));
       }
    }
  }, [form.lines, isAdding]);

  // --- محرك الربط الصامت على مستوى السطر (Row-Level Silent Linker) ---
  const autoLinkLine = (idx: number, projectId: string, accId: string, currentLines: any[]) => {
    const lines = [...currentLines];
    const acc = accounts?.find(a => a.id === accId);
    
    let ccId = '';
    let pcId = '';
    let isAuto = false;

    if (projectId && projectId !== 'NONE') {
       const matchedCC = costCenters?.find(cc => cc.projectId === projectId || cc.id === `cc_${projectId}`);
       const matchedPC = profitCenters?.find(pc => pc.projectId === projectId || pc.id === `pc_${projectId}`);

       if (acc?.type === 'expense' && matchedCC) {
          ccId = matchedCC.id;
          isAuto = true;
       }
       if (acc?.type === 'revenue' && matchedPC) {
          pcId = matchedPC.id;
          isAuto = true;
       }
    }

    lines[idx].costCenterId = ccId;
    lines[idx].profitCenterId = pcId;
    lines[idx].isAutoLinked = isAuto;
    return lines;
  };

  const totals = useMemo(() => {
    return form.lines.reduce((acc, l) => ({
      debit: acc.debit + (Number(l.debit) || 0),
      credit: acc.credit + (Number(l.credit) || 0)
    }), { debit: 0, credit: 0 });
  }, [form.lines]);

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;

  const handleAddLine = () => {
    setForm({ ...form, lines: [...form.lines, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '', projectId: '', costCenterId: '', profitCenterId: '', isAutoLinked: false }] });
  };

  const handleRemoveLine = (idx: number) => {
    if (form.lines.length <= 2) return;
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
  };

  const copyMemoToNext = (idx: number) => {
    if (idx >= form.lines.length - 1) return;
    const newLines = [...form.lines];
    newLines[idx + 1].memo = newLines[idx].memo;
    setForm({ ...form, lines: newLines });
  };

  const updateLine = (idx: number, field: keyof (JournalEntryLine & { isAutoLinked: boolean }), val: any) => {
    let newLines = [...form.lines];
    
    if (field === 'accountId') {
       const acc = accounts?.find(a => a.id === val);
       newLines[idx].accountId = val;
       newLines[idx].accountName = isRtl ? acc?.nameAr || '' : acc?.nameEn || '';
       // تصفير المشروع إذا تغير الحساب لضمان المزامنة
       newLines[idx].projectId = ''; 
       newLines = autoLinkLine(idx, '', val, newLines);
    }
    else if (field === 'projectId') {
       newLines[idx].projectId = val === 'NONE' ? '' : val;
       newLines = autoLinkLine(idx, newLines[idx].projectId, newLines[idx].accountId, newLines);
    }
    else if (field === 'debit') {
       const debitVal = Number(val) || 0;
       newLines[idx].debit = debitVal;
       if (debitVal > 0) newLines[idx].credit = 0; 
    }
    else if (field === 'credit') {
       const creditVal = Number(val) || 0;
       newLines[idx].credit = creditVal;
       if (creditVal > 0) newLines[idx].debit = 0; 
    }
    else {
       (newLines[idx] as any)[field] = val;
    }
    
    setForm({ ...form, lines: newLines });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !isBalanced) return;
    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createJournalEntry(form, user.uid);
      toast({ title: t('common.saved') });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], description: '', lines: [{ accountId: '', accountName: '', debit: 0, credit: 0, memo: '', projectId: '', costCenterId: '', profitCenterId: '', isAutoLinked: false }, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '', projectId: '', costCenterId: '', profitCenterId: '', isAutoLinked: false }] });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start space-y-1">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Calculator className="h-7 w-7 text-primary" /> {t('accounting.journals.title')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{t('accounting.journals.desc')}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-11 px-8 font-black rounded-xl shadow-lg gap-2">
           {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
           {isAdding ? t('common.back') : t('accounting.journals.newEntry')}
        </Button>
      </header>

      {isAdding ? (
        <Card className="rounded-[2.5rem] border-0 shadow-3xl bg-white overflow-hidden animate-in slide-in-from-bottom-4">
           <CardHeader className="bg-slate-50/50 p-8 border-b text-start">
              <CardTitle className="font-black text-slate-800 text-xl">{t('accounting.journals.draftTitle')}</CardTitle>
           </CardHeader>
           <CardContent className="p-8 space-y-8 text-start bg-white">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-12 border-2 rounded-xl font-bold" />
                 </div>
                 <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                      <Sparkles className="h-3 w-3" /> {isRtl ? 'البيان العام للقيد (توليد تلقائي من السطور)' : 'Auto-Aggregated Narration'}
                    </Label>
                    <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="..." className="h-12 border-2 rounded-xl font-bold bg-primary/[0.02] border-primary/10 shadow-inner" />
                 </div>
              </div>

              <div className="border-2 rounded-3xl overflow-hidden shadow-sm">
                 <Table>
                    <TableHeader className="bg-slate-50">
                       <TableRow className="hover:bg-slate-50 border-0">
                          <TableHead className="py-4 ps-6 text-[10px] font-black uppercase w-[240px]">{isRtl ? 'الحساب المالي (فرعي)' : 'Postable Account'}</TableHead>
                          <TableHead className="text-[10px] font-black uppercase w-[200px]">{isRtl ? 'المشروع المرتبط' : 'Linked Project'}</TableHead>
                          <TableHead className="text-[10px] font-black uppercase w-[220px]">{isRtl ? 'بيان السطر' : 'Line Memo'}</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase w-[100px]">{isRtl ? 'مدين' : 'Debit'}</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase w-[100px]">{isRtl ? 'دائن' : 'Credit'}</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {form.lines.map((line, idx) => {
                         const acc = accounts?.find(a => a.id === line.accountId);
                         
                         // فلترة المشاريع بناءً على الحساب المختار
                         const filteredProjects = projects?.filter(p => {
                            if (!acc || !acc.referenceId) return true;
                            // إذا كان الحساب مربوطاً بعميل (مثل ذمم 1202)، اظهر مشاريع هذا العميل فقط
                            if (acc.code.startsWith('1202')) return p.clientId === acc.referenceId;
                            return true;
                         });

                         const requiresCC = acc?.analyticalConfig?.costCenter === 'required';
                         const requiresPC = acc?.analyticalConfig?.profitCenter === 'required';

                         const noneLabel = isRtl 
                            ? (acc?.type === 'expense' ? '--- مصروف إداري عام ---' : '--- بدون مشروع ---')
                            : '--- No Project ---';

                         return (
                           <TableRow key={idx} className="border-b-slate-100 hover:bg-primary/[0.01]">
                              <TableCell className="py-3 ps-6">
                                 <SearchableDropdown
                                   options={(availableAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))}
                                   value={line.accountId}
                                   onChange={v => updateLine(idx, 'accountId', v)}
                                   placeholder={isRtl ? "اختر الحساب الفرعي..." : "Select Account..."}
                                 />
                              </TableCell>
                              <TableCell className="py-3">
                                 <div className="flex flex-col gap-2">
                                    <SearchableDropdown
                                      options={[
                                         { id: 'NONE', name: noneLabel },
                                         ...(filteredProjects || []).map(p => ({ 
                                            id: p.id!, 
                                            name: p.clientName, 
                                            subText: `${p.subServiceName} (#${p.transactionNumber})` 
                                         }))
                                      ]}
                                      value={line.projectId || (line.accountId ? 'NONE' : '')}
                                      onChange={v => updateLine(idx, 'projectId', v)}
                                      placeholder={isRtl ? "المشروع..." : "Project..."}
                                      disabled={!line.accountId}
                                    />
                                    
                                    {line.projectId && line.projectId !== 'NONE' && (requiresCC || requiresPC) && !line.isAutoLinked && (
                                       <div className="animate-in slide-in-from-top-1 space-y-2">
                                          {requiresCC && (
                                             <Select value={line.costCenterId} onValueChange={v => updateLine(idx, 'costCenterId', v)}>
                                                <SelectTrigger className="h-8 rounded-lg border-2 border-rose-100 bg-rose-50 text-[10px] font-black text-rose-600"><SelectValue placeholder={isRtl ? "مركز التكلفة..." : "Cost Center..."} /></SelectTrigger>
                                                <SelectContent className="z-[161]">{costCenters?.filter(cc => cc.isAdministrative || cc.projectId === line.projectId).map(cc => <SelectItem key={cc.id} value={cc.id!} className="text-[10px] font-bold">{cc.name}</SelectItem>)}</SelectContent>
                                             </Select>
                                          )}
                                          {requiresPC && (
                                             <Select value={line.profitCenterId} onValueChange={v => updateLine(idx, 'profitCenterId', v)}>
                                                <SelectTrigger className="h-8 rounded-lg border-2 border-rose-100 bg-rose-50 text-[10px] font-black text-rose-600"><SelectValue placeholder={isRtl ? "مركز الربحية..." : "Profit Center..."} /></SelectTrigger>
                                                <SelectContent className="z-[161]">{profitCenters?.filter(pc => pc.projectId === line.projectId).map(pc => <SelectItem key={pc.id} value={pc.id!} className="text-[10px] font-bold">{pc.name}</SelectItem>)}</SelectContent>
                                             </Select>
                                          )}
                                       </div>
                                    )}

                                    {line.isAutoLinked && (
                                       <div className="flex items-center gap-2 text-emerald-600 animate-in fade-in">
                                          <Zap className="h-3 w-3 fill-current" />
                                          <span className="text-[8px] font-black uppercase tracking-widest">{isRtl ? 'تم الربط آلياً' : 'Auto Linked'}</span>
                                       </div>
                                    )}
                                 </div>
                              </TableCell>
                              <TableCell className="py-3">
                                 <div className="flex items-center gap-1.5">
                                    <Input 
                                      value={line.memo || ''} 
                                      onChange={e => updateLine(idx, 'memo', e.target.value)} 
                                      placeholder={isRtl ? "بيان السطر..." : "Line memo..."}
                                      className="h-9 text-[10px] font-bold border-2 rounded-xl bg-slate-50/20"
                                    />
                                    {idx < form.lines.length - 1 && (
                                       <Button 
                                         variant="ghost" 
                                         size="icon" 
                                         onClick={() => copyMemoToNext(idx)}
                                         className="h-8 w-8 rounded-xl text-slate-300 hover:text-primary hover:bg-primary/5 transition-all shrink-0"
                                         title={isRtl ? "نسخ للسطر التالي" : "Copy to next line"}
                                       >
                                          <ArrowDown className="h-4 w-4" />
                                       </Button>
                                    )}
                                 </div>
                              </TableCell>
                              <TableCell className="p-3">
                                 <Input 
                                   type="number" 
                                   step="0.001" 
                                   value={line.debit === 0 ? '' : line.debit} 
                                   onChange={e => updateLine(idx, 'debit', e.target.value)} 
                                   className="h-10 text-center font-black text-blue-600 border-2 rounded-xl bg-slate-50/30" 
                                 />
                              </TableCell>
                              <TableCell className="p-3">
                                 <Input 
                                   type="number" 
                                   step="0.001" 
                                   value={line.credit === 0 ? '' : line.credit} 
                                   onChange={e => updateLine(idx, 'credit', e.target.value)} 
                                   className="h-10 text-center font-black text-rose-600 border-2 rounded-xl bg-slate-50/30" 
                                 />
                              </TableCell>
                              <TableCell className="pe-4 text-center">
                                 <Button variant="ghost" size="icon" onClick={() => handleRemoveLine(idx)} className="h-9 w-9 text-slate-300 hover:text-rose-500 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                           </TableRow>
                         );
                       })}
                    </TableBody>
                    <tfoot className="bg-slate-50/80 border-t-4 border-slate-100">
                       <tr>
                          <td className="p-6 ps-8" colSpan={3}>
                             <Button variant="outline" size="sm" onClick={handleAddLine} className="font-black text-[10px] h-10 px-8 rounded-xl border-2 bg-white hover:bg-slate-100 gap-2">
                                <Plus className="h-4 w-4" /> {t('common.add')}
                             </Button>
                          </td>
                          <td className="p-6 text-center font-black text-blue-600 text-xl border-x border-white shadow-inner">{totals.debit.toLocaleString()}</td>
                          <td className="p-6 text-center font-black text-rose-600 text-xl shadow-inner">{totals.credit.toLocaleString()}</td>
                          <td className="pe-4"></td>
                       </tr>
                    </tfoot>
                 </Table>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-8 rounded-[2.5rem] border-2 border-white shadow-inner gap-6">
                 <div className="flex items-center gap-6">
                    <div className={cn(
                      "flex items-center gap-3 px-8 py-3 rounded-2xl font-black text-xs shadow-xl transition-all",
                      isBalanced ? "bg-emerald-600 text-white" : "bg-rose-500 text-white animate-pulse"
                    )}>
                       {isBalanced ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                       {isBalanced ? t('accounting.journals.balanced') : t('accounting.journals.unbalanced')}
                    </div>
                 </div>
                 <Button onClick={handleSave} disabled={loading || !isBalanced} className="h-16 rounded-[1.5rem] px-16 bg-primary text-white font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-3 border-b-8 border-orange-700">
                    {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                    {t('accounting.journals.postToLedger')}
                 </Button>
              </div>
           </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b-2">
                       <TableHead className="py-4 ps-8 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{tSafe('inline.entry_date', 'رقم القيد / التاريخ', 'Entry No. / Date')}</TableHead>
                       <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'البيان العام' : 'Narration'}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {journalsLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : journals?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-bold italic text-lg">{t('common.noResults')}</TableCell></TableRow>
                    ) : journals?.map(j => {
                      const total = j.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
                      return (
                        <TableRow key={j.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 group">
                           <TableCell className="py-5 ps-8 text-start font-black text-slate-800">
                              <div className="flex flex-col">
                                 <span className="text-sm">{j.entryNumber}</span>
                                 <span className="text-[9px] text-slate-400 font-mono mt-0.5">{j.date}</span>
                              </div>
                           </TableCell>
                           <TableCell className="text-start font-bold text-slate-600 text-xs truncate max-w-[300px]">{j.description}</TableCell>
                           <TableCell className="text-end font-mono font-black text-slate-900 text-sm">{total.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                           <TableCell className="text-center">
                              <Badge variant="outline" className={cn(
                                "text-[8px] font-black uppercase px-3 h-5 border-0 shadow-sm",
                                j.status === 'posted' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                              )}>{t('status.' + j.status)}</Badge>
                           </TableCell>
                           <TableCell className="pe-8 text-end">
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-primary group-hover:bg-primary/5 transition-all"><FileText className="h-4 w-4" /></Button>
                           </TableCell>
                        </TableRow>
                      );
                    })}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>
      )}
    </div>
  );
}
