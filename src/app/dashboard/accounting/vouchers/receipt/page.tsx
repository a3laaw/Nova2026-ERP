
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
  Workflow, Hash
} from "lucide-react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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

/**
 * مكون البحث الذكي المستقر لسندات القبض.
 * تم إصلاح مشكلة عدم الإغلاق بعد الاختيار.
 */
function SearchablePicker({ value, onSelect, items, search, onSearchChange, icon: Icon, placeholder, type, disabled = false, isRtl }: any) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button variant="outline" className="w-full h-12 rounded-xl border-2 font-bold justify-between bg-white px-4">
          <div className="flex items-center gap-3 overflow-hidden">
             <Icon className={cn("h-4 w-4 opacity-40", !disabled && "text-primary")} />
             <span className="truncate">{value || placeholder}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-20" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[400px] p-0 rounded-2xl shadow-3xl border-2 z-[200]" 
        align="start" 
        onOpenAutoFocus={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
         <div className="p-3 bg-slate-50 border-b">
            <div className="relative">
               <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
               <Input 
                 placeholder="بحث..." 
                 className="h-9 ps-9 rounded-lg border-2 bg-white text-xs font-bold"
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
                       setOpen(false); 
                     }}
                     className={cn(
                       "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border-2 border-transparent",
                       (value === mainTitle) ? "bg-primary/5 border-primary/20 text-primary" : "hover:bg-slate-50"
                     )}
                   >
                      <div className="text-start min-w-0 flex-1">
                         <p className="font-black text-xs text-slate-900 truncate">{mainTitle}</p>
                         {subTitle && (
                           <p className="text-[8px] font-mono text-slate-400 mt-1 uppercase" dir="ltr">#{subTitle}</p>
                         )}
                      </div>
                      {(value === mainTitle) && <Check className="h-3.5 w-3.5 shrink-0" />}
                   </div>
                 );
               })}
            </div>
         </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

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

  const [clientSearch, setClientSearch] = useState("");
  const [transSearch, setTransSearch] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    feeAmount: 0,
    netAmount: 0,
    personName: '',
    paymentMethod: '',
    accountId: '',
    cashAccountId: '',
    projectId: '', 
    transactionId: '',
    transactionName: '',
    contractId: '',
    notes: '',
    appliedMilestoneName: ''
  });

  const vouchersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.vouchers(companyId)), where('type', '==', 'receipt')) : null, 
  [db, companyId]);

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId))) : null, 
  [db, companyId]);

  const clientsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.clients(companyId)), orderBy('nameAr')) : null, 
  [db, companyId]);

  const projectsQuery = useMemo(() => 
    companyId && db && form.personName ? query(collection(db, paths.transactions(companyId)), where('status', '!=', 'completed')) : null, 
  [db, companyId, form.personName]);

  const pmQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.paymentMethods(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: vouchers, loading: vouchersLoading } = useCollection<Voucher>(vouchersQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const { data: clients } = useCollection<any>(clientsQuery);
  const { data: allTransactions } = useCollection<Transaction>(projectsQuery);
  const { data: paymentMethods } = useCollection<any>(pmQuery);

  const filteredClients = useMemo(() => {
    return (clients || []).filter(c => c.nameAr.toLowerCase().includes(clientSearch.toLowerCase()) || c.mobile?.includes(clientSearch) || c.fileNumber?.includes(clientSearch));
  }, [clients, clientSearch]);

  const filteredTrans = useMemo(() => {
    return (allTransactions || []).filter(t_item => t_item.clientName === form.personName && (t_item.subServiceName.toLowerCase().includes(transSearch.toLowerCase()) || t_item.transactionNumber.toLowerCase().includes(transSearch.toLowerCase())));
  }, [allTransactions, transSearch, form.personName]);

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
      const voucherId = await service.createVoucher({ ...form, type: 'receipt' }, user.uid);
      toast({ title: t('common.saved') });
      setIsAdding(false);
      router.push(`/dashboard/accounting/vouchers/receipt/${voucherId}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const sortedVouchers = useMemo(() => {
    return [...(vouchers || [])].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [vouchers]);

  return (
    <div className="space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Receipt className="h-6 w-6 text-emerald-600" /> {tSafe('accounting.vouchers.receiptTitle', 'سندات القبض الذكية', 'Smart Receipt Vouchers')}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">{tSafe('inline.receipt.desc', 'إدارة التحصيل المالي وربطه بالعقود والدفعات آلياً', 'Manage revenue collection and link to contracts automatically')}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-9 px-6 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
          {isAdding ? t('common.back') : tSafe('inline.issue.receipt', 'إصدار سند قبض', 'Issue Receipt')}
        </Button>
      </header>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
           <Card className="lg:col-span-8 rounded-xl border-0 shadow-2xl bg-white overflow-hidden text-start">
              <CardHeader className="bg-emerald-50 p-6 border-b text-start">
                 <CardTitle className="text-emerald-900 font-black flex items-center gap-3">
                    <Sparkles className="h-5 w-5" /> {tSafe('inline.issue.smart.receipt', 'إصدار سند قبض ذكي', 'Issue Smart Receipt')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8 text-start bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.received.from', 'المقبوض من السيد (العميل)', 'Received From')}</Label>
                       <SearchablePicker 
                         type="client"
                         value={form.personName}
                         onSelect={(c: any) => setForm({ ...form, personName: c.nameAr, transactionId: '', transactionName: '', contractId: '', notes: '' })}
                         items={filteredClients}
                         search={clientSearch}
                         onSearchChange={setClientSearch}
                         icon={UserCircle}
                         placeholder={tSafe('common.search', 'بحث عن عميل...', 'Search Client...')}
                         isRtl={isRtl}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tSafe('inline.related.transaction', 'المعاملة الفنية المرتبطة', 'Related Transaction')}</Label>
                       <SearchablePicker 
                         type="transaction"
                         disabled={!form.personName}
                         value={form.transactionName}
                         onSelect={(t_row: any) => setForm({ ...form, transactionId: t_row.id, transactionName: t_row.subServiceName, transactionNumber: t_row.transactionNumber, contractId: '', notes: '' })}
                         items={filteredTrans}
                         search={transSearch}
                         onSearchChange={setTransSearch}
                         icon={Workflow}
                         placeholder={tSafe('common.search', 'بحث في المشاريع...', 'Search Project...')}
                         isRtl={isRtl}
                       />
                    </div>
                 </div>

                 {form.transactionId && (
                   <div className="space-y-2 animate-in slide-in-from-top-2 text-start">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><Gavel className="h-3 w-3" /> {tSafe('inline.linked.contract', 'العقد المعتمد (الارتباط المالي)', 'Linked Contract')}</Label>
                      {contracts.length === 0 ? (
                        <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-xl text-rose-600 font-bold text-xs">{tSafe('inline.no.approved.contract', 'تنبيه: لا يوجد عقد معتمد لهذه المعاملة لبدء التحصيل.', 'No approved contract found for this transaction.')}</div>
                      ) : (
                        <Select value={form.contractId} onValueChange={v => setForm({ ...form, contractId: v })}>
                           <SelectTrigger className="h-12 rounded-xl border-2 font-black bg-white shadow-sm"><SelectValue placeholder="..." /></SelectTrigger>
                           <SelectContent className="rounded-xl border shadow-2xl z-[160]">
                              {contracts.map(c => (
                                <SelectItem key={c.id} value={c.id} className="font-bold py-3">
                                   <div className="flex justify-between items-center gap-10"><span>{c.name}</span><Badge variant="outline" className="h-5 px-2 bg-emerald-50 text-emerald-600 border-emerald-100">{c.totalAmount.toLocaleString()} KWD</Badge></div>
                                </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                      )}
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t">
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.amount')}</Label>
                       <div className="relative">
                          <Input type="number" step="0.001" value={form.amount === 0 ? "" : form.amount} onChange={e => setForm({...form, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="h-14 rounded-xl border-2 border-emerald-100 bg-emerald-50/20 text-center font-black text-2xl text-emerald-600" />
                          {milestonesLoading && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                       </div>
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('paymentMethods')}</Label>
                       <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v, cashAccountId: ''})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-bold bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                             {paymentMethods?.map((pm: any) => (
                               <SelectItem key={pm.code} value={pm.code} className="font-bold py-3 text-xs">{tSafe('data.pm.name', pm.name, pm.nameEn || pm.name)}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.deposit.to', 'إيداع في حساب', 'Deposit To')}</Label>
                       <Select disabled={!form.paymentMethod} value={form.cashAccountId} onValueChange={v => setForm({...form, cashAccountId: v})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-black text-blue-600 bg-white"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                             {cashAccounts?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">{a.code} - {tSafe('data.account.name', a.nameAr, a.nameEn)}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2 text-start">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.net.deposit', 'صافي الإيداع', 'Net Deposit')}</Label>
                       <div className="h-14 rounded-xl border-2 border-dashed flex items-center justify-center bg-slate-50 shadow-inner">
                          <p className="font-black text-xl text-slate-900">{(form.netAmount || 0).toLocaleString()} <span className="text-[8px] text-slate-400 uppercase">KWD</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 pt-6 border-t text-start">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{tSafe('inline.against.income', 'مقابل حساب (إيراد)', 'Against Account (Income)')}</Label>
                       <Select value={form.accountId} onValueChange={v => setForm({...form, accountId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2 shadow-2xl z-[160]">
                             {incomeAccounts?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">{a.code} - {tSafe('data.account.name', a.nameAr, a.nameEn)}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{tSafe('inline.generated.notes', 'البيان (توليد آلي)', 'Statement (Auto)')}</Label>
                       <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="min-h-[100px] rounded-2xl border-2 p-5 text-sm font-bold bg-slate-50/30" placeholder="..." />
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-4">
                    <Button onClick={handleSave} disabled={loading || !form.contractId} className="h-14 rounded-2xl px-12 bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 border-b-4 border-emerald-800">
                       {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} {tSafe('inline.confirm_issue_btn', 'تأكيد وإصدار السند', 'Confirm & Issue')}
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <aside className="lg:col-span-4 space-y-6 text-start">
              <Card className="rounded-[2rem] border shadow-sm p-8 bg-primary/5 text-slate-900 space-y-6 overflow-hidden relative border-2 border-primary/10">
                 <div className="absolute top-0 right-0 p-6 opacity-5"><Landmark className="h-32 w-32 text-primary" /></div>
                 <div className="relative z-10">
                    <h4 className="font-black text-sm uppercase tracking-widest text-primary mb-2">{tSafe('inline.financial.trace', 'التتبع المالي السيادي', 'Financial Traceability')}</h4>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">{tSafe('inline.trace.desc', 'عند حفظ هذا السند، سيقوم النظام بتوليد قيد مزدوج يربط النقدية بالإيراد، مع توثيق الأثر المالي آلياً.', 'System will auto-generate a journal entry, updating project radar and client dossier.')}</p>
                 </div>
                 {form.contractId && milestonesStatus.length > 0 && (
                   <div className="relative z-10 pt-6 border-t border-primary/10 space-y-4">
                      <h5 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><History className="h-3.5 w-3.5" /> {tSafe('inline.contract.snapshot', 'حالة دفعات العقد الحالية', 'Contract Snapshot')}</h5>
                      <div className="space-y-2">
                         {milestonesStatus.map((m, i) => (
                           <div key={i} className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 font-bold truncate max-w-[140px]">{m.milestone.name}</span>
                              <Badge className={cn("text-[8px] font-black h-4 px-1.5 border-0 shadow-sm", m.remaining === 0 ? "bg-emerald-50 text-white" : "bg-primary/10 text-primary")}>{m.remaining === 0 ? 'PAID' : `${m.paidToDate}/${m.milestoneAmount}`}</Badge>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
              </Card>
           </aside>
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm border overflow-hidden bg-white text-start">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow>
                       <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase tracking-widest">{tSafe('inline.voucher.no', 'رقم السند / التاريخ', 'Voucher No. / Date')}</TableHead>
                       <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{tSafe('inline.from.client', 'من العميل', 'From Client')}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">{tSafe('inline.payment', 'الدفع', 'Payment')}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : sortedVouchers.map(v => (
                      <TableRow key={v.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 group" onClick={() => router.push(`/dashboard/accounting/vouchers/receipt/${v.id}`)}>
                         <TableCell className="py-4 ps-8 text-start font-black text-slate-800">
                            <div className="flex flex-col"><span>{v.voucherNumber}</span><span className="text-[9px] text-slate-400 font-mono">{v.date}</span></div>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600 text-xs">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-emerald-600">{(v.amount || 0).toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black uppercase px-3 border-2 h-6">{v.paymentMethod}</Badge></TableCell>
                         <TableCell className="pe-8 text-end"><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-primary"><ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} /></Button></TableCell>
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
