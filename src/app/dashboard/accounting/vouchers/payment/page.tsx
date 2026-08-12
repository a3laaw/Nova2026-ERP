'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wallet, Plus, Loader2, Save, 
  ArrowRight, Landmark, User, FileText, Briefcase, LayoutGrid, DatabaseZap,
  Split, Trash2, CheckCircle2, History
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function PaymentVouchersPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl, tSafe } = useLanguage();
  const db = useFirestore();
  const companyId = globalUser?.companyId;

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDistOpen, setIsDistOpen] = useState(false);

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
        accountId: '', cashAccountId: '', projectId: '', costCenterId: '', profitCenterId: '', notes: '',
        distributions: []
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const distSum = form.distributions.reduce((acc, d) => acc + d.amount, 0);
  const isDistBalanced = Math.abs(distSum - form.amount) < 0.001;

  const handleAddDist = () => {
     setForm({ ...form, distributions: [...form.distributions, { amount: 0, projectId: '', costCenterId: '', profitCenterId: '' }] });
  };

  return (
    <div className="space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center text-start">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-rose-600" /> {t('paymentVouchers')}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">{tSafe('inline.payment.desc', 'إدارة المصروفات وربطها بمراكز تكلفة المشاريع', 'Manage expenses and link to project cost centers')}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-9 px-6 font-bold gap-2 bg-rose-600 hover:bg-rose-700">
           {isAdding ? <ArrowRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
           {isAdding ? t('common.back') : tSafe('inline.issue.payment', 'إصدار سند صرف', 'Issue Payment')}
        </Button>
      </header>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
           <Card className="lg:col-span-8 rounded-xl border-0 shadow-2xl bg-white overflow-hidden">
              <CardHeader className="bg-rose-50 p-6 border-b text-start">
                 <CardTitle className="text-rose-900 font-black flex items-center gap-3">
                    <Plus className="h-5 w-5" /> {tSafe('inline.issue.payment', 'إصدار سند صرف', 'Issue Payment')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.date')}</Label>
                       <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-10 rounded-lg" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الصرف إلى السيد' : 'Paid To'}</Label>
                       <div className="relative">
                          <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                          <Input value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} className="h-10 rounded-lg ps-10 font-bold" placeholder="..." />
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.amount')}</Label>
                       <div className="relative">
                          <Input type="number" step="0.001" value={form.amount === 0 ? "" : form.amount} onChange={e => setForm({...form, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="h-14 rounded-xl border-2 border-rose-100 bg-rose-50/20 text-center font-black text-2xl text-rose-600" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-200">KWD</div>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('paymentMethods')}</Label>
                       <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v, cashAccountId: ''})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {paymentMethods?.map((pm: any) => (
                               <SelectItem key={pm.code} value={pm.code} className="font-bold py-2">{isRtl ? pm.name : (pm.nameEn || pm.name)}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'الصرف من حساب' : 'Pay From'}</Label>
                       <Select disabled={!form.paymentMethod} value={form.cashAccountId} onValueChange={v => setForm({...form, cashAccountId: v})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-black text-rose-600"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {cashAccounts?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{isRtl ? a.nameAr : a.nameEn}</SelectItem>)}
                             {cashAccounts.length === 0 && form.paymentMethod && (
                               <div className="p-4 text-center text-rose-500 text-[10px] font-bold">
                                  لا يوجد حساب مفعل لطريقة الدفع هذه في دليل الحسابات.
                               </div>
                             )}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="pt-6 border-t space-y-4">
                    <div className="flex justify-between items-center mb-2">
                       <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{isRtl ? 'مقابل حساب (مصروف)' : 'Against Account (Expense)'}</Label>
                       <button 
                         type="button" 
                         onClick={() => { setIsDistOpen(true); if(form.distributions.length === 0) handleAddDist(); }} 
                         className="flex items-center gap-2 text-primary font-black text-[10px] uppercase hover:underline"
                       >
                          <Split className="h-3 w-3" /> {tSafe('inline.distribute.expense', 'توزيع المصروف', 'Distribute Expense')}
                       </button>
                    </div>

                    <div className="space-y-4">
                       <Select value={form.accountId} onValueChange={v => setForm({...form, accountId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {expenseAccounts?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{a.code} - {isRtl ? a.nameAr : a.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>

                       {form.distributions.length > 0 ? (
                         <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                            <span className="text-[10px] font-black text-primary uppercase">{isRtl ? `موزع على ${form.distributions.length} مشاريع` : `Distributed across ${form.distributions.length} projects`}</span>
                            <Badge className={isDistBalanced ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>{isDistBalanced ? 'BALANCED' : 'MISMATCH'}</Badge>
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select value={form.projectId} onValueChange={v => setForm({...form, projectId: v, costCenterId: '', profitCenterId: ''})}>
                               <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-slate-50/50 text-[10px]"><SelectValue placeholder={isRtl ? "المشروع..." : "Project..."} /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  <SelectItem value="GENERAL" className="italic text-slate-400">--- {isRtl ? 'عام' : 'General'} ---</SelectItem>
                                  {projects?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold text-xs">{p.subServiceName}</SelectItem>)}
                               </SelectContent>
                            </Select>
                            <Select value={form.costCenterId} onValueChange={v => setForm({...form, costCenterId: v})}>
                               <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-slate-50/50 text-[10px]"><SelectValue placeholder={isRtl ? "مركز تكلفة..." : "Cost Center..."} /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  {costCenters?.filter(cc => cc.isAdministrative || (form.projectId && cc.projectId === form.projectId)).map(cc => <SelectItem key={cc.id} value={cc.id!} className="font-bold text-xs">{cc.name}</SelectItem>)}
                               </SelectContent>
                            </Select>
                            <Select value={form.profitCenterId} onValueChange={v => setForm({...form, profitCenterId: v})}>
                               <SelectTrigger className="h-10 rounded-lg border-2 font-bold bg-slate-50/50 text-[10px]"><SelectValue placeholder={isRtl ? "مركز ربحية..." : "Profit Center..."} /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  {profitCenters?.filter(pc => form.projectId && pc.projectId === form.projectId).map(pc => <SelectItem key={pc.id} value={pc.id!} className="font-bold text-xs">{pc.name}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                       )}
                    </div>

                    <div className="space-y-2 pt-4">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.notes')}</Label>
                       <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full min-h-[80px] rounded-xl border-2 p-4 text-xs font-medium bg-slate-50/30" placeholder="..." />
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-6">
                    <Button onClick={handleSave} disabled={loading || (form.distributions.length > 0 && !isDistBalanced)} className="h-14 rounded-2xl px-12 bg-rose-600 text-white font-black text-lg shadow-xl shadow-rose-100 hover:scale-[1.02] transition-all gap-2 border-b-4 border-rose-800">
                       {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                       {tSafe('inline.confirm.issue', 'تأكيد وإصدار السند', 'Confirm & Issue')}
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <aside className="lg:col-span-4 space-y-6 text-start">
              <Card className="rounded-2xl border-2 border-primary/10 shadow-sm p-6 bg-primary/5 text-slate-900 space-y-4 overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-6 opacity-5"><Landmark className="h-24 w-24" /></div>
                 <h4 className="font-black text-xs uppercase tracking-widest text-primary">{isRtl ? 'المطابقة التلقائية' : 'Auto Reconciliation'}</h4>
                 <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                    {isRtl ? 'سيقوم النظام بتوليد قيد اليومية المناظر فور حفظ السند، مع ربطه بمركز التكلفة المختار.' : 'System will auto-generate journal entries and link to the selected cost center.'}
                 </p>
              </Card>
           </aside>
        </div>
      ) : (
        <Card className="rounded-lg shadow-sm border overflow-hidden bg-white">
           <CardContent className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow>
                       <TableHead className="py-3 ps-6 text-start">{isRtl ? 'رقم السند / التاريخ' : 'Voucher No. / Date'}</TableHead>
                       <TableHead className="text-start">{isRtl ? 'إلى السيد' : 'Paid To'}</TableHead>
                       <TableHead className="text-end">{t('common.amount')}</TableHead>
                       <TableHead className="text-center">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                       <TableHead className="pe-6"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : (vouchers || []).map(v => (
                      <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 cursor-pointer">
                         <TableCell className="py-3 ps-6 text-start font-black text-slate-800">
                            <div className="flex flex-col">
                               <span>{v.voucherNumber}</span>
                               <span className="text-[9px] text-slate-400 font-mono">{v.date}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-rose-600">{v.amount.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
                         <TableCell className="text-center">
                            <Badge variant="outline" className="text-[8px] font-black uppercase px-2">{v.paymentMethod}</Badge>
                         </TableCell>
                         <TableCell className="pe-6 text-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-300 hover:text-primary"><FileText className="h-4 w-4" /></Button>
                         </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>
      )}

      {/* نافذة توزيع المصروف */}
      <Dialog open={isDistOpen} onOpenChange={setIsDistOpen}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-3xl bg-white">
           <div className="bg-primary p-8 text-white text-start">
              <div className="flex justify-between items-center">
                 <div>
                    <DialogTitle className="text-2xl font-black font-headline flex items-center gap-3"><Split className="h-8 w-8" /> {tSafe('inline.joint.dist', 'توزيع المصروف المشترك', 'Joint Expense Distribution')}</DialogTitle>
                    <p className="text-white/60 font-bold text-xs mt-2 uppercase tracking-widest">{tSafe('inline.voucher.total', 'إجمالي السند:', 'Voucher Total:')} {form.amount.toLocaleString()} KWD</p>
                 </div>
                 <div className="text-end">
                    <p className="text-[10px] font-black text-white/40 uppercase">{tSafe('inline.total.dist', 'إجمالي التوزيع', 'Total Distributed')}</p>
                    <h3 className={cn("text-3xl font-black", isDistBalanced ? "text-emerald-300" : "text-rose-300")}>{distSum.toLocaleString()}</h3>
                 </div>
              </div>
           </div>

           <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto scrollbar-hide bg-white text-start">
              {form.distributions.map((dist, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 rounded-2xl bg-slate-50 border-2 border-white shadow-inner">
                   <div className="md:col-span-3 space-y-1">
                      <Label className="text-[9px] font-black uppercase text-slate-400">المشروع</Label>
                      <Select value={dist.projectId} onValueChange={v => {
                         const nd = [...form.distributions];
                         nd[idx] = { ...nd[idx], projectId: v, costCenterId: '', profitCenterId: '' };
                         setForm({ ...form, distributions: nd });
                      }}>
                         <SelectTrigger className="h-9 rounded-lg border-2 bg-white font-bold text-[10px]"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent className="rounded-xl z-[170]">
                            {projects?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold text-xs">{p.subServiceName}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="md:col-span-3 space-y-1">
                      <Label className="text-[9px] font-black uppercase text-slate-400">مركز التكلفة</Label>
                      <Select value={dist.costCenterId} onValueChange={v => {
                         const nd = [...form.distributions];
                         nd[idx].costCenterId = v;
                         setForm({ ...form, distributions: nd });
                      }}>
                         <SelectTrigger className="h-9 rounded-lg border-2 bg-white font-bold text-[10px]"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent className="rounded-xl z-[170]">
                            {costCenters?.filter(cc => cc.isAdministrative || (dist.projectId && cc.projectId === dist.projectId)).map(cc => <SelectItem key={cc.id} value={cc.id!} className="font-bold text-xs">{cc.name}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="md:col-span-3 space-y-1">
                      <Label className="text-[9px] font-black uppercase text-slate-400">مركز الربحية</Label>
                      <Select value={dist.profitCenterId} onValueChange={v => {
                         const nd = [...form.distributions];
                         nd[idx].profitCenterId = v;
                         setForm({ ...form, distributions: nd });
                      }}>
                         <SelectTrigger className="h-9 rounded-lg border-2 bg-white font-bold text-[10px]"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent className="rounded-xl z-[170]">
                            {profitCenters?.filter(pc => dist.projectId && pc.projectId === dist.projectId).map(pc => <SelectItem key={pc.id} value={pc.id!} className="font-bold text-xs">{pc.name}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="md:col-span-2 space-y-1">
                      <Label className="text-[9px] font-black uppercase text-slate-400">المبلغ</Label>
                      <Input 
                        type="number" 
                        step="0.001" 
                        value={dist.amount === 0 ? "" : dist.amount} 
                        onChange={e => {
                           const nd = [...form.distributions];
                           nd[idx].amount = e.target.value === '' ? 0 : Number(e.target.value);
                           setForm({ ...form, distributions: nd });
                        }}
                        className="h-9 rounded-lg border-2 font-black text-xs text-center" 
                      />
                   </div>
                   <div className="md:col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setForm({ ...form, distributions: form.distributions.filter((_, i) => i !== idx) })} className="h-9 w-9 text-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                   </div>
                </div>
              ))}
              <Button variant="outline" onClick={handleAddDist} className="w-full h-12 rounded-xl border-dashed border-2 font-black text-xs gap-2"><Plus className="h-4 w-4" /> {isRtl ? 'إضافة مشروع آخر' : 'Add Project'}</Button>
           </div>

           <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-4">
              <Button variant="ghost" onClick={() => { setForm({...form, distributions: []}); setIsDistOpen(false); }} className="flex-1 font-bold text-slate-400">{tSafe('inline.cancel.dist', 'إلغاء التوزيع', 'Cancel Distribution')}</Button>
              <Button onClick={() => setIsDistOpen(false)} disabled={!isDistBalanced} className="flex-[2] h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 gap-3 border-b-8 border-orange-700">
                 <CheckCircle2 className="h-6 w-6" /> {tSafe('inline.confirm.dist', 'اعتماد التوزيع', 'Confirm Distribution')}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}