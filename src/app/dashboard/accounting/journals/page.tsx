
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, Plus, Loader2, Save, 
  Trash2, ArrowRight, Calculator,
  AlertTriangle
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { JournalEntry, Account, JournalEntryLine } from '@/types/accounting';
import { AccountingService } from '@/services/accounting-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';

export default function JournalEntriesPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [
      { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
      { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }
    ] as JournalEntryLine[]
  });

  const journalsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.journalEntries(companyId)), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId))) : null, 
  [db, companyId]);

  const { data: journals, loading: journalsLoading } = useCollection<JournalEntry>(journalsQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);

  const availableAccounts = useMemo(() => accounts?.filter(a => !a.isGroup), [accounts]);

  const totals = useMemo(() => {
    return form.lines.reduce((acc, l) => ({
      debit: acc.debit + (Number(l.debit) || 0),
      credit: acc.credit + (Number(l.credit) || 0)
    }), { debit: 0, credit: 0 });
  }, [form.lines]);

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;

  const handleAddLine = () => {
    setForm({ ...form, lines: [...form.lines, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }] });
  };

  const handleRemoveLine = (idx: number) => {
    if (form.lines.length <= 2) return;
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
  };

  const updateLine = (idx: number, field: keyof JournalEntryLine, val: any) => {
    const newLines = [...form.lines];
    if (field === 'accountId') {
       const acc = availableAccounts?.find(a => a.id === val);
       newLines[idx].accountName = isRtl ? acc?.nameAr || '' : acc?.nameEn || '';
    }
    (newLines[idx] as any)[field] = val;
    setForm({ ...form, lines: newLines });
  };

  const handleSave = async () => {
    if (!db || !companyId || !user || !isBalanced) return;
    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createJournalEntry(form, user.uid);
      toast({ title: "تم ترحيل القيد بنجاح" });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], description: '', lines: [{ accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> {isRtl ? 'قيود اليومية' : 'Journal Entries'}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">تسجيل الحركات المالية المزدوجة</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-9 px-6 font-bold gap-2">
           {isAdding ? <ArrowRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
           {isAdding ? (isRtl ? 'العودة' : 'Back') : (isRtl ? 'قيد يدوي جديد' : 'New Entry')}
        </Button>
      </header>

      {isAdding ? (
        <Card className="rounded-xl border-0 shadow-2xl bg-white overflow-hidden animate-in slide-in-from-bottom-4">
           <CardHeader className="bg-slate-50 p-6 border-b text-start">
              <CardTitle className="font-black text-slate-800">إعداد قيد يومية متوازن</CardTitle>
           </CardHeader>
           <CardContent className="p-8 space-y-6 text-start">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ القيد</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                 </div>
                 <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">البيان العام</Label>
                    <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="وصف العملية..." />
                 </div>
              </div>

              <div className="border rounded-xl overflow-hidden shadow-sm">
                 <Table>
                    <TableHeader className="bg-slate-50/50">
                       <TableRow>
                          <TableHead className="w-[300px]">الحساب</TableHead>
                          <TableHead className="text-center">مدين</TableHead>
                          <TableHead className="text-center">دائن</TableHead>
                          <TableHead>شرح السطر</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {form.lines.map((line, idx) => (
                         <TableRow key={idx} className="border-b-slate-50">
                            <TableCell className="p-2">
                               <Select value={line.accountId} onValueChange={v => updateLine(idx, 'accountId', v)}>
                                  <SelectTrigger className="h-9 font-bold text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                                  <SelectContent>
                                     {availableAccounts?.map(a => <SelectItem key={a.id} value={a.id} className="font-bold">{a.code} - {a.nameAr}</SelectItem>)}
                                  </SelectContent>
                               </Select>
                            </TableCell>
                            <TableCell className="p-2"><Input type="number" step="0.001" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', Number(e.target.value))} className="h-9 text-center font-black text-blue-600" /></TableCell>
                            <TableCell className="p-2"><Input type="number" step="0.001" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', Number(e.target.value))} className="h-9 text-center font-black text-rose-600" /></TableCell>
                            <TableCell className="p-2"><Input value={line.memo} onChange={e => updateLine(idx, 'memo', e.target.value)} className="h-9 text-xs" /></TableCell>
                            <TableCell className="p-2"><Button variant="ghost" size="icon" onClick={() => handleRemoveLine(idx)} className="h-8 w-8 text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                    <tfoot className="bg-slate-50">
                       <tr>
                          <td className="p-4"><Button variant="outline" size="sm" onClick={handleAddLine} className="font-bold text-[10px] h-8 px-4 rounded-lg border-2"><Plus className="h-3 w-3 me-1" /> إضافة سطر</Button></td>
                          <td className="p-4 text-center font-black text-blue-600 text-lg">{totals.debit.toLocaleString()}</td>
                          <td className="p-4 text-center font-black text-rose-600 text-lg">{totals.credit.toLocaleString()}</td>
                          <td colSpan={2} className="p-4">
                             {isBalanced ? (
                               <Badge className="bg-emerald-500 text-white font-black text-[10px] px-4 py-1">قيد متوازن</Badge>
                             ) : (
                               <Badge variant="destructive" className="font-black text-[10px] px-4 py-1">غير متوازن</Badge>
                             )}
                          </td>
                       </tr>
                    </tfoot>
                 </Table>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                 <Button onClick={handleSave} disabled={loading || !isBalanced} className="h-14 rounded-2xl px-12 bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all gap-2">
                    {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                    ترحيل القيد للأستاذ العام
                 </Button>
              </div>
           </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg shadow-sm border overflow-hidden bg-white">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow>
                       <TableHead className="py-3 ps-6 text-start">رقم القيد / التاريخ</TableHead>
                       <TableHead className="text-start">البيان</TableHead>
                       <TableHead className="text-end">القيمة (مدين/دائن)</TableHead>
                       <TableHead className="text-center">الحالة</TableHead>
                       <TableHead className="pe-6"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {journalsLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : journals?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-bold italic">لا يوجد قيود مسجلة.</TableCell></TableRow>
                    ) : journals?.map(j => {
                      const total = j.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
                      return (
                        <TableRow key={j.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-50">
                           <TableCell className="py-3 ps-6 text-start font-black text-slate-800">
                              <div className="flex flex-col">
                                 <span>{j.entryNumber}</span>
                                 <span className="text-[9px] text-slate-400 font-mono">{j.date}</span>
                              </div>
                           </TableCell>
                           <TableCell className="text-start font-bold text-slate-600 text-xs truncate max-w-[200px]">{j.description}</TableCell>
                           <TableCell className="text-end font-mono font-black text-primary">{total.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                           <TableCell className="text-center">
                              <Badge variant="outline" className="text-[8px] font-black uppercase px-2">{j.status}</Badge>
                           </TableCell>
                           <TableCell className="pe-6 text-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-300 hover:text-primary"><FileText className="h-4 w-4" /></Button>
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
