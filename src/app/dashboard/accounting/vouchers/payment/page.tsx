'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wallet, Plus, Loader2, Save, 
  ArrowRight, Landmark, User, Briefcase, LayoutGrid,
  AlertTriangle, Sparkles, FileText, X, Zap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Voucher, Account, VoucherDistribution } from '@/types/accounting';
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

/**
 * شاشة سندات الصرف السيادية (Payment Vouchers).
 * تم تفعيل "الوضع الصامت" لإخفاء مراكز التكلفة عند وجود ربط تلقائي.
 * تم استخدام SearchableDropdown لكافة الاختيارات.
 */
export default function PaymentVouchersPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLinkedCC, setAutoLinkedCC] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    personName: '',
    paymentMethod: '',
    accountId: '',
    cashAccountId: '',
    projectId: '',
    costCenterId: '',
    notes: '',
    distributions: [] as VoucherDistribution[]
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

  const pmQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.paymentMethods(companyId)), orderBy('order')) : null, 
  [db, companyId]);

  const { data: vouchers, loading: vouchersLoading } = useCollection<Voucher>(vouchersQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const { data: projects } = useCollection<any>(projectsQuery);
  const { data: costCenters } = useCollection<CostCenter>(costCentersQuery);
  const { data: paymentMethods } = useCollection<any>(pmQuery);

  const selectedAccount = useMemo(() => accounts?.find(a => a.id === form.accountId), [accounts, form.accountId]);

  // --- محرك الربط التلقائي "الصامت" (Silent Auto-Linking) ---
  useEffect(() => {
     if (form.projectId && costCenters && selectedAccount?.type === 'expense') {
        const matchedCC = costCenters.find(cc => cc.projectId === form.projectId || cc.id === `cc_${form.projectId}`);
        if (matchedCC) {
           setForm(prev => ({ ...prev, costCenterId: matchedCC.id }));
           setAutoLinkedCC(true);
        } else {
           setAutoLinkedCC(false);
           setForm(prev => ({ ...prev, costCenterId: '' }));
        }
     } else {
        setAutoLinkedCC(false);
     }
  }, [form.projectId, costCenters, selectedAccount]);

  const showCostCenterPicker = useMemo(() => {
     if (!selectedAccount || selectedAccount.analyticalConfig?.costCenter === 'not_allowed') return false;
     if (form.projectId && form.projectId !== 'GENERAL' && autoLinkedCC && form.costCenterId) return false;
     return true;
  }, [selectedAccount, autoLinkedCC, form.costCenterId, form.projectId]);

  const cashAccounts = useMemo(() => {
    if (!accounts || !form.paymentMethod) return [];
    return accounts.filter(a => !a.isGroup && a.allowedPaymentMethods?.includes(form.paymentMethod));
  }, [accounts, form.paymentMethod]);

  const expenseAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.type === 'expense' || a.type === 'liability')), [accounts]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!form.accountId || !form.cashAccountId || form.amount <= 0 || !form.paymentMethod) {
      toast({ variant: "destructive", title: t('common.error') });
      return;
    }

    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createVoucher({ ...form, type: 'payment' }, user.uid);
      toast({ title: t('common.saved') });
      setIsAdding(false);
      setForm({ 
        date: new Date().toISOString().split('T')[0], 
        amount: 0, personName: '', paymentMethod: '', 
        accountId: '', cashAccountId: '', projectId: '', costCenterId: '', notes: '',
        distributions: []
      });
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
            <Wallet className="h-7 w-7 text-rose-600" /> {t('paymentVouchers')}
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{tSafe('inline.payment.desc', 'إدارة المصروفات وربطها بمراكز تكلفة المشاريع', 'Manage expenses and link to project cost centers')}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-11 px-8 font-black rounded-xl shadow-lg gap-2 bg-rose-600 hover:bg-rose-700 text-white border-b-4 border-rose-800 transition-all">
           {isAdding ? <ArrowRight className={cn("h-4 w-4", !isRtl && "rotate-180")} /> : <Plus className="h-4 w-4" />}
           {isAdding ? t('common.back') : tSafe('inline.issue.payment', 'إصدار سند صرف', 'Issue Payment')}
        </Button>
      </header>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4">
           <Card className="lg:col-span-8 rounded-[2.5rem] border-0 shadow-3xl bg-white overflow-hidden ring-1 ring-black/5">
              <CardHeader className="bg-rose-50/50 p-8 border-b text-start">
                 <CardTitle className="text-rose-900 font-black text-xl flex items-center gap-3">
                    <Plus className="h-5 w-5" /> {tSafe('inline.issue.payment', 'إصدار سند صرف معتمد', 'Issue Official Payment')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-8 text-start bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.date')}</Label>
                       <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-12 rounded-xl border-2 font-bold" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'يصرف للسيد / الجهة' : 'Paid To'}</Label>
                       <div className="relative">
                          <User className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                          <Input value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} className="h-12 rounded-xl ps-12 font-black text-lg bg-slate-50/30 border-2" placeholder="..." />
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.amount')}</Label>
                       <div className="relative">
                          <Input type="number" step="0.001" value={form.amount === 0 ? "" : form.amount} onChange={e => setForm({...form, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="h-16 rounded-2xl border-2 border-rose-100 bg-rose-50/20 text-center font-black text-3xl text-rose-600" />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-rose-300">KWD</div>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('paymentMethods')}</Label>
                       <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v, cashAccountId: ''})}>
                          <SelectTrigger className="h-16 rounded-2xl border-2 font-black text-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-2xl border-0 shadow-2xl">
                             {paymentMethods?.map((pm: any) => (
                               <SelectItem key={pm.code} value={pm.code} className="font-bold py-3 border-b last:border-0 border-slate-50">{isRtl ? pm.name : (pm.nameEn || pm.name)}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isRtl ? 'من حساب الخزينة' : 'Pay From'}</Label>
                       <SearchableDropdown
                         disabled={!form.paymentMethod}
                         options={(cashAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))}
                         value={form.cashAccountId}
                         onChange={v => setForm({...form, cashAccountId: v as string})}
                         placeholder="..."
                       />
                    </div>
                 </div>

                 <div className="pt-8 border-t space-y-6">
                    <div className="flex justify-between items-center px-1">
                       <Label className="text-[11px] font-black uppercase text-primary tracking-widest">{isRtl ? 'تحميل المصروف على حساب' : 'Charge To Account'}</Label>
                    </div>

                    <div className="space-y-6">
                       <SearchableDropdown
                         options={(expenseAccounts || []).map(a => ({ id: a.id!, name: isRtl ? a.nameAr : a.nameEn, subText: a.code }))}
                         value={form.accountId}
                         onChange={v => setForm({...form, accountId: v as string})}
                         placeholder={isRtl ? "اختر حساب المصروف..." : "Choose Expense Account..."}
                       />

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                          <div className="space-y-1.5 text-start">
                             <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">المشروع المستهدف</Label>
                             <SearchableDropdown
                                options={[
                                   { id: 'GENERAL', name: isRtl ? '--- مصروف إداري عام ---' : '--- General Admin ---' },
                                   ...(projects || []).map(p => ({ 
                                      id: p.id!, 
                                      name: p.clientName, 
                                      subText: `${p.subServiceName} (#${p.transactionNumber})` 
                                   }))
                                ]}
                                value={form.projectId}
                                onChange={v => setForm({...form, projectId: v as string})}
                                placeholder={isRtl ? "اختيار المشروع..." : "Project..."}
                             />
                          </div>

                          {showCostCenterPicker && (
                            <div className="space-y-1.5 animate-in zoom-in-95 text-start">
                               <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" /> {isRtl ? 'مركز التكلفة' : 'Cost Center'}</Label>
                               <SearchableDropdown
                                  options={costCenters?.filter(cc => cc.isAdministrative || (form.projectId && cc.projectId === form.projectId)).map(cc => ({ id: cc.id, name: cc.name, subText: cc.code })) || []}
                                  value={form.costCenterId}
                                  onChange={v => setForm({...form, costCenterId: v as string})}
                                  placeholder="..."
                               />
                               
                               {selectedAccount?.analyticalConfig?.costCenter === 'required' && !form.costCenterId && form.projectId && (
                                 <p className="text-[8px] font-bold text-rose-500 mt-2 animate-pulse flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3" /> لم يتم العور على مركز تكلفة مرتبط آلياً لهذا المشروع، يرجى التحديد يدوياً لضمان سلامة التقارير.
                                 </p>
                               )}
                            </div>
                          )}

                          {form.projectId && form.projectId !== 'GENERAL' && autoLinkedCC && (
                             <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-6 py-2 rounded-2xl border-2 border-emerald-100 animate-in fade-in">
                                <Zap className="h-4 w-4 fill-current" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isRtl ? 'تم الربط آلياً بمركز المشروع' : 'Project Cost Center Linked Silently'}</span>
                             </div>
                          )}
                       </div>
                    </div>

                    <div className="space-y-2 pt-6 border-t border-slate-50">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('common.notes')}</Label>
                       <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full min-h-[100px] rounded-2xl border-2 p-5 text-sm font-bold bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="..." />
                    </div>
                 </div>

                 <div className="flex justify-end gap-4 pt-8">
                    <Button variant="outline" onClick={() => setIsAdding(false)} className="h-16 rounded-2xl px-10 font-black border-2 border-slate-100">{t('common.cancel')}</Button>
                    <Button onClick={handleSave} disabled={loading} className="h-16 rounded-2xl px-16 bg-rose-600 text-white font-black text-xl shadow-xl shadow-rose-200 hover:scale-[1.02] transition-all gap-3 border-b-8 border-rose-800">
                       {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                       {tSafe('inline.confirm.issue', 'تأكيد وإصدار السند', 'Confirm & Issue')}
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <aside className="lg:col-span-4 space-y-6 text-start">
              <Card className="rounded-[2.5rem] border shadow-sm p-8 bg-primary/5 text-slate-900 space-y-6 overflow-hidden relative border-2 border-primary/10">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Landmark className="h-40 w-40 text-primary" /></div>
                 <div className="relative z-10 space-y-4">
                    <h4 className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles className="h-5 w-5" /> {isRtl ? 'الأتمتة المحاسبية السيادية' : 'Sovereign Accounting AI'}</h4>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                       {isRtl ? 'النظام يقوم بمطاردة التكاليف في الخلفية لربطها بالمشاريع دون إزعاج المحاسب، مما يضمن دقة تقارير الربحية اللحظية.' : 'The system tracks costs silently in the background to link them to projects for real-time profitability analytics.'}
                    </p>
                 </div>
              </Card>

              <Card className="rounded-[2.5rem] border-0 shadow-lg p-8 bg-slate-900 text-white space-y-6 relative overflow-hidden">
                 <div className="absolute bottom-0 right-0 p-8 opacity-10"><Briefcase className="h-32 w-32 text-primary" /></div>
                 <div className="relative z-10 text-start space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.3em]">{isRtl ? 'إجمالي الصرف اليوم' : 'Total Spend Today'}</h4>
                    <h3 className="text-4xl font-black font-headline">0 <span className="text-xs text-primary">KWD</span></h3>
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
                       <TableHead className="py-5 ps-8 text-start text-[10px] font-black uppercase tracking-widest">{isRtl ? 'رقم السند / التاريخ' : 'Voucher No. / Date'}</TableHead>
                       <TableHead className="text-start text-[10px] font-black uppercase tracking-widest">{isRtl ? 'يصرف للسيد' : 'Paid To'}</TableHead>
                       <TableHead className="text-end text-[10px] font-black uppercase tracking-widest">{t('common.amount')}</TableHead>
                       <TableHead className="text-center text-[10px) font-black uppercase tracking-widest">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                       <TableHead className="pe-8"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : vouchers?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-24 text-slate-300 font-bold italic text-lg">{t('common.noResults')}</TableCell></TableRow>
                    ) : (vouchers || []).map(v => (
                      <TableRow key={v.id} className="hover:bg-primary/[0.01] transition-colors border-b-slate-50 group cursor-pointer">
                         <TableCell className="py-5 ps-8 text-start font-black text-slate-800">
                            <div className="flex flex-col">
                               <span className="text-sm">{v.voucherNumber}</span>
                               <span className="text-[9px] text-slate-400 font-mono mt-0.5">{v.date}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600 text-sm">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-rose-600 text-base">{v.amount.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center">
                            <Badge variant="outline" className="text-[8px] font-black uppercase px-3 h-5 border-2 bg-white">{v.paymentMethod}</Badge>
                         </TableCell>
                         <TableCell className="pe-8 text-end">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 group-hover:text-rose-600 group-hover:bg-rose-50 transition-all"><FileText className="h-4 w-4" /></Button>
                         </TableCell>
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
