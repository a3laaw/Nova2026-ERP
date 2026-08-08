
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wallet, Plus, Loader2, Save, 
  ArrowRight, Landmark, User, FileText
} from "lucide-react";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { paths } from '@/firebase/multi-tenant';
import { Voucher, Account } from '@/types/accounting';
import { AccountingService } from '@/services/accounting-service';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PaymentVouchersPage() {
  const { globalUser, user } = useAuthContext();
  const { t, dir, isRtl } = useLanguage();
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
    notes: ''
  });

  const vouchersQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.vouchers(companyId)), where('type', '==', 'payment'), orderBy('createdAt', 'desc')) : null, 
  [db, companyId]);

  const accountsQuery = useMemo(() => 
    companyId && db ? query(collection(db, paths.accounts(companyId))) : null, 
  [db, companyId]);

  const { data: vouchers, loading: vouchersLoading } = useCollection<Voucher>(vouchersQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);

  const cashAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.code.startsWith('101') || a.code.startsWith('102'))), [accounts]);
  const expenseAccounts = useMemo(() => accounts?.filter(a => !a.isGroup && (a.type === 'expense' || a.type === 'liability')), [accounts]);

  const handleSave = async () => {
    if (!db || !companyId || !user) return;
    if (!form.accountId || !form.cashAccountId || form.amount <= 0) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى ملء كافة الحقول المطلوبة." });
      return;
    }

    setLoading(true);
    try {
      const service = new AccountingService(db, companyId);
      await service.createVoucher({ ...form, type: 'payment' }, user.uid);
      toast({ title: "تم الحفظ", description: "تم إصدار سند الصرف وترحيل القيد آلياً." });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], amount: 0, personName: '', paymentMethod: 'cash', accountId: '', cashAccountId: '', notes: '' });
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
            <Wallet className="h-6 w-6 text-rose-600" /> {isRtl ? 'سندات الصرف' : 'Payment Vouchers'}
          </h1>
          <p className="text-muted-foreground text-xs font-medium">توثيق المصروفات والمدفوعات المالية</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-9 px-6 font-bold gap-2 bg-rose-600 hover:bg-rose-700">
           {isAdding ? <ArrowRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
           {isAdding ? (isRtl ? 'العودة للقائمة' : 'Back') : (isRtl ? 'سند صرف جديد' : 'New Payment')}
        </Button>
      </header>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
           <Card className="lg:col-span-8 rounded-xl border-0 shadow-2xl bg-white overflow-hidden">
              <CardHeader className="bg-rose-50 p-6 border-b">
                 <CardTitle className="text-rose-900 font-black flex items-center gap-3">
                    <Plus className="h-5 w-5" /> {isRtl ? 'إصدار سند صرف ذكي' : 'Issue Payment'}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 text-start">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">تاريخ السند</Label>
                       <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-10 rounded-lg" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">يصرف للسيد / الجهة</Label>
                       <div className="relative">
                          <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                          <Input value={form.personName} onChange={e => setForm({...form, personName: e.target.value})} className="h-10 rounded-lg ps-10 font-bold" placeholder="..." />
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">قيمة المبلغ</Label>
                       <div className="relative">
                          <Input type="number" step="0.001" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="h-14 rounded-xl border-2 border-rose-100 bg-rose-50/20 text-center font-black text-2xl text-rose-600" />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-200">KWD</div>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">طريقة الصرف</Label>
                       <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="cash" className="font-bold">نقدي</SelectItem>
                             <SelectItem value="bank" className="font-bold">شيك</SelectItem>
                             <SelectItem value="transfer" className="font-bold">تحويل بنكي / KNET</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">يصرف من حساب</Label>
                       <Select value={form.cashAccountId} onValueChange={v => setForm({...form, cashAccountId: v})}>
                          <SelectTrigger className="h-14 rounded-xl border-2 font-black text-rose-600"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent>
                             {cashAccounts?.map(a => <SelectItem key={a.id} value={a.id} className="font-bold">{a.nameAr}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="pt-6 border-t space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-primary tracking-widest">مقابل حساب (الطرف المدين)</Label>
                       <Select value={form.accountId} onValueChange={v => setForm({...form, accountId: v})}>
                          <SelectTrigger className="h-12 rounded-xl border-2 font-bold bg-slate-50/50"><SelectValue placeholder="..." /></SelectTrigger>
                          <SelectContent>
                             {expenseAccounts?.map(a => <SelectItem key={a.id} value={a.id} className="font-bold">{a.code} - {a.nameAr}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-400">البيان / ملاحظات</Label>
                       <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full min-h-[100px] rounded-xl border-2 p-4 text-xs font-medium bg-slate-50/30" placeholder="..." />
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-6">
                    <Button onClick={handleSave} disabled={loading} className="h-14 rounded-2xl px-12 bg-rose-600 text-white font-black text-lg shadow-xl shadow-rose-100 hover:scale-[1.02] transition-all gap-2">
                       {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                       تأكيد وإصدار السند
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <aside className="lg:col-span-4 space-y-6 text-start">
              <Card className="rounded-2xl border shadow-sm p-6 bg-slate-900 text-white space-y-4 overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-6 opacity-10"><Landmark className="h-24 w-24" /></div>
                 <h4 className="font-black text-xs uppercase tracking-widest text-primary">المطابقة الآلية</h4>
                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                    عند حفظ هذا السند، سيقوم نظام Nova Flow تلقائياً بتوليد قيد يومية مزدوج وترحيله للأستاذ العام لضمان دقة القوائم المالية اللحظية.
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
                       <TableHead className="text-end">{isRtl ? 'المبلغ' : 'Amount'}</TableHead>
                       <TableHead className="text-center">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                       <TableHead className="pe-6"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {vouchersLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></TableCell></TableRow>
                    ) : vouchers?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-300 font-bold italic">لا يوجد سندات صرف مسجلة.</TableCell></TableRow>
                    ) : vouchers?.map(v => (
                      <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-50">
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
    </div>
  );
}
