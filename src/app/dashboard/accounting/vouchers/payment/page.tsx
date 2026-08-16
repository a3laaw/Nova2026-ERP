'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wallet, Plus, Loader2, Save, 
  ArrowRight, Landmark, User, LayoutGrid,
  Zap, DatabaseZap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Voucher, Account } from '@/types/accounting';
import { CostCenter, ProfitCenter } from '@/types/cost-profit-centers';
import { AccountingService } from '@/services/accounting-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';

export default function PaymentVouchersPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    personName: '',
    paymentMethod: '',
    accountId: '',
    cashAccountId: '',
    projectId: '',
    costCenterId: '',
    profitCenterId: '',
    notes: ''
  });

  const vouchersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.vouchers(companyId)), where('type', '==', 'payment'), orderBy('createdAt', 'desc')) : null, 
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

  const pmQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.paymentMethods(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: vouchers, loading: vouchersLoading } = useCollection<Voucher>(vouchersQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const { data: projects } = useCollection<any>(projectsQuery);
  const { data: costCenters } = useCollection<CostCenter>(costCentersQuery);
  const { data: profitCenters } = useCollection<ProfitCenter>(profitCentersQuery);
  const { data: paymentMethods } = useCollection<any>(pmQuery);

  const cashAccounts = useMemo(() => {
    if (!accounts || !form.paymentMethod) return [];
    return accounts.filter(a => !a.isGroup && a.allowedPaymentMethods?.includes(form.paymentMethod));
  }, [accounts, form.paymentMethod]);

  const expenseAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.type === 'expense' || a.type === 'liability')), [accounts]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!form.accountId || !form.cashAccountId || form.amount <= 0) {
      toast({ variant: "destructive", title: t('common.error') });
      return;
    }
    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createVoucher({ ...form, type: 'payment' }, user.uid);
      toast({ title: t('common.saved') });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], amount: 0, personName: '', paymentMethod: '', accountId: '', cashAccountId: '', projectId: '', costCenterId: '', profitCenterId: '', notes: '' });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-[1600px] mx-auto" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start space-y-1">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Wallet className="h-7 w-7 text-rose-600" /> {t('paymentVouchers')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{isRtl ? 'إصدار سندات الصرف وربط الأبعاد المالية' : 'Issue payments and link financial dimensions'}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-10 px-8 font-black rounded-xl shadow-lg gap-2 bg-rose-600 hover:bg-rose-700 text-white border-b-4 border-rose-800 transition-all">
           {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
           {isAdding ? t('common.back') : tSafe('inline.issue.payment', 'إصدار سند صرف', 'Issue Payment')}
        </Button>
      </header>

      {isAdding ? (
        <Card className="rounded-[2.5rem] border-0 shadow-3xl bg-white overflow-hidden ring-1 ring-black/5">
           <CardHeader className="bg-rose-50/50 p-8 border-b text-start">
              <CardTitle className="text-rose-900 font-black text-lg flex items-center gap-3">
                 <Plus className="h-4 w-4" /> {tSafe('inline.issue.payment', 'إصدار سند صرف معتمد', 'Issue Official Payment')}
              </CardTitle>
           </CardHeader>
           <CardContent className="p-10 space-y-8 text-start bg-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{t('common.date')}</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-10 rounded-xl border-2" /></div>
                 <div className="md:col-span-2 space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'يصرف للسيد / الجهة' : 'Paid To'}</Label><div className="relative"><User className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" /><Input value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} className="h-10 rounded-xl ps-11 font-black text-sm" /></div></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t">
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{t('common.amount')}</Label><Input type="number" step="0.001" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="h-12 rounded-xl border-2 border-rose-100 text-center font-black text-xl text-rose-600" /></div>
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{t('paymentMethods')}</Label><Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v, cashAccountId: ''})}><SelectTrigger className="h-12 rounded-xl border-2 font-black"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl">{paymentMethods?.map((pm: any) => <SelectItem key={pm.code} value={pm.code} className="font-bold py-3 text-xs">{isRtl ? pm.name : (pm.nameEn || pm.name)}</SelectItem>)}</SelectContent></Select></div>
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'من حساب الخزينة' : 'Pay From'}</Label><SearchableDropdown disabled={!form.paymentMethod} options={(cashAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))} value={form.cashAccountId} onChange={v => setForm({...form, cashAccountId: v as string})} /></div>
              </div>

              <div className="pt-8 border-t space-y-8">
                 <div className="space-y-1.5 text-start">
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest">{isRtl ? 'تحميل المصروف على حساب' : 'Charge To Account'}</Label>
                    <SearchableDropdown options={(expenseAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))} value={form.accountId} onChange={v => setForm({...form, accountId: v as string})} />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المشروع' : 'Project'}</Label><SearchableDropdown options={[{ id: 'NONE', name: isRtl ? '--- بدون مشروع ---' : '--- No Project ---' }, ...(projects || []).map(p => ({ id: p.id!, name: p.clientName, subText: p.subServiceName }))]} value={form.projectId || 'NONE'} onChange={v => setForm({...form, projectId: v === 'NONE' ? '' : v as string})} /></div>
                    <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'مركز التكلفة' : 'Cost Center'}</Label><SearchableDropdown options={[{ id: '', name: '---' }, ...(costCenters || []).map(cc => ({ id: cc.id, name: cc.name, subText: cc.code }))]} value={form.costCenterId} onChange={v => setForm({...form, costCenterId: v as string})} /></div>
                    <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1.5"><DatabaseZap className="h-4 w-4" /> {isRtl ? 'مركز الربحية' : 'Profit Center'}</Label><SearchableDropdown options={[{ id: '', name: '---' }, ...(profitCenters || []).map(pc => ({ id: pc.id, name: pc.name, subText: pc.code }))]} value={form.profitCenterId} onChange={v => setForm({...form, profitCenterId: v as string})} /></div>
                 </div>

                 <div className="space-y-1.5 text-start pt-6 border-t">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.notes')}</Label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full min-h-[100px] rounded-xl border-2 p-4 text-xs font-bold bg-slate-50/30" placeholder="..." />
                 </div>
              </div>

              <div className="flex justify-end gap-4 pt-8">
                 <Button variant="outline" onClick={() => setIsAdding(false)} className="h-12 rounded-xl px-10 font-black border-2">{t('common.cancel')}</Button>
                 <Button onClick={handleSave} disabled={loading} className="h-12 rounded-xl px-16 bg-rose-600 text-white font-black shadow-xl border-b-4 border-rose-800">
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5 me-2" />} {tSafe('inline.confirm.issue', 'تأكيد وإصدار السند', 'Confirm & Issue')}
                 </Button>
              </div>
           </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[1.5rem] shadow-sm border overflow-hidden bg-white text-start">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/50 border-b-2">
                    <TableRow>
                       <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase tracking-widest">{isRtl ? 'رقم السند / التاريخ' : 'Voucher# / Date'}</TableHead>
                       <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{isRtl ? 'يصرف للسيد' : 'Paid To'}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{isRtl ? 'طريقة الدفع' : 'Mode'}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : (vouchers || []).map(v => (
                      <TableRow key={v.id} className="hover:bg-primary/[0.01] border-b-slate-50">
                         <TableCell className="py-5 ps-8 text-start font-black text-slate-800">
                            <div className="flex flex-col">
                               <span className="text-sm">{v.voucherNumber}</span>
                               <span className="text-[9px] text-slate-400 font-mono mt-0.5">{v.date}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600 text-sm">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-rose-600 text-base">{v.amount.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black uppercase px-3 h-5 border-2 bg-white">{v.paymentMethod}</Badge></TableCell>
                         <TableCell className="pe-8 text-end"><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300"><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button></TableCell>
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
