'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Receipt, Plus, Loader2, Save, 
  ArrowRight, Landmark, Wallet,
  User, Calendar, FileText, Briefcase,
  CheckCircle2, Sparkles, LayoutGrid, DatabaseZap
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
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

export default function ReceiptVouchersPage() {
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
    paymentMethod: 'cash' as any,
    accountId: '',
    cashAccountId: '',
    projectId: '',
    costCenterId: '',
    profitCenterId: '',
    notes: ''
  });

  const vouchersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.vouchers(companyId)), where('type', '==', 'receipt'), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId))) : null, 
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

  const { data: vouchers, loading: vouchersLoading } = useCollection<Voucher>(vouchersQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const { data: projects } = useCollection<any>(projectsQuery);
  const { data: costCenters } = useCollection<CostCenter>(costCentersQuery);
  const { data: profitCenters } = useCollection<ProfitCenter>(profitCentersQuery);

  const cashAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.code.startsWith('101') || a.code.startsWith('102') || a.type === 'asset')), [accounts]);
  const incomeAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && a.type === 'revenue' || a.type === 'liability'), [accounts]);

  const filteredCC = useMemo(() => {
    return costCenters?.filter(cc => cc.isAdministrative || (form.projectId && cc.projectId === form.projectId));
  }, [costCenters, form.projectId]);

  const filteredPC = useMemo(() => {
    return profitCenters?.filter(pc => form.projectId && pc.projectId === form.projectId);
  }, [profitCenters, form.projectId]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!form.accountId || !form.cashAccountId || form.amount <= 0) {
      toast({ variant: "destructive", title: t('common.error') });
      return;
    }

    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createVoucher({ ...form, type: 'receipt' }, user.uid);
      toast({ title: t('common.saved') });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], amount: 0, personName: '', paymentMethod: 'cash', accountId: '', cashAccountId: '', projectId: '', costCenterId: '', profitCenterId: '', notes: '' });
    } catch (e: any) {
      toast({ variant: "destructive", title: t('common.error'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in" dir={dir}>
      <header className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" /> {isRtl ? 'سندات القبض' : 'Receipt Vouchers'}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">{isRtl ? 'إدارة التحصيل المالي وربطه بمراكز التكلفة' : 'Manage revenue collection and link to cost centers'}</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-9 px-6 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700">
           {isAdding ? <ArrowRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
           {isAdding ? t('common.back') : (isRtl ? 'إصدار سند قبض' : 'Issue Receipt')}
        </Button>
      </header>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
           <Card className="lg:col-span-8 rounded-xl border-0 shadow-2xl bg-white overflow-hidden">
              <CardHeader className="bg-emerald-50 p-6 border-b text-start">
                 <CardTitle className="text-emerald-900 font-black flex items-center gap-3">
                    <Sparkles className="h-5 w-5" /> {isRtl ? 'إصدار سند قبض جديد' : 'Issue New Receipt'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.date')}</Label>
                       <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-10 rounded-lg" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'المقبوض من السيد' : 'Received From'}</Label>
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
                          <Input type="number" step="0.001" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="h-14 rounded-xl border-2 border-emerald-100 bg-emerald-50/20 text-center font-black text-2xl text-emerald-600" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-200">KWD</div>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</Label>
                       <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="cash" className="font-bold">{isRtl ? 'نقدي' : 'Cash'}</SelectItem>
                             <SelectItem value="bank" className="font-bold">{isRtl ? 'شيك' : 'Check'}</SelectItem>
                             <SelectItem value="transfer" className="font-bold">{isRtl ? 'تحويل بنكي / KNET' : 'Bank Transfer'}</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{isRtl ? 'إيداع في حساب' : 'Deposit To Account'}</Label>
                       <Select value={form.cashAccountId} onValueChange={v => setForm({...form, cashAccountId: v})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-black text-blue-600"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {cashAccounts?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{a.code} - {isRtl ? a.nameAr : a.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="pt-6 border-t space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                             <Briefcase className="h-3.5 w-3.5" /> {isRtl ? 'المشروع المرتبط' : 'Related Project'}
                          </Label>
                          <Select value={form.projectId} onValueChange={v => setForm({...form, projectId: v, costCenterId: '', profitCenterId: ''})}>
                             <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl">
                                <SelectItem value="GENERAL" className="font-bold italic text-slate-400">{isRtl ? '--- بدون مشروع (عام) ---' : '--- No Project (General) ---'}</SelectItem>
                                {projects?.map(p => <SelectItem key={p.id} value={p.id!} className="font-bold py-3 border-b last:border-0 border-slate-50">{p.subServiceName}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                             <LayoutGrid className="h-3.5 w-3.5" /> {tSafe('inline.cost_center', 'مركز التكلفة', 'Cost Center')}
                          </Label>
                          <Select value={form.costCenterId} onValueChange={v => setForm({...form, costCenterId: v})}>
                             <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl">
                                {filteredCC?.map(cc => <SelectItem key={cc.id} value={cc.id!} className="font-bold">{cc.name}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                             <DatabaseZap className="h-3.5 w-3.5" /> {tSafe('inline.profit_center', 'مركز الربحية', 'Profit Center')}
                          </Label>
                          <Select value={form.profitCenterId} onValueChange={v => setForm({...form, profitCenterId: v})}>
                             <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                             <SelectContent className="rounded-xl border-2 shadow-2xl">
                                {filteredPC?.map(pc => <SelectItem key={pc.id} value={pc.id!} className="font-bold">{pc.name}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{isRtl ? 'مقابل حساب (إيراد)' : 'Against Account (Revenue)'}</Label>
                       <Select value={form.accountId} onValueChange={v => setForm({...form, accountId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {incomeAccounts?.map(a => <SelectItem key={a.id} value={a.id!} className="font-bold">{a.code} - {isRtl ? a.nameAr : a.nameEn}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">{t('common.notes')}</Label>
                       <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full min-h-[100px] rounded-xl border-2 p-4 text-xs font-medium bg-slate-50/30" placeholder="..." />
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-6">
                    <Button onClick={handleSave} disabled={loading} className="h-14 rounded-2xl px-12 bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-100 hover:scale-[1.02] transition-all gap-2">
                       {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                       {isRtl ? 'تأكيد وإصدار السند' : 'Confirm & Issue'}
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <aside className="lg:col-span-4 space-y-6 text-start">
              <Card className="rounded-2xl border shadow-sm p-6 bg-slate-900 text-white space-y-4 overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-6 opacity-10"><Landmark className="h-24 w-24" /></div>
                 <h4 className="font-black text-xs uppercase tracking-widest text-primary">{isRtl ? 'أتمتة مالية' : 'Financial Automation'}</h4>
                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                    {isRtl 
                      ? 'سيقوم النظام تلقائياً بإنشاء قيد محاسبي مزدوج يربط حساب النقدية بحساب الإيراد أو الذمة المختار مع تخصيص العملية لمركز تكلفة المشروع المختار.' 
                      : 'System will auto-generate a journal entry linking cash to revenue/receivable, assigned to the selected project cost center.'}
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
                       <TableHead className="text-start">{isRtl ? 'من السيد' : 'Received From'}</TableHead>
                       <TableHead className="text-end">{t('common.amount')}</TableHead>
                       <TableHead className="text-center">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                       <TableHead className="pe-6"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : vouchers?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-bold italic">{t('common.noResults')}</TableCell></TableRow>
                    ) : vouchers?.map(v => (
                      <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100">
                         <TableCell className="py-3 ps-6 text-start font-black text-slate-800">
                            <div className="flex flex-col">
                               <span>{v.voucherNumber}</span>
                               <span className="text-[9px] text-slate-400 font-mono">{v.date}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-start font-bold text-slate-600">{v.personName}</TableCell>
                         <TableCell className="text-end font-mono font-black text-emerald-600">{v.amount.toLocaleString()} <span className="text-[8px] opacity-40">KWD</span></TableCell>
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
    </div>
  );
}
