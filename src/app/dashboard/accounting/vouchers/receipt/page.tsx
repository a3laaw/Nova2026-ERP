'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Receipt, Plus, Loader2, Save, 
  ArrowRight, Landmark, Wallet,
  User, Calendar, FileText, Briefcase,
  CheckCircle2, Sparkles, LayoutGrid, DatabaseZap, Gavel, Info,
  History, Percent, Calculator, ChevronDown, Search, Check,
  Workflow, Hash, UserCircle, AlertTriangle, Zap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Voucher, Account } from '@/types/accounting';
import { AccountingService } from '@/services/accounting-service';
import { PaymentMilestoneService, MilestonePaymentStatus } from '@/services/payment-milestone-service';
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

/**
 * شاشة سندات القبض السيادية (Receipt Vouchers).
 * تم تفعيل "الوضع الصامت" لإخفاء مراكز الربحية عند وجود ربط تلقائي.
 * تم استخدام SearchableDropdown لكافة الاختيارات.
 */
export default function ReceiptVouchersPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe, lang } = useLanguage();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesStatus, setMilestonesStatus] = useState<MilestonePaymentStatus[]>([]);
  const [autoLinkedPC, setAutoLinkedPC] = useState(false);

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
    contractId: '',
    notes: '',
    appliedMilestoneName: '',
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

  const pmQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.paymentMethods(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const pcQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.profitCenters(companyId))) : null, 
  [db, companyId]);

  const { data: vouchers, loading: vouchersLoading } = useCollection<Voucher>(vouchersQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const { data: clients } = useCollection<any>(clientsQuery);
  const { data: allTransactions } = useCollection<Transaction>(projectsQuery);
  const { data: paymentMethods } = useCollection<any>(pmQuery);
  const { data: profitCenters } = useCollection<any>(pcQuery);

  const selectedAccount = useMemo(() => accounts?.find(a => a.id === form.accountId), [accounts, form.accountId]);

  // --- محرك الربط التلقائي لمركز الربحية الصامت (Silent PC Auto-Linking) ---
  useEffect(() => {
     if (form.transactionId && profitCenters && selectedAccount?.type === 'revenue') {
        const matchedPC = profitCenters.find(pc => pc.projectId === form.transactionId || pc.id === `pc_${form.transactionId}`);
        if (matchedPC) {
           setForm(prev => ({ ...prev, profitCenterId: matchedPC.id }));
           setAutoLinkedPC(true);
        } else {
           setAutoLinkedPC(false);
           setForm(prev => ({ ...prev, profitCenterId: '' }));
        }
     } else {
        setAutoLinkedPC(false);
     }
  }, [form.transactionId, profitCenters, selectedAccount]);

  const showProfitCenterPicker = useMemo(() => {
     if (!selectedAccount || selectedAccount.analyticalConfig?.profitCenter === 'not_allowed') return false;
     if (form.transactionId && autoLinkedPC && form.profitCenterId) return false;
     return true;
  }, [selectedAccount, autoLinkedPC, form.profitCenterId, form.transactionId]);

  const [contracts, setContracts] = useState<Contract[]>([]);

  const cashAccounts = useMemo(() => {
    if (!accounts || !form.paymentMethod) return [];
    return accounts.filter(a => !a.isGroup && a.allowedPaymentMethods?.includes(form.paymentMethod));
  }, [accounts, form.paymentMethod]);
  
  const incomeAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.type === 'revenue' || a.type === 'liability' || a.code.startsWith('1202'))), [accounts]);

  useEffect(() => {
     if (form.paymentMethod && form.amount > 0 && paymentMethods) {
        const pm = paymentMethods.find((p: any) => p.code === form.paymentMethod);
        if (pm) {
           const feePerc = pm.feePercentage || 0;
           const feeFixed = pm.feeFixedAmount || 0;
           const calculatedFee = (form.amount * feePerc) + feeFixed;
           const net = form.amount - calculatedFee;
           setForm(prev => ({ ...prev, feeAmount: Math.round(calculatedFee * 1000) / 1000, netAmount: Math.round(net * 1000) / 1000 }));
        }
     } else {
        setForm(prev => ({ ...prev, feeAmount: 0, netAmount: prev.amount }));
     }
  }, [form.paymentMethod, form.amount, paymentMethods]);

  useEffect(() => {
    if (db && companyId && form.transactionId) {
      const q = query(
        collection(db, paths.contracts(companyId)), 
        where('transactionId', '==', form.transactionId),
        where('status', 'in', ['approved', 'active', 'paid', 'signed'])
      );
      getDocs(q).then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
        setContracts(list);
        if (list.length === 1) setForm(prev => ({ ...prev, contractId: list[0].id }));
        else setForm(prev => ({ ...prev, contractId: '' }));
      });
    } else setContracts([]);
  }, [db, companyId, form.transactionId]);

  useEffect(() => {
    if (db && companyId && form.contractId && form.amount > 0) {
      const service = new PaymentMilestoneService(db, companyId);
      setMilestonesLoading(true);
      service.getMilestonesStatus(form.contractId).then(status => {
        setMilestonesStatus(status);
        const { description, breakdown } = service.generateReceiptDescription(status, form.amount);
        const appliedNames = breakdown.map(b => b.milestoneName).join(', ');
        setForm(prev => ({ ...prev, notes: description, appliedMilestoneName: appliedNames }));
        setMilestonesLoading(false);
      });
    }
  }, [db, companyId, form.contractId, form.amount]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!form.accountId || !form.cashAccountId || form.amount <= 0 || !form.paymentMethod) {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start space-y-1">
          <h1 className="text-2xl font-black font-headline flex items-center gap-3 text-slate-900">
            <Receipt className="h-7 w-7 text-emerald-600" /> {tSafe('accounting.vouchers.receiptTitle', 'سندات القبض الذكية', 'Smart Receipt Vouchers')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{tSafe('inline.receipt.desc', 'إدارة التحصيل المالي وربطها بالعقود والدفعات آلياً', 'Manage revenue collection and link to contracts automatically')}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-11 px-8 font-black rounded-xl shadow-lg gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-b-4 border-emerald-800 transition-all">
          {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
          {isAdding ? t('common.back') : tSafe('inline.issue.receipt', 'إصدار سند قبض', 'Issue Receipt')}
        </Button>
      </header>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4">
           <Card className="lg:col-span-8 rounded-[2.5rem] border-0 shadow-3xl bg-white overflow-hidden text-start ring-1 ring-black/5">
              <CardHeader className="bg-emerald-50/50 p-8 border-b text-start">
                 <CardTitle className="text-emerald-900 font-black text-xl flex items-center gap-3">
                    <Sparkles className="h-5 w-5" /> {tSafe('inline.issue.smart.receipt', 'إصدار سند قبض ذكي', 'Issue Smart Receipt')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-8 text-start bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.received.from', 'المقبوض من السيد (العميل)', 'Received From')}</Label>
                       <SearchableDropdown
                         options={(clients || []).map(c => ({ id: c.id, name: c.nameAr, subText: c.fileNumber }))}
                         value={form.clientId}
                         onChange={(val) => {
                            const c = clients?.find(x => x.id === val);
                            setForm({ ...form, clientId: val as string, personName: c?.nameAr || '', transactionId: '', transactionName: '', contractId: '', notes: '' });
                         }}
                         placeholder={tSafe('common.search', 'بحث عن عميل...', 'Search Client...')}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.related.transaction', 'المعاملة الفنية المرتبطة', 'Related Project')}</Label>
                       <SearchableDropdown
                         disabled={!form.clientId}
                         options={(allTransactions || []).filter(t => t.clientId === form.clientId).map(t => ({ id: t.id, name: t.subServiceName, subText: `#${t.transactionNumber}` }))}
                         value={form.transactionId}
                         onChange={(val) => {
                            const t_row = allTransactions?.find(x => x.id === val);
                            setForm({ ...form, transactionId: val as string, transactionName: t_row?.subServiceName || '', transactionNumber: t_row?.transactionNumber || '', contractId: '', notes: '' });
                         }}
                         placeholder={tSafe('common.search', 'بحث في المشاريع...', 'Search Project...')}
                       />
                    </div>
                 </div>

                 {form.transactionId && (
                   <div className="space-y-2 animate-in slide-in-from-top-2 text-start">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><Gavel className="h-3 w-3" /> {tSafe('inline.linked.contract', 'العقد المعتمد (الارتباط المالي)', 'Linked Contract')}</Label>
                      {contracts.length === 0 ? (
                        <div className="p-5 bg-rose-50 border-2 border-rose-100 rounded-2xl text-rose-600 font-bold text-xs shadow-inner">{tSafe('inline.no.approved.contract', 'تنبيه: لا يوجد عقد معتمد لهذه المعاملة لبدء التحصيل.', 'No approved contract found.')}</div>
                      ) : (
                        <SearchableDropdown
                           options={contracts.map(c => ({ id: c.id, name: c.name, subText: `${c.totalAmount.toLocaleString()} KWD` }))}
                           value={form.contractId}
                           onChange={v => setForm({ ...form, contractId: v as string })}
                           placeholder={tSafe('inline.select.contract', 'اختر العقد...', 'Select Contract...')}
                        />
                      )}
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-6 border-t border-slate-50">
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.amount')}</Label>
                       <div className="relative">
                          <Input type="number" step="0.001" value={form.amount === 0 ? "" : form.amount} onChange={e => setForm({...form, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="h-16 rounded-2xl border-2 border-emerald-100 bg-emerald-50/20 text-center font-black text-3xl text-emerald-600" />
                          {milestonesLoading && <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                       </div>
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('paymentMethods')}</Label>
                       <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v, cashAccountId: ''})}>
                          <SelectTrigger className="h-16 rounded-2xl border-2 font-black"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-0 shadow-3xl z-[160]">
                             {paymentMethods?.map((pm: any) => (
                               <SelectItem key={pm.code} value={pm.code} className="font-bold py-3 text-xs border-b last:border-0 border-slate-50">{tSafe('data.pm.name', pm.name, pm.nameEn || pm.name)}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.deposit.to', 'إيداع في حساب', 'Deposit To')}</Label>
                       <SearchableDropdown
                         disabled={!form.paymentMethod}
                         options={(cashAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))}
                         value={form.cashAccountId}
                         onChange={v => setForm({...form, cashAccountId: v as string})}
                         placeholder="..."
                       />
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.net.deposit', 'صافي الإيداع البنكي', 'Net Deposit')}</Label>
                       <div className="h-16 rounded-2xl border-2 border-dashed flex items-center justify-center bg-slate-50 shadow-inner">
                          <p className="font-black text-2xl text-slate-900">{(form.netAmount || 0).toLocaleString()} <span className="text-[10px] text-slate-400 uppercase tracking-tighter">KWD</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6 pt-8 border-t border-slate-50 text-start">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{tSafe('inline.against.income', 'مقابل حساب (إيرادات المعاملة)', 'Against Account (Income)')}</Label>
                          <SearchableDropdown
                             options={(incomeAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))}
                             value={form.accountId}
                             onChange={v => setForm({...form, accountId: v as string})}
                          />
                       </div>

                       {showProfitCenterPicker && (
                         <div className="space-y-2 animate-in zoom-in-95">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><DatabaseZap className="h-3.5 w-3.5" /> {isRtl ? 'مركز الربحية' : 'Profit Center'}</Label>
                            <SearchableDropdown
                               options={profitCenters?.filter(pc => pc.projectId === form.transactionId || !pc.projectId).map(pc => ({ id: pc.id, name: pc.name, subText: pc.code })) || []}
                               value={form.profitCenterId}
                               onChange={v => setForm({...form, profitCenterId: v as string})}
                               placeholder="..."
                            />
                            {selectedAccount?.type === 'revenue' && !form.profitCenterId && form.transactionId && (
                              <p className="text-[8px] font-bold text-rose-500 mt-2 flex items-center gap-1.5 animate-pulse">
                                 <AlertTriangle className="h-3.5 w-3.5" /> لم يتم العور على مركز ربحية مرتبط آلياً، يرجى الاختيار يدوياً لضمان سلامة التحليل المالي.
                              </p>
                            )}
                         </div>
                       )}

                       {form.transactionId && autoLinkedPC && (
                         <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl border-2 border-emerald-100 animate-in fade-in self-center h-fit">
                            <Zap className="h-5 w-5 fill-current" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isRtl ? 'تم ربط مركز الربحية صامتاً' : 'Profit Center Linked Silently'}</span>
                         </div>
                       )}
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.generated.notes', 'البيان (توليد آلي من العقد)', 'Statement (Auto-Generated)')}</Label>
                       <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="min-h-[120px] rounded-3xl border-2 p-6 text-sm font-bold bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
                    </div>
                 </div>

                 <div className="flex justify-end gap-4 pt-8">
                    <Button variant="outline" onClick={() => setIsAdding(false)} className="h-16 rounded-2xl px-12 font-black border-2">{t('common.cancel')}</Button>
                    <Button onClick={handleSave} disabled={loading || !form.contractId} className="h-16 rounded-2xl px-20 bg-emerald-600 text-white font-black text-xl shadow-xl shadow-emerald-100 border-b-8 border-emerald-800 hover:scale-[1.02] transition-all">
                       {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} {tSafe('inline.confirm_issue_btn', 'تأكيد وإصدار السند', 'Confirm & Issue')}
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <aside className="lg:col-span-4 space-y-6 text-start">
              <Card className="rounded-[2.5rem] border shadow-sm p-8 bg-primary/5 text-slate-900 space-y-6 overflow-hidden relative border-2 border-primary/10">
                 <div className="absolute top-0 right-0 p-10 opacity-5"><Landmark className="h-48 w-48 text-primary" /></div>
                 <div className="relative z-10 space-y-4">
                    <h4 className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2"><Sparkles className="h-5 w-5" /> {tSafe('inline.financial.trace', 'الرقابة المالية السيادية', 'Sovereign Financial Guard')}</h4>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">{tSafe('inline.trace.desc', 'النظام يعمل في صمت لربط الإيرادات والمصروفات بمراكزها الصحيحة فور اختيار المشروع، مما يضمن دقة تقارير الربحية دون تعقيد إداري.', 'The system silently links revenue to profit centers for reporting accuracy.')}</p>
                 </div>
              </Card>
           </aside>
        </div>
      ) : (
        <Card className="rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden bg-white text-start">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/50 border-b-2">
                    <TableRow>
                       <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase tracking-widest">{tSafe('inline.voucher.no', 'رقم السند / التاريخ', 'Voucher No. / Date')}</TableHead>
                       <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{tSafe('inline.from.client', 'من العميل المالك', 'From Client')}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('inline.payment', 'الدفع', 'Payment')}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : (vouchers || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-bold italic text-lg">{t('common.noResults')}</TableCell></TableRow>
                    ) : (vouchers || []).sort((a:any, b:any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).map((v:any) => (
                      <TableRow key={v.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-50 group cursor-pointer" onClick={() => router.push(`/dashboard/accounting/vouchers/receipt/${v.id}`)}>
                         <TableCell className="py-5 ps-8 text-start font-black text-slate-800">
                            <div className="flex flex-col">
                               <span className="text-sm">{v.voucherNumber}</span>
                               <span className="text-[9px] text-slate-400 font-mono mt-0.5">{v.date}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600 text-sm">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-emerald-600 text-base">{(v.amount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black uppercase px-4 h-6 border-2 bg-white">{v.paymentMethod}</Badge></TableCell>
                         <TableCell className="pe-8 text-end"><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-primary group-hover:bg-primary/5 transition-all"><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button></TableCell>
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

