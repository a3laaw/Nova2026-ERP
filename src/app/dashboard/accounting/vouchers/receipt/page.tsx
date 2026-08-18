'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Receipt, Plus, Loader2, Save, 
  ArrowRight, Landmark, Wallet,
  CheckCircle2, Sparkles, LayoutGrid, DatabaseZap, Gavel,
  History, Workflow
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs } from 'firebase/firestore';
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
import { Transaction } from '@/types/transaction';
import { Contract } from '@/types/documents';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';

export default function ReceiptVouchersPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // تحديث حالة النموذج لتشمل الحقول المفقودة لمنع أخطاء النوع والـ Build
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    feeAmount: 0,
    netAmount: 0,
    personName: '',
    paymentMethod: '',
    accountId: '',
    cashAccountId: '',
    clientId: '',
    transactionId: '',
    transactionName: '',
    transactionNumber: '', 
    contractId: '',
    notes: '',
    costCenterId: '',
    profitCenterId: ''
  });

  const vouchersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.vouchers(companyId)), where('type', '==', 'receipt'), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId))) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, 
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
  const { data: clients } = useCollection<any>(clientsQuery);
  const { data: allTransactions } = useCollection<Transaction>(projectsQuery);
  const { data: costCenters } = useCollection<CostCenter>(costCentersQuery);
  const { data: profitCenters } = useCollection<ProfitCenter>(profitCentersQuery);
  const { data: paymentMethods } = useCollection<any>(pmQuery);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const cashAccounts = useMemo(() => {
    if (!accounts || !form.paymentMethod) return [];
    return accounts.filter(a => !a.isGroup && a.allowedPaymentMethods?.includes(form.paymentMethod));
  }, [accounts, form.paymentMethod]);
  
  const incomeAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.type === 'revenue' || a.type === 'liability' || a.code.startsWith('1202'))), [accounts]);

  useEffect(() => {
    if (form.transactionId) {
       const matchedCC = costCenters?.find(cc => cc.projectId === form.transactionId || cc.id === `cc_${form.transactionId}`);
       const matchedPC = profitCenters?.find(pc => pc.projectId === form.transactionId || pc.id === `pc_${form.transactionId}`);
       
       setForm(prev => ({
          ...prev,
          costCenterId: matchedCC?.id || '',
          profitCenterId: matchedPC?.id || ''
       }));
    } else {
       setForm(prev => ({ ...prev, costCenterId: '', profitCenterId: '' }));
    }
  }, [form.transactionId, costCenters, profitCenters]);

  useEffect(() => {
    if (db && companyId && form.transactionId) {
      const q = query(collection(db, paths.contracts(companyId)), where('transactionId', '==', form.transactionId), where('status', 'in', ['approved', 'active', 'paid', 'signed', 'clientCertified']));
      getDocs(q).then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
        setContracts(list);
        if (list.length === 1) setForm(prev => ({ ...prev, contractId: list[0].id }));
      });
    } else setContracts([]);
  }, [db, companyId, form.transactionId]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!form.accountId || !form.cashAccountId || form.amount <= 0) {
      toast({ variant: "destructive", title: t('common.error') });
      return;
    }
    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      const voucherId = await service.createVoucher({ ...form, type: 'receipt', projectId: form.transactionId }, user.uid);
      toast({ title: t('common.saved') });
      setIsAdding(false);
      router.push(`/dashboard/accounting/vouchers/receipt/${voucherId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-[1600px] mx-auto" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start space-y-1">
          <h1 className="text-2xl font-black font-headline text-slate-900">
            <Receipt className="h-7 w-7 text-emerald-600" /> {tSafe('accounting.vouchers.receiptTitle', 'سندات القبض الذكية', 'Smart Receipt Vouchers')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{isRtl ? 'تحصيل الإيرادات المربوطة آلياً بالأبعاد المالية' : 'Auto-linked revenue collection and financial routing'}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-10 px-8 font-black rounded-xl shadow-lg gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-b-4 border-emerald-800 transition-all">
          {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
          {isAdding ? t('common.back') : tSafe('inline.issue.receipt', 'إصدار سند قبض', 'Issue Receipt')}
        </Button>
      </header>

      {isAdding ? (
        <Card className="rounded-[2.5rem] border-0 shadow-3xl bg-white overflow-hidden ring-1 ring-black/5">
           <CardHeader className="bg-emerald-50/50 p-8 border-b text-start">
              <CardTitle className="text-emerald-900 font-black text-lg flex items-center gap-3">
                 <Sparkles className="h-5 w-5" /> {tSafe('inline.issue.smart.receipt', 'إصدار سند قبض ذكي', 'Issue Smart Receipt')}
              </CardTitle>
           </CardHeader>
           <CardContent className="p-10 space-y-8 text-start bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المقبوض من (العميل)' : 'Received From'}</Label><SearchableDropdown options={(clients || []).map(c => ({ id: c.id, name: c.nameAr, subText: c.fileNumber }))} value={form.clientId} onChange={(val) => { const c = clients?.find(x => x.id === val); setForm({ ...form, clientId: val as string, personName: c?.nameAr || '', transactionId: '', transactionName: '', transactionNumber: '', contractId: '', notes: '' }); }} placeholder={t('common.search')} /></div>
                 <div className="space-y-2 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المشروع المرتبط (الأتمتة)' : 'Project Link (Auto)'}</Label><SearchableDropdown disabled={!form.clientId} options={(allTransactions || []).filter(t => t.clientId === form.clientId).map(t => ({ id: t.id, name: t.subServiceName, subText: `#${t.transactionNumber}` }))} value={form.transactionId} onChange={(val) => { const t_row = allTransactions?.find(x => x.id === val); setForm({ ...form, transactionId: val as string, transactionName: t_row?.subServiceName || '', transactionNumber: t_row?.transactionNumber || '', contractId: '', notes: '' }); }} placeholder={t('common.search')} /></div>
              </div>

              {form.transactionId && (
                <div className="p-6 bg-emerald-50/30 rounded-[1.5rem] border-2 border-dashed border-emerald-200 flex items-center justify-between animate-in zoom-in-95">
                   <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><Sparkles className="h-5 w-5" /></div>
                      <div className="text-start">
                         <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{isRtl ? 'محرك الربط المزدوج مفعل' : 'Dual Dimension Routing Enabled'}</p>
                         <div className="flex gap-4 mt-1">
                            {form.profitCenterId && <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-black h-5 px-3 uppercase"><DatabaseZap className="h-2.5 w-2.5 me-1" /> {isRtl ? 'مركز ربحية مربوط' : 'PC LINKED'}</Badge>}
                            {form.costCenterId && <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black h-5 px-3 uppercase"><LayoutGrid className="h-2.5 w-2.5 me-1" /> {isRtl ? 'مركز تكلفة مربوط' : 'CC LINKED'}</Badge>}
                         </div>
                      </div>
                   </div>
                   <p className="text-[9px] font-bold text-slate-400 italic max-w-[200px] text-end">يتم توجيه السند آلياً للأبعاد المالية للمشروع لضمان دقة التقارير.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-6 border-t">
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{t('common.amount')}</Label><Input type="number" step="0.001" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="h-12 rounded-xl border-2 border-emerald-100 bg-emerald-50/20 text-center font-black text-xl text-emerald-600" /></div>
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{t('paymentMethods')}</Label><Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v, cashAccountId: ''})}><SelectTrigger className="h-12 rounded-xl border-2 font-black"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-0 shadow-3xl">{paymentMethods?.map((pm: any) => <SelectItem key={pm.code} value={pm.code} className="font-bold py-3 text-xs">{isRtl ? pm.name : (pm.nameEn || pm.name)}</SelectItem>)}</SelectContent></Select></div>
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.deposit.to', 'إيداع في حساب', 'Deposit To')}</Label><SearchableDropdown disabled={!form.paymentMethod} options={(cashAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))} value={form.cashAccountId} onChange={v => setForm({...form, cashAccountId: v as string})} /></div>
                 <div className="space-y-1.5 text-start"><Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الصافي' : 'Net'}</Label><div className="h-12 rounded-xl border-2 flex items-center justify-center bg-slate-50 font-black text-lg">{(form.amount).toLocaleString()}</div></div>
              </div>

              <div className="pt-8 border-t space-y-8">
                 <div className="space-y-1.5 text-start">
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest">{tSafe('inline.against.income', 'مقابل حساب (إيرادات)', 'Against Account')}</Label>
                    <SearchableDropdown options={(incomeAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))} value={form.accountId} onChange={v => setForm({...form, accountId: v as string})} />
                 </div>

                 <div className="space-y-1.5 text-start pt-6 border-t">
                    <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.generated.notes', 'البيان', 'Statement')}</Label>
                    <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="min-h-[100px] rounded-xl border-2" />
                 </div>
              </div>

              <div className="flex justify-end gap-4 pt-8">
                 <Button variant="outline" onClick={() => setIsAdding(false)} className="h-12 rounded-xl px-12 font-black border-2">{t('common.cancel')}</Button>
                 <Button onClick={handleSave} disabled={loading} className="h-12 rounded-xl px-20 bg-emerald-600 text-white font-black text-sm shadow-xl border-b-4 border-emerald-800">
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5 me-2" />} {tSafe('inline.confirm_issue_btn', 'تأكيد وإصدار السند', 'Confirm & Issue')}
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
                       <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{isRtl ? 'من العميل المالك' : 'From Client'}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('inline.payment', 'الدفع', 'Payment')}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : (vouchers || []).map((v:any) => (
                      <TableRow key={v.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-100 group cursor-pointer" onClick={() => router.push(`/dashboard/accounting/vouchers/receipt/${v.id}`)}>
                         <TableCell className="py-5 ps-8 text-start">
                            <p className="font-black text-slate-800 text-sm">{v.voucherNumber}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{v.date}</p>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600 text-sm">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-emerald-600 text-base">{(v.amount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black uppercase px-4 h-6 border-2 bg-white">{v.paymentMethod}</Badge></TableCell>
                         <TableCell className="pe-8 text-end"><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300"><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button></TableCell>
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
