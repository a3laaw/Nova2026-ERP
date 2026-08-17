
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Loader2, Save, 
  Trash2, ArrowRight, Calculator,
  Zap, Search,
  Sparkles, Hash, LayoutGrid,
  CheckCircle2, AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { usePermissions } from '@/hooks/use-permissions';
import { paths } from '@/firebase/multi-tenant';
import { JournalEntry, Account, JournalEntryLine } from '@/types/accounting';
import { CostCenter, ProfitCenter } from '@/types/cost-profit-centers';
import { AccountingService } from '@/services/accounting-service';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';

export default function JournalEntriesPage() {
  const { globalUser, user } = useAuthContext();
  const { t, tSafe, dir, isRtl } = useLanguage();
  const { isAdmin } = usePermissions();
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

  const availableAccounts = useMemo(() => (accounts || []).filter(a => !a.isGroup), [accounts]);

  const totals = useMemo(() => {
    return form.lines.reduce((acc, l) => ({
      debit: acc.debit + (Number(l.debit) || 0),
      credit: acc.credit + (Number(l.credit) || 0)
    }), { debit: 0, credit: 0 });
  }, [form.lines]);

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;

  const updateLine = (idx: number, field: keyof (JournalEntryLine & { isAutoLinked: boolean }), val: any) => {
    const newLines = [...form.lines];
    if (field === 'accountId') {
       const acc = accounts?.find(a => a.id === val);
       newLines[idx].accountId = val;
       newLines[idx].accountName = isRtl ? acc?.nameAr || '' : acc?.nameEn || '';
    } else { (newLines[idx] as any)[field] = val; }
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
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-[1600px] mx-auto" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start space-y-1">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Calculator className="h-7 w-7 text-primary" /> {t('accounting.journals.title')}
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{t('accounting.journals.desc')}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-10 px-8 font-black rounded-xl shadow-lg gap-2">
           {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
           {isAdding ? t('common.back') : t('accounting.journals.newEntry')}
        </Button>
      </header>

      {isAdding ? (
        <Card className="rounded-[2rem] border-0 shadow-3xl bg-white overflow-hidden animate-in slide-in-from-bottom-4">
           <CardHeader className="bg-slate-50/50 p-8 border-b text-start">
              <CardTitle className="font-black text-slate-800 text-xl">{t('accounting.journals.draftTitle')}</CardTitle>
           </CardHeader>
           <CardContent className="p-6 space-y-8 text-start bg-white">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">{t('common.date')}</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-10 border-2 rounded-xl" /></div>
                 <div className="md:col-span-3 space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Sparkles className="h-3 w-3" /> {isRtl ? 'البيان العام' : 'Auto Narration'}</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-10 border-2 rounded-xl font-bold bg-primary/[0.01]" /></div>
              </div>

              <div className="border-2 rounded-[1.5rem] overflow-hidden">
                 <Table>
                    <TableHeader className="bg-slate-50">
                       <TableRow className="border-0">
                          <TableHead className="py-4 ps-6 text-[10px] font-black uppercase w-[280px]">{isRtl ? 'الحساب' : 'Account'}</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase w-[100px]">{isRtl ? 'مدين' : 'Debit'}</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase w-[100px]">{isRtl ? 'دائن' : 'Credit'}</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {form.lines.map((line, idx) => (
                         <TableRow key={idx} className="border-b-slate-100 hover:bg-primary/[0.01]">
                            <TableCell className="p-2 ps-6">
                               <SearchableDropdown options={availableAccounts.map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))} value={line.accountId} onChange={v => updateLine(idx, 'accountId', v as string)} />
                            </TableCell>
                            <TableCell className="p-2"><Input type="number" step="0.001" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', Number(e.target.value))} className="h-10 text-center font-black text-blue-600 border-2" /></TableCell>
                            <TableCell className="p-2"><Input type="number" step="0.001" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', Number(e.target.value))} className="h-10 text-center font-black text-rose-600 border-2" /></TableCell>
                            <TableCell className="pe-4 text-center"><Button variant="ghost" size="icon" onClick={() => setForm({...form, lines: form.lines.filter((_, i) => i !== idx)})} className="h-8 w-8 text-slate-300 hover:text-rose-50"><Trash2 className="h-4 w-4" /></Button></TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                    <tfoot className="bg-slate-50/50 border-t-2">
                       <tr className="font-black text-lg">
                          <td className="p-4 ps-6"><Button variant="outline" size="sm" onClick={() => setForm({...form, lines: [...form.lines, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '', projectId: '', costCenterId: '', profitCenterId: '', isAutoLinked: false }]})} className="h-9 px-6 rounded-xl border-2">+ {t('common.add')}</Button></td>
                          <td className="p-4 text-center text-blue-600">{totals.debit.toLocaleString()}</td>
                          <td className="p-4 text-center text-rose-600">{totals.credit.toLocaleString()}</td>
                          <td></td>
                       </tr>
                    </tfoot>
                 </Table>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-6 rounded-2xl border-2 border-white shadow-inner">
                 <div className={cn("px-6 py-2 rounded-full font-black text-xs flex items-center gap-2", isBalanced ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-600")}>
                    {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {isBalanced ? t('accounting.journals.balanced') : t('accounting.journals.unbalanced')}
                 </div>
                 <Button onClick={handleSave} disabled={loading || !isBalanced} className="h-12 px-12 font-black rounded-xl shadow-xl border-b-4 border-orange-700">
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} {t('accounting.journals.postToLedger')}
                 </Button>
              </div>
           </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl shadow-sm border overflow-hidden bg-white text-start">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b-2">
                       <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{tSafe('inline.entry_date', 'رقم القيد / التاريخ', 'JV# / Date')}</TableHead>
                       <TableHead className="text-start text-[10px] font-black uppercase text-slate-500 tracking-widest">{isRtl ? 'البيان العام' : 'Narration'}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('common.status')}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {journalsLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : (journals || []).map(j => (
                      <TableRow key={j.id} className="hover:bg-slate-50/50 border-b-slate-100">
                         <TableCell className="py-5 ps-8 text-start">
                            <p className="font-black text-sm text-slate-800">{j.entryNumber}</p>
                            <p className="text-[10px] font-mono text-slate-400">{j.date}</p>
                         </TableCell>
                         <TableCell className="text-start text-xs font-bold text-slate-600 truncate max-w-md">{j.description}</TableCell>
                         <TableCell className="text-end font-mono font-black text-slate-900">{j.lines?.reduce((s,l)=>s+(l.debit||0),0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center"><Badge variant="outline" className={cn("text-[8px] uppercase", j.status === 'posted' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400")}>{j.status}</Badge></TableCell>
                         <TableCell className="pe-8 text-end"><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300"><Search className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>
      )}
    </div>
  );
}
